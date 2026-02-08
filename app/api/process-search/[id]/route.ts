// Process search endpoint - handles job scraping and scoring
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  runApifyActor,
  runApifyActorAsync,
  APIFY_ACTORS,
  IndeedJobOutput,
  ATSJobOutput
} from '@/lib/apify'
import { callClaude, cleanJsonResponse } from '@/lib/claude'

const getSupabase = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase credentials')
  return createClient(url, key)
}
const getAdzunaCredentials = () => ({
  appId: process.env.ADZUNA_APP_ID || '',
  appKey: process.env.ADZUNA_APP_KEY || ''
})

// Recruitment agencies to filter out
const RECRUITMENT_AGENCIES = [
  'michael page', 'page personnel', 'pagegroup', 'robert half', 'hays', 'randstad', 'adecco', 'manpower',
  'kelly services', 'experis', 'akkodis', 'modis', 'spring', 'lhh', 'expectra', 'synergie', 'crit',
  'proman', 'actual', 'partnaire', 'temporis', 'interaction', 'start people', 'menway', 'lynx rh',
  'free-work', 'free work', 'externatic', 'urban linker', 'talent.io', 'hired', 'triplebyte',
  'lincoln', 'jp associates', 'freelance.com', 'malt', 'side', 'coopaname', 'keljob', 'jobteaser',
  'le collectif', 'skillwise', 'happy to meet you', 'htmy', 'ignition program', 'mobiskill',
  'silkhom', 'altaide', 'mybeautifuljob', 'hunteed', 'opensourcing', 'nexten', 'kicklox',
  'welovedevs', 'chooseyourboss', 'lesjeudis', 'club freelance', 'comet', 'xor talents',
  'mindquest', 'wenabi', 'approach people', 'blue coding', 'wesley', 'sthree', 'computer futures',
  'progressive recruitment', 'real staffing', 'nigel frank', 'jefferson wells', 'aston carter'
]

interface ParsedCV {
  target_roles: string[]
  skills: string[]
  experience_years: number
  location: string
  seniority: string
  education: string
  languages: string[]
}

interface NormalizedJob {
  search_id: string
  external_id: string
  source: string
  source_engine: 'adzuna' | 'indeed' | 'ats_direct'  // Internal tracking
  job_url: string
  job_title: string
  company_name: string
  location: string
  description: string
  posted_date: string | null
  matching_details: Record<string, unknown>
  prefilter_score?: number
}

// Detect original source from Adzuna redirect URL
// Adzuna aggregates 50+ job boards - we want to show the REAL source to clients
function detectOriginalSource(redirectUrl: string, companyName: string): string {
  const url = (redirectUrl || '').toLowerCase()
  const company = (companyName || '').toLowerCase()

  // Check URL patterns for known job boards
  if (url.includes('pole-emploi') || url.includes('francetravail')) return 'France Travail'
  if (url.includes('apec.fr')) return 'APEC'
  if (url.includes('cadremploi')) return 'Cadremploi'
  if (url.includes('monster')) return 'Monster'
  if (url.includes('meteojob')) return 'Meteojob'
  if (url.includes('regionsjob')) return 'RegionsJob'
  if (url.includes('hellowork')) return 'HelloWork'
  if (url.includes('indeed')) return 'Indeed'
  if (url.includes('linkedin')) return 'LinkedIn'
  if (url.includes('welcometothejungle') || url.includes('wttj')) return 'WTTJ'
  if (url.includes('talent.com')) return 'Talent.com'
  if (url.includes('jobijoba')) return 'Jobijoba'
  if (url.includes('lesjeudis')) return 'LesJeudis'
  if (url.includes('chooseyourboss')) return 'ChooseYourBoss'
  if (url.includes('free-work') || url.includes('freework')) return 'Free-Work'

  // Fallback: never show "Adzuna" to client
  return 'Offre directe'
}

