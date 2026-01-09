import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const anthropicApiKey = process.env.ANTHROPIC_API_KEY!
const adzunaAppId = process.env.ADZUNA_APP_ID!
const adzunaAppKey = process.env.ADZUNA_APP_KEY!

const supabase = createClient(supabaseUrl, supabaseKey)

interface ParsedCV {
  target_roles: string[]
  skills: string[]
  experience_years: number
  location: string
  seniority: string
  education: string
  languages: string[]
}

interface Job {
  id: string
  title: string
  company: { display_name: string }
  location: { display_name: string }
  description: string
  redirect_url: string
  created: string
  contract_type?: string
  salary_min?: number
  salary_max?: number
}

interface NormalizedJob {
  search_id: string
  external_id: string
  source: string
  job_url: string
  job_title: string
  company_name: string
  location: string
  description: string
  posted_date: string | null
  matching_details: {
    contract_type: string
    remote_type: string
    salary_min: number | null
    salary_max: number | null
    full_description: string
  }
  prefilter_score?: number
}

// Helper: nettoie le JSON des backticks markdown
function cleanJsonResponse(text: string): string {
  return text
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim()
}

// Helper: suit les redirections pour obtenir l'URL finale
async function getDirectJobUrl(adzunaUrl: string): Promise<string> {
  try {
    // Utiliser GET avec redirect manual pour capturer l'URL de redirection
    const response = await fetch(adzunaUrl, {
      method: 'GET',
      redirect: 'manual',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    })

    // Si c'est une redirection, récupérer l'URL de destination
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location')
      if (location && !location.includes('adzuna')) {
        return location
      }
    }

    // Sinon retourner l'URL originale
    return adzunaUrl
  } catch (error) {
    return adzunaUrl
  }
}

// 1. Parse CV with Claude
async function parseCV(cvText: string): Promise<ParsedCV> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01',
      'x-api-key': anthropicApiKey,
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: `Parse ce CV et retourne UNIQUEMENT le JSON (sans backticks, sans markdown).\n\nCV:\n${cvText}\n\nFormat:\n{"target_roles":[],"skills":[],"experience_years":0,"location":"","seniority":"","education":"","languages":[]}`
      }]
    }),
  })

  const data = await response.json()
  const cvDataText = cleanJsonResponse(data.content[0].text)
  return JSON.parse(cvDataText)
}

// 2. Build Adzuna search URLs
function buildAdzunaUrls(cvData: ParsedCV): string[] {
  const skills = (cvData.skills || []).map(s => s.toLowerCase())
  const targetRole = cvData.target_roles?.[0] || 'developer'
  const location = cvData.location?.toLowerCase() || 'paris'

  const itSkills = ['javascript', 'python', 'java', 'react', 'typescript', 'node', 'php', 'ruby', 'go', 'rust', 'c++', 'c#', 'sql', 'aws', 'docker', 'git', 'angular', 'vue', 'next', 'redux', 'graphql', 'mongodb', 'postgresql', 'kubernetes', 'jenkins']
  const isTech = skills.some(s => itSkills.includes(s))

  const baseUrl = 'https://api.adzuna.com/v1/api/jobs/fr/search/1'
  const params = `?app_id=${adzunaAppId}&app_key=${adzunaAppKey}&results_per_page=100&where=${encodeURIComponent(location)}&distance=50&max_days_old=30`

  const urls: string[] = []

  if (isTech) {
    urls.push(baseUrl + params + '&category=it-jobs')

    const topSkills = ['react', 'python', 'typescript', 'node', 'java', 'php', 'angular', 'vue', 'django', 'spring']
    const matchedSkills = skills.filter(s => topSkills.includes(s)).slice(0, 3)

    matchedSkills.forEach(skill => {
      urls.push(baseUrl + params + `&what=${encodeURIComponent(skill + ' developer')}`)
    })
  } else {
    urls.push(baseUrl + params + `&what=${encodeURIComponent(targetRole)}`)
  }

  return urls
}

// 3. Fetch jobs from Adzuna
async function fetchAdzunaJobs(urls: string[]): Promise<Job[]> {
  const allJobs: Job[] = []

  for (const url of urls) {
    try {
      const response = await fetch(url)
      const data = await response.json()
      if (data.results) {
        allJobs.push(...data.results)
      }
    } catch (error) {
      console.error('Error fetching from Adzuna:', error)
    }
  }

  return allJobs
}

// 4. Prefilter and score jobs
function prefilterJobs(jobs: Job[], cvData: ParsedCV, searchId: string): NormalizedJob[] {
  // Filter out business/sales roles for tech profiles
  const isTechProfile = cvData.skills.some(skill => {
    const techSkills = ['javascript', 'python', 'java', 'react', 'typescript', 'node', 'php', 'ruby', 'go', 'rust', 'c++', 'c#', 'sql', 'aws', 'docker', 'git', 'angular', 'vue', 'next', 'redux', 'graphql', 'mongodb', 'postgresql']
    return techSkills.includes(skill.toLowerCase())
  })

  const filteredJobs = isTechProfile
    ? jobs.filter(job => {
        const title = job.title.toLowerCase()
        return !(
          title.includes('business developer') ||
          title.includes('business development') ||
          title.includes('account manager') ||
          title.includes('sales')
        )
      })
    : jobs

  // Deduplicate jobs
  function normalizeString(str: string): string {
    return (str || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '')
  }

  const seen = new Map<string, boolean>()
  const uniqueJobs: Job[] = []

  for (const job of filteredJobs) {
    const key = `${normalizeString(job.title)}_${normalizeString(job.company.display_name)}_${normalizeString(job.location.display_name)}`

    if (!seen.has(key)) {
      seen.set(key, true)
      uniqueJobs.push(job)
    }
  }

  // Calculate basic score
  function calculateBasicScore(job: Job, cv: ParsedCV): number {
    let score = 0

    const jobText = (job.title + ' ' + job.description).toLowerCase()
    const cvSkills = (cv.skills || []).map(s => s.toLowerCase())

    let skillMatches = 0
    cvSkills.forEach(skill => {
      if (jobText.includes(skill)) {
        skillMatches++
      }
    })

    if (cvSkills.length > 0 && skillMatches === 0) {
      return 0
    }

    const skillScore = cvSkills.length > 0 ? (skillMatches / cvSkills.length) * 60 : 0
    score += skillScore

    const jobTitle = (job.title || '').toLowerCase()
    const targetRoles = (cv.target_roles || []).map(r => r.toLowerCase())

    let roleMatch = false
    targetRoles.forEach(role => {
      if (jobTitle.includes(role) || role.includes(jobTitle.split(' ')[0])) {
        roleMatch = true
      }
    })

    score += roleMatch ? 25 : 0

    const jobLocation = (job.location?.display_name || '').toLowerCase()
    const cvLocation = (cv.location || '').toLowerCase()

    if (jobLocation.includes(cvLocation) || cvLocation.includes(jobLocation)) {
      score += 10
    }

    const contractType = (job.contract_type || '').toLowerCase()
    if (contractType.includes('permanent') || contractType.includes('cdi')) {
      score += 5
    }

    return Math.round(score)
  }

  // Normalize and score jobs
  const normalizedJobs: NormalizedJob[] = uniqueJobs.map(job => ({
    search_id: searchId,
    external_id: job.id,
    source: 'adzuna',
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
    prefilter_score: calculateBasicScore(job, cvData)
  }))

  // Sort by score and take top 50
  return normalizedJobs
    .sort((a, b) => (b.prefilter_score || 0) - (a.prefilter_score || 0))
    .filter(job => (job.prefilter_score || 0) > 0)
    .slice(0, 50)
}

// 5. Score top 10 with Claude
async function scoreTopJobsWithClaude(jobs: NormalizedJob[], cvData: ParsedCV): Promise<Array<{ job_index: number; score: number; justification: string }>> {
  const top10 = jobs.slice(0, 10)

  const jobsList = top10.map((job, index) =>
    `Job ${index + 1}: ${job.job_title} @ ${job.company_name}\nLocation: ${job.location}\nDescription: ${job.description.substring(0, 500)}`
  ).join('\n\n')

  const prompt = `Tu es un expert en matching CV-job. Analyse ce CV et ces 10 jobs, puis donne un score de 0 à 100 pour chaque job avec justification.\n\nCV du candidat:\n- Rôles ciblés: ${cvData.target_roles.join(', ')}\n- Compétences: ${cvData.skills.join(', ')}\n- Expérience: ${cvData.experience_years} ans\n- Localisation: ${cvData.location}\n- Séniorité: ${cvData.seniority}\n\nJobs à scorer:\n${jobsList}\n\nRetourne UNIQUEMENT un JSON array avec ce format (rien d'autre):\n[\n  {"job_index": 1, "score": 85, "justification": "..."},\n  {"job_index": 2, "score": 78, "justification": "..."}\n]`

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01',
      'x-api-key': anthropicApiKey,
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: prompt
      }]
    }),
  })

  const data = await response.json()
  let scoresText = data.content[0].text
  scoresText = scoresText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

  return JSON.parse(scoresText)
}