// Update processing step
async function updateStep(supabase: ReturnType<typeof getSupabase>, searchId: string, step: string) {
  await supabase
    .from('searches')
    .update({ processing_step: step })
    .eq('id', searchId)
  console.log(`[${searchId}] Step: ${step}`)
}

// Set error and complete
async function setError(supabase: ReturnType<typeof getSupabase>, searchId: string, error: string) {
  await supabase
    .from('searches')
    .update({ status: 'error', processing_step: null, error_message: error })
    .eq('id', searchId)
}

// Score jobs with Claude Sonnet (needs nuanced reasoning)
async function scoreTopJobsWithClaude(jobs: NormalizedJob[], cvData: ParsedCV): Promise<Array<{ job_index: number; score: number; justification: string }>> {
  const top10 = jobs.slice(0, 10)
  const jobsList = top10.map((job, index) =>
    `Job ${index + 1}: ${job.job_title} @ ${job.company_name}\nLocation: ${job.location}\nDescription: ${job.description.substring(0, 500)}`
  ).join('\n\n')

  const prompt = `Tu es un expert en matching CV-job. Analyse ce CV et ces 10 jobs, puis donne un score de 0 à 100 pour chaque job avec justification.\n\nCV du candidat:\n- Rôles ciblés: ${cvData.target_roles.join(', ')}\n- Compétences: ${cvData.skills.join(', ')}\n- Expérience: ${cvData.experience_years} ans\n- Localisation: ${cvData.location}\n- Séniorité: ${cvData.seniority}\n\nJobs à scorer:\n${jobsList}\n\nRetourne UNIQUEMENT un JSON array avec ce format (rien d'autre):\n[\n  {"job_index": 1, "score": 85, "justification": "..."},\n  {"job_index": 2, "score": 78, "justification": "..."}\n]`

  const response = await callClaude({
    model: 'sonnet',
    prompt,
    maxTokens: 2000
  })

  return JSON.parse(cleanJsonResponse(response.text))
}

// Fetch Adzuna jobs - search with ALL target roles for better coverage
async function fetchAdzunaJobs(parsedData: ParsedCV): Promise<NormalizedJob[]> {
  const { appId, appKey } = getAdzunaCredentials()
  if (!appId || !appKey) return []

  const location = parsedData.location || 'france'
  const baseUrl = 'https://api.adzuna.com/v1/api/jobs/fr/search/1'

  // Search with TOP 3 target roles for better coverage
  const rolesToSearch = parsedData.target_roles.slice(0, 3)
  if (rolesToSearch.length === 0) rolesToSearch.push('developer')

  const allJobs: NormalizedJob[] = []
  const seenIds = new Set<string>()

  // Make parallel requests for each role
  const requests = rolesToSearch.map(async (jobTitle) => {
    const params = `?app_id=${appId}&app_key=${appKey}&results_per_page=30&where=${encodeURIComponent(location)}&distance=50&max_days_old=30&what=${encodeURIComponent(jobTitle)}`

    try {
      const response = await fetch(baseUrl + params)
      const data = await response.json()
      if (!response.ok || !data.results) return []
      return data.results
    } catch {
      return []
    }
  })

  const results = await Promise.all(requests)
  const flatResults = results.flat()

  for (const job of flatResults) {
    const id = `adzuna_${job.id}`
    if (seenIds.has(id)) continue
    seenIds.add(id)

    allJobs.push({
      search_id: '',
      external_id: id,
      source: detectOriginalSource(job.redirect_url, job.company?.display_name),
      source_engine: 'adzuna' as const,
      job_url: job.redirect_url,
      job_title: job.title,
      company_name: job.company?.display_name || 'Unknown',
      location: job.location?.display_name || 'Remote',
      description: job.description || '',
      posted_date: job.created ? new Date(job.created).toISOString().split('T')[0] : null,
      matching_details: {
        contract_type: job.contract_type || 'permanent',
        remote_type: 'on_site',
        salary_min: job.salary_min || null,
        salary_max: job.salary_max || null,
        full_description: job.description
      },
      prefilter_score: 50
    })
  }

  console.log(`Adzuna: searched ${rolesToSearch.length} roles, found ${allJobs.length} unique jobs`)
  return allJobs
}

// Fetch ATS Jobs (Greenhouse, Lever, Workday, Ashby, etc. - 13 platforms)
async function fetchATSJobs(parsedData: ParsedCV): Promise<NormalizedJob[]> {
  // All 13 ATS platforms supported by this actor
  const ALL_ATS_SOURCES = [
    'greenhouse',
    'lever_co',
    'ashby',
    'workable',
    'rippling',
    'polymer',
    'workday',
    'smartrecruiters',
    'bamboohr',
    'breezy',
    'jazzhr',
    'recruitee',
    'personio'
  ]

  // Use ALL target roles (up to 5) for comprehensive search
  const queries = parsedData.target_roles.slice(0, 5)
  if (queries.length === 0) queries.push('developer')

  const input: Record<string, unknown> = {
    queries,  // Now searches ALL roles, not just the first one!
    locations: [parsedData.location || 'Paris'],
    sources: ALL_ATS_SOURCES,
    is_remote: false,
    page: 1,
    page_size: 150  // Increased for better coverage
  }

  console.log('ATS Jobs input:', JSON.stringify(input, null, 2))

  try {
    // Use async method - this actor doesn't support sync endpoint (returns 502)
    const jobs = await runApifyActorAsync<ATSJobOutput>({
      actorId: APIFY_ACTORS.ATS_JOBS,
      input,
      timeoutSecs: 120
    })

    return jobs
      .filter(job => job.title)
      .map(job => {
        // Build location string from first location
        const loc = job.locations?.[0]
        let locationStr = 'Unknown'
        if (loc?.location) {
          locationStr = loc.location
        } else if (loc?.city) {
          locationStr = `${loc.city}${loc.state ? `, ${loc.state}` : ''}${loc.country ? `, ${loc.country}` : ''}`
        } else if (job.is_remote || job.workplace_type === 'remote') {
          locationStr = 'Remote'
        }

        // Determine remote type from workplace_type or is_remote flag
        const isRemote = job.is_remote || job.workplace_type === 'remote' || job.workplace_type === 'hybrid'

        return {
          search_id: '',
          external_id: `ats_${job.source}_${job.id}`,
          source: job.source, // greenhouse, lever_co, workday, ashby, etc.
          source_engine: 'ats_direct' as const,  // Internal tracking
          job_url: job.apply_url || job.listing_url,
          job_title: job.title,
          company_name: job.company?.name || 'Unknown',
          location: locationStr,
          description: (job.description || '').substring(0, 2000),
          posted_date: job.date_posted ? job.date_posted.split('T')[0] : null,
          matching_details: {
            contract_type: job.employment_type === 'contract' || job.employment_type === 'temporary' ? 'contract'
              : job.employment_type === 'internship' ? 'internship' : 'permanent',
            remote_type: isRemote ? 'remote' : 'on_site',
            workplace_type: job.workplace_type || null,
            salary_min: job.compensation?.min || null,
            salary_max: job.compensation?.max || null,
            salary_currency: job.compensation?.currency || null,
            salary_period: job.compensation?.period || null,
            experience_level: job.experience_level || null,
            employment_type: job.employment_type || null,
            full_description: job.description || '',
            source_id: job.source_id || null
          },
          prefilter_score: 50
        }
      })
  } catch (error) {
    console.error('ATS Jobs error:', error)
    return []
  }
}