// Main API handler
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { cv_text, user_id, name, search_type, filename } = body

    if (!cv_text) {
      return NextResponse.json({ error: 'CV text is required' }, { status: 400 })
    }

    // 1. Parse CV with Claude
    console.log('Parsing CV...')
    const parsedData = await parseCV(cv_text)

    // Generate search name if not provided
    const searchName = name || `${parsedData.target_roles[0] || 'Profil'} - ${parsedData.location || 'France'}`

    // 2. Save search to Supabase
    console.log('Saving search...')
    const { data: searchData, error: searchError } = await supabase
      .from('searches')
      .insert({
        user_id: user_id === 'anonymous' ? null : user_id,
        name: searchName,
        search_type: search_type || 'cv',
        job_title: parsedData.target_roles[0] || null,
        location: parsedData.location || null,
        seniority: parsedData.seniority || null,
        brief: parsedData.skills.join(', ') || null,
        cv_text: cv_text,
        parsed_data: parsedData,
        status: 'processing'
      })
      .select()
      .single()

    if (searchError) {
      console.error('Supabase search error:', searchError)
      return NextResponse.json({ error: 'Failed to save search' }, { status: 500 })
    }

    const searchId = searchData.id

    // 3. Build Adzuna URLs and fetch jobs
    console.log('Fetching jobs from Adzuna...')
    const urls = buildAdzunaUrls(parsedData)
    const allJobs = await fetchAdzunaJobs(urls)

    console.log(`Found ${allJobs.length} jobs`)

    if (allJobs.length === 0) {
      // Update search status to completed with no results
      await supabase
        .from('searches')
        .update({ status: 'completed' })
        .eq('id', searchId)

      return NextResponse.json({
        success: true,
        search_id: searchId,
        matches_inserted: 0
      })
    }

    // 4. Prefilter jobs
    console.log('Prefiltering jobs...')
    const top50Jobs = prefilterJobs(allJobs, parsedData, searchId)

    console.log(`Prefiltered to ${top50Jobs.length} relevant jobs`)

    if (top50Jobs.length === 0) {
      await supabase
        .from('searches')
        .update({ status: 'completed' })
        .eq('id', searchId)

      return NextResponse.json({
        success: true,
        search_id: searchId,
        matches_inserted: 0
      })
    }

    // 4b. Résoudre les URLs directes (en parallèle pour les 20 premiers)
    console.log('Resolving direct job URLs...')
    const urlPromises = top50Jobs.slice(0, 20).map(async (job, index) => {
      const directUrl = await getDirectJobUrl(job.job_url)
      top50Jobs[index].job_url = directUrl
    })
    await Promise.all(urlPromises)

    // 5. Score top 10 with Claude
    console.log('Scoring top jobs with Claude...')
    const claudeScores = await scoreTopJobsWithClaude(top50Jobs, parsedData)

    // 6. Build final matches
    const top10Matches = claudeScores.map((scoreData, index) => {
      const job = top50Jobs[scoreData.job_index - 1]
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
        matching_details: job.matching_details,
        rank: index + 1
      }
    })

    const other40Matches = top50Jobs.slice(10, 50).map((job, index) => ({
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
      matching_details: job.matching_details,
      rank: index + 11
    }))

    const allMatches = [...top10Matches, ...other40Matches]

    // 7. Save matches to Supabase
    console.log('Saving matches...')
    const { error: matchesError } = await supabase
      .from('matches')
      .insert(allMatches)

    if (matchesError) {
      console.error('Supabase matches error:', matchesError)
    }

    // 8. Update search status to completed
    await supabase
      .from('searches')
      .update({ status: 'completed' })
      .eq('id', searchId)

    console.log('Done!')

    return NextResponse.json({
      success: true,
      search_id: searchId,
      matches_inserted: allMatches.length
    })

  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'An error occurred'
    }, { status: 500 })
  }
}