// Fetch Indeed jobs - search with ALL target roles
async function fetchIndeedJobs(parsedData: ParsedCV): Promise<NormalizedJob[]> {
  // Use ALL target roles for comprehensive search
  const keywords = parsedData.target_roles.slice(0, 5)
  if (keywords.length === 0) keywords.push('developer')

  const input: Record<string, unknown> = {
    keywords,  // Now searches ALL roles!
    location: parsedData.location || 'France',
    country: 'France',
    datePosted: '30', // last 30 days
    maxItems: 50  // Increased from 20
  }

  try {
    const jobs = await runApifyActor<IndeedJobOutput>({
      actorId: APIFY_ACTORS.INDEED_JOBS,
      input,
      timeoutSecs: 90
    })

    // Map all results (maxItems controls limit in input)
    return jobs.map(job => ({
      search_id: '',
      external_id: `indeed_${job.key}`,
      source: 'Indeed',  // Capitalized for display
      source_engine: 'indeed' as const,  // Internal tracking
      job_url: job.applyUrl || job.jobUrl,
      job_title: job.title,
      company_name: job.company?.companyName || 'Unknown',
      location: job.location?.city ? `${job.location.city}, ${job.location.country}` : 'Remote',
      description: (job.description_text || '').substring(0, 2000),
      posted_date: job.datePublished ? job.datePublished.split('T')[0] : null,
      matching_details: {
        contract_type: 'permanent',
        remote_type: 'on_site',
        salary_min: job.baseSalary_min || null,
        salary_max: job.baseSalary_max || null,
        full_description: job.description_text || ''
      },
      prefilter_score: 50
    }))
  } catch (error) {
    console.error('Indeed error:', error)
    return []
  }
}

// DISABLED: Glassdoor (memory limit issues) and WTTJ (timeout issues)
// These scrapers have been replaced by ATS Jobs Search which covers 13 platforms

// High-quality ATS sources (direct company career pages)
const QUALITY_ATS_SOURCES = [
  'greenhouse', 'lever_co', 'ashby', 'workable', 'rippling', 'polymer',
  'workday', 'smartrecruiters', 'bamboohr', 'breezy', 'jazzhr', 'recruitee', 'personio'
]

// Filter agencies and score jobs
function filterAndScoreJobs(jobs: NormalizedJob[], parsedData: ParsedCV, searchId: string, excludeAgencies: boolean): NormalizedJob[] {
  let filtered = jobs

  // Filter agencies
  if (excludeAgencies) {
    filtered = jobs.filter(job => {
      const companyName = (job.company_name || '').toLowerCase()
      const description = (job.description || '').toLowerCase()
      return !RECRUITMENT_AGENCIES.some(agency => companyName.includes(agency) || description.includes(agency))
    })
  }

  // Count by source before scoring
  const sourceCountBefore: Record<string, number> = {}
  filtered.forEach(job => {
    sourceCountBefore[job.source] = (sourceCountBefore[job.source] || 0) + 1
  })
  console.log('Jobs by source before scoring:', sourceCountBefore)

  // Score each job
  filtered.forEach(job => {
    job.search_id = searchId
    let score = 0
    const jobText = ((job.job_title || '') + ' ' + (job.description || '')).toLowerCase()
    const jobTitle = (job.job_title || '').toLowerCase()
    const cvSkills = (parsedData.skills || []).map(s => s.toLowerCase())
    const targetRoles = (parsedData.target_roles || []).map(r => r.toLowerCase())

    // Role matching (40 points max) - search in title AND description
    let roleScore = 0
    targetRoles.forEach(role => {
      // Match exact du rôle dans le TITRE (meilleur score)
      if (jobTitle.includes(role)) {
        roleScore = Math.max(roleScore, 40)
      }
      // Match exact du rôle dans la DESCRIPTION (bon score)
      else if (jobText.includes(role)) {
        roleScore = Math.max(roleScore, 30)
      }
      // Match partiel sur les mots significatifs (> 3 chars)
      else {
        const roleWords = role.split(/\s+/).filter(w => w.length > 3)
        roleWords.forEach(word => {
          if (jobTitle.includes(word)) {
            roleScore = Math.max(roleScore, 25)
          } else if (jobText.includes(word)) {
            roleScore = Math.max(roleScore, 15)
          }
        })
      }
    })
    score += roleScore
    const hasRoleMatch = roleScore > 0

    // Skill matching (up to 35 points)
    let skillMatches = 0
    cvSkills.forEach(skill => {
      // Match skills dans titre OU description
      if (skill.length > 2 && jobText.includes(skill)) skillMatches++
    })

    // Skill scoring
    if (cvSkills.length > 0) {
      score += Math.min((skillMatches / Math.min(cvSkills.length, 10)) * 35, 35)
    }

    // Minimum score for quality sources (don't filter them out)
    const isQualitySource = QUALITY_ATS_SOURCES.includes(job.source)
    if (isQualitySource && score < 10) {
      score = 10  // Minimum score for direct ATS sources
    }

    // Only filter jobs with ZERO relevance (no role, no skill, not quality source)
    if (score === 0 && !hasRoleMatch && skillMatches === 0 && !isQualitySource) {
      job.prefilter_score = 0
      return
    }

    // Location matching (15 points)
    const cvLocation = (parsedData.location || '').toLowerCase()
    const jobLocation = (job.location || '').toLowerCase()
    if (cvLocation) {
      // Match ville exacte ou région
      if (jobLocation.includes(cvLocation)) {
        score += 15
      } else if (cvLocation.includes('paris') && (jobLocation.includes('île-de-france') || jobLocation.includes('idf'))) {
        score += 10
      }
    }

    // Contract type bonus (5 points)
    if (job.matching_details?.contract_type === 'permanent') score += 5

    // Quality source bonus (10 points for direct company ATS)
    if (QUALITY_ATS_SOURCES.includes(job.source)) {
      score += 10
    }

    job.prefilter_score = Math.round(score)
  })

  // Count by source after scoring (non-zero only)
  const sourceCountAfter: Record<string, number> = {}
  filtered.filter(j => (j.prefilter_score || 0) > 0).forEach(job => {
    sourceCountAfter[job.source] = (sourceCountAfter[job.source] || 0) + 1
  })
  console.log('Jobs by source after scoring (score > 0):', sourceCountAfter)

  // Deduplicate and sort
  const seen = new Map<string, boolean>()
  const result: NormalizedJob[] = []

  for (const job of filtered.sort((a, b) => (b.prefilter_score || 0) - (a.prefilter_score || 0))) {
    if ((job.prefilter_score || 0) === 0) continue
    const key = `${(job.job_title || '').toLowerCase().replace(/[^a-z0-9]/g, '')}_${(job.company_name || '').toLowerCase().replace(/[^a-z0-9]/g, '')}`
    if (!seen.has(key)) {
      seen.set(key, true)
      result.push(job)
      if (result.length >= 75) break  // Increased from 50
    }
  }

  return result
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: searchId } = await params
  const supabase = getSupabase()

  try {
    // 1. Get search data
    const { data: search, error: searchError } = await supabase
      .from('searches')
      .select('*')
      .eq('id', searchId)
      .single()

    if (searchError || !search) {
      return NextResponse.json({ error: 'Search not found' }, { status: 404 })
    }

    if (search.status !== 'processing') {
      return NextResponse.json({ error: 'Search already processed' }, { status: 400 })
    }

    const parsedData: ParsedCV = search.parsed_data
    const excludeAgencies = search.exclude_agencies !== false

    // 2. Fetch jobs from all sources in parallel
    await updateStep(supabase, searchId, 'scraping')

    // Launch all scrapers in parallel (Adzuna + Indeed + ATS Jobs)
    const [adzunaJobs, indeedJobs, atsJobs] = await Promise.all([
      fetchAdzunaJobs(parsedData).then(jobs => {
        console.log(`[${searchId}] Adzuna: ${jobs.length} jobs`)
        return jobs
      }),
      fetchIndeedJobs(parsedData).then(jobs => {
        console.log(`[${searchId}] Indeed: ${jobs.length} jobs`)
        return jobs
      }),
      fetchATSJobs(parsedData).then(jobs => {
        console.log(`[${searchId}] ATS (13 platforms): ${jobs.length} jobs`)
        return jobs
      })
    ])

    const allJobs = [...adzunaJobs, ...indeedJobs, ...atsJobs]
    console.log(`[${searchId}] Total raw jobs: ${allJobs.length}`)

    if (allJobs.length === 0) {
      await supabase
        .from('searches')
        .update({ status: 'completed', processing_step: null })
        .eq('id', searchId)
      return NextResponse.json({ success: true, matches_inserted: 0 })
    }

    // 3. Filter and score
    await updateStep(supabase, searchId, 'filtering')
    const top50Jobs = filterAndScoreJobs(allJobs, parsedData, searchId, excludeAgencies)
    console.log(`[${searchId}] After filtering: ${top50Jobs.length} jobs`)

    if (top50Jobs.length === 0) {
      await supabase
        .from('searches')
        .update({ status: 'completed', processing_step: null })
        .eq('id', searchId)
      return NextResponse.json({ success: true, matches_inserted: 0 })
    }

    // 4. Score top 10 with Claude
    await updateStep(supabase, searchId, 'scoring')
    let claudeScores: Array<{ job_index: number; score: number; justification: string }> = []
    try {
      claudeScores = await scoreTopJobsWithClaude(top50Jobs, parsedData)
    } catch (error) {
      console.error(`[${searchId}] Claude scoring failed:`, error)
      // Continue without Claude scores
    }

    // 5. Build matches
    await updateStep(supabase, searchId, 'saving')

    // IMPORTANT: Trier les scores Claude par score DESC pour que le meilleur match soit rank=1
    const sortedClaudeScores = [...claudeScores].sort((a, b) => b.score - a.score)

    const top10Matches = sortedClaudeScores.map((scoreData, index) => {
      const job = top50Jobs[scoreData.job_index - 1]
      if (!job) return null
      return {
        search_id: searchId,
        job_title: job.job_title,
        company_name: job.company_name,
        location: job.location,
        posted_date: job.posted_date,
        job_url: job.job_url,
        score: scoreData.score,
        score_type: 'claude_ai',
        justification: scoreData.justification,
        status: 'nouveau',
        external_id: job.external_id,
        source: job.source,
        source_engine: job.source_engine,  // Internal tracking for compliance
        matching_details: job.matching_details,
        rank: index + 1  // Maintenant le rank suit l'ordre des scores (meilleur = 1)
      }
    }).filter(Boolean)

    // Trier les autres jobs par prefilter_score DESC aussi
    const remainingJobs = top50Jobs
      .slice(sortedClaudeScores.length > 0 ? 10 : 0, 75)
      .sort((a, b) => (b.prefilter_score || 0) - (a.prefilter_score || 0))

    const other40Matches = remainingJobs.map((job, index) => ({
      search_id: searchId,
      job_title: job.job_title,
      company_name: job.company_name,
      location: job.location,
      posted_date: job.posted_date,
      job_url: job.job_url,
      score: job.prefilter_score || 0,
      score_type: 'js_prefilter',
      justification: 'Match basé sur compétences et critères',
      status: 'nouveau',
      external_id: job.external_id,
      source: job.source,
      source_engine: job.source_engine,  // Internal tracking for compliance
      matching_details: job.matching_details,
      rank: (sortedClaudeScores.length > 0 ? 10 : 0) + index + 1
    }))

    const allMatches = [...top10Matches, ...other40Matches]

    // 6. Save matches
    if (allMatches.length > 0) {
      const { error: matchesError } = await supabase
        .from('matches')
        .insert(allMatches)

      if (matchesError) {
        console.error(`[${searchId}] Error saving matches:`, matchesError)
      }
    }

    // 7. Mark as completed
    await supabase
      .from('searches')
      .update({ status: 'completed', processing_step: null })
      .eq('id', searchId)

    console.log(`[${searchId}] Completed with ${allMatches.length} matches`)

    return NextResponse.json({
      success: true,
      matches_inserted: allMatches.length
    })

  } catch (error) {
    console.error(`[${searchId}] Processing error:`, error)
    await setError(supabase, searchId, error instanceof Error ? error.message : 'Unknown error')
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 })
  }
}
