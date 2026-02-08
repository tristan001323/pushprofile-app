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

// Normalize location - handle "Non spécifiée" and other invalid values
function normalizeLocation(location: string | undefined): string {
  const loc = (location || '').toLowerCase().trim()
  const invalidLocations = ['non spécifiée', 'non spécifié', 'non specifie', 'non specifié', 'unknown', 'n/a', '']
  if (invalidLocations.includes(loc) || loc.length < 3) {
    return 'france'  // Default to all of France for broad search
  }
  return location || 'france'
}

// Fetch Adzuna jobs - search with ALL target roles for better coverage
async function fetchAdzunaJobs(parsedData: ParsedCV, maxDaysOld: number = 30, contractTypes: string[] = []): Promise<NormalizedJob[]> {
  const { appId, appKey } = getAdzunaCredentials()
  if (!appId || !appKey) return []

  const location = normalizeLocation(parsedData.location)
  const baseUrl = 'https://api.adzuna.com/v1/api/jobs/fr/search/1'

  // Search with TOP 3 target roles for better coverage
  const rolesToSearch = parsedData.target_roles.slice(0, 3)
  if (rolesToSearch.length === 0) rolesToSearch.push('developer')

  // Special cases for "older than X" filters:
  // 31 = older than 1 month (fetch 120 days, keep only 30-90 days old)
  // 90 = older than 3 months (fetch 180 days, keep only 90+ days old)
  const isOlderThan1Month = maxDaysOld === 31
  const isOlderThan3Months = maxDaysOld === 90
  const isOlderFilter = isOlderThan1Month || isOlderThan3Months
  const fetchDays = isOlderThan3Months ? 180 : isOlderThan1Month ? 120 : maxDaysOld
  const minDaysOld = isOlderThan3Months ? 90 : isOlderThan1Month ? 30 : 0

  // Build contract type params for Adzuna
  // Adzuna uses: permanent=1, contract=1, full_time=1, part_time=1
  let contractParams = ''
  if (contractTypes.length > 0) {
    const normalizedTypes = contractTypes.map(ct => ct.toLowerCase())
    if (normalizedTypes.includes('cdi')) contractParams += '&permanent=1'
    if (normalizedTypes.includes('cdd') || normalizedTypes.includes('freelance')) contractParams += '&contract=1'
    // Note: Adzuna doesn't have specific "stage/internship" filter
  }

  const allJobs: NormalizedJob[] = []
  const seenIds = new Set<string>()

  // Make parallel requests for each role
  const requests = rolesToSearch.map(async (jobTitle) => {
    const params = `?app_id=${appId}&app_key=${appKey}&results_per_page=30&where=${encodeURIComponent(location)}&distance=50&max_days_old=${fetchDays}&what=${encodeURIComponent(jobTitle)}${contractParams}`

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

  // Date threshold for "older than X" filters
  const minDateThreshold = new Date()
  minDateThreshold.setDate(minDateThreshold.getDate() - minDaysOld)

  for (const job of flatResults) {
    const id = `adzuna_${job.id}`
    if (seenIds.has(id)) continue

    // For "older than X" modes, skip jobs that are too recent
    if (isOlderFilter && job.created) {
      const jobDate = new Date(job.created)
      if (jobDate > minDateThreshold) continue // Skip recent jobs
    }

    seenIds.add(id)

    // Detect remote type from job description
    const jobText = ((job.title || '') + ' ' + (job.description || '')).toLowerCase()
    let remoteType = 'on_site'
    if (jobText.includes('remote') || jobText.includes('télétravail') || jobText.includes('teletravail') || jobText.includes('100% remote')) {
      remoteType = 'remote'
    } else if (jobText.includes('hybrid') || jobText.includes('hybride') || jobText.includes('partiel')) {
      remoteType = 'hybrid'
    }

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
        contract_type: job.contract_type || undefined,  // Don't default to 'permanent', let filter be lenient
        remote_type: remoteType,
        salary_min: job.salary_min || null,
        salary_max: job.salary_max || null,
        full_description: job.description
      },
      prefilter_score: 50
    })
  }

  // DEBUG: Log contract_type distribution from Adzuna
  const adzunaContractTypeCounts: Record<string, number> = {}
  allJobs.forEach(job => {
    const ct = (job.matching_details?.contract_type as string) || 'undefined'
    adzunaContractTypeCounts[ct] = (adzunaContractTypeCounts[ct] || 0) + 1
  })
  console.log(`[Adzuna DEBUG] Found ${allJobs.length} unique jobs`)
  console.log(`[Adzuna DEBUG] Contract type distribution: ${JSON.stringify(adzunaContractTypeCounts)}`)

  return allJobs
}

// Fetch ATS Jobs (Greenhouse, Lever, Workday, Ashby, etc. - 13 platforms)
async function fetchATSJobs(parsedData: ParsedCV, maxDaysOld: number = 30, contractTypes: string[] = [], remoteOptions: string[] = []): Promise<NormalizedJob[]> {
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
    locations: [normalizeLocation(parsedData.location) === 'france' ? 'Paris' : normalizeLocation(parsedData.location)],
    sources: ALL_ATS_SOURCES,
    is_remote: false,
    page: 1,
    page_size: 100  // Max allowed by API
  }

  console.log('ATS Jobs input:', JSON.stringify(input, null, 2))

  try {
    // Use async method - this actor doesn't support sync endpoint (returns 502)
    const jobs = await runApifyActorAsync<ATSJobOutput>({
      actorId: APIFY_ACTORS.ATS_JOBS,
      input,
      timeoutSecs: 120
    })

    // Handle "older than X" filters (31 = +1 month, 90 = +3 months)
    const isOlderThan1Month = maxDaysOld === 31
    const isOlderThan3Months = maxDaysOld === 90
    const isOlderFilter = isOlderThan1Month || isOlderThan3Months
    const minDaysOld = isOlderThan3Months ? 90 : isOlderThan1Month ? 30 : 0

    const now = new Date()
    const minDateThreshold = new Date(now)
    minDateThreshold.setDate(now.getDate() - minDaysOld)
    const maxDateThreshold = new Date(now)
    maxDateThreshold.setDate(now.getDate() - (isOlderFilter ? 180 : maxDaysOld))

    // Map contract types to ATS employment_type values
    const atsEmploymentTypes: string[] = []
    if (contractTypes.length > 0) {
      contractTypes.forEach(ct => {
        const t = ct.toLowerCase()
        if (t === 'cdi') atsEmploymentTypes.push('full_time')
        if (t === 'cdd') atsEmploymentTypes.push('contract', 'temporary')
        if (t === 'stage') atsEmploymentTypes.push('internship')
        // Freelance = contract + temporary (ATS doesn't have "freelance" type)
        if (t === 'freelance') atsEmploymentTypes.push('contract', 'temporary')
      })
    }
    console.log(`[ATS DEBUG] Contract types requested: ${JSON.stringify(contractTypes)}`)
    console.log(`[ATS DEBUG] ATS employment types filter: ${JSON.stringify(atsEmploymentTypes)}`)

    // Map remote options to ATS workplace_type values
    const atsWorkplaceTypes: string[] = []
    if (remoteOptions.length > 0) {
      remoteOptions.forEach(ro => {
        const r = ro.toLowerCase()
        if (r === 'on-site' || r === 'on_site' || r === 'onsite') atsWorkplaceTypes.push('onsite')
        if (r === 'hybrid') atsWorkplaceTypes.push('hybrid')
        if (r === 'full remote' || r === 'remote' || r === 'full_remote') atsWorkplaceTypes.push('remote')
      })
    }

    // DEBUG: Log all employment_type values from ATS
    const employmentTypeCounts: Record<string, number> = {}
    jobs.forEach(job => {
      const et = job.employment_type || 'undefined'
      employmentTypeCounts[et] = (employmentTypeCounts[et] || 0) + 1
    })
    console.log(`[ATS DEBUG] Raw jobs: ${jobs.length}, employment_type distribution: ${JSON.stringify(employmentTypeCounts)}`)

    const filteredJobs = jobs.filter(job => {
        if (!job.title) {
          return false
        }

        // Filter by date if date_posted is available
        if (job.date_posted) {
          const jobDate = new Date(job.date_posted)
          if (isOlderFilter) {
            // For "older than X", keep only jobs older than minDaysOld
            if (jobDate > minDateThreshold) return false
          } else {
            // For "less than X", keep only jobs newer than maxDaysOld
            if (jobDate < maxDateThreshold) return false
          }
        }

        // Filter by employment type (CDI, CDD, Stage, Freelance)
        const isFreelanceSearch = contractTypes.some(ct => ct.toLowerCase() === 'freelance')
        if (atsEmploymentTypes.length > 0) {
          if (job.employment_type) {
            if (!atsEmploymentTypes.includes(job.employment_type)) {
              return false
            }
          } else {
            // For Freelance searches: STRICT - exclude undefined employment_type
            // For other searches: include undefined (be lenient)
            if (isFreelanceSearch) return false
          }
        }

        // Filter by workplace type (Remote, Hybrid, On-site)
        if (atsWorkplaceTypes.length > 0) {
          const jobWorkplace = job.workplace_type || (job.is_remote ? 'remote' : 'onsite')
          if (!atsWorkplaceTypes.includes(jobWorkplace)) return false
        }

        return true
      })

    // DEBUG: Log filtered results
    const filteredEmploymentTypeCounts: Record<string, number> = {}
    filteredJobs.forEach(job => {
      const et = job.employment_type || 'undefined'
      filteredEmploymentTypeCounts[et] = (filteredEmploymentTypeCounts[et] || 0) + 1
    })
    console.log(`[ATS DEBUG] After filtering: ${filteredJobs.length} jobs, employment_type distribution: ${JSON.stringify(filteredEmploymentTypeCounts)}`)

    return filteredJobs
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
            // Don't default to 'permanent' for undefined - let the filter include them
            contract_type: job.employment_type === 'contract' || job.employment_type === 'temporary' ? 'contract'
              : job.employment_type === 'internship' ? 'internship'
              : job.employment_type === 'full_time' ? 'permanent'
              : undefined,  // Keep undefined so filter doesn't exclude them
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
async function fetchIndeedJobs(parsedData: ParsedCV, maxDaysOld: number = 30, contractTypes: string[] = []): Promise<NormalizedJob[]> {
  // Use ALL target roles for comprehensive search
  const keywords = parsedData.target_roles.slice(0, 5)
  if (keywords.length === 0) keywords.push('developer')

  console.log(`[Indeed] Starting search with keywords: ${keywords.join(', ')}, location: ${normalizeLocation(parsedData.location)}`)

  // Handle "older than X" filters (31 = +1 month, 90 = +3 months)
  const isOlderThan1Month = maxDaysOld === 31
  const isOlderThan3Months = maxDaysOld === 90
  const isOlderFilter = isOlderThan1Month || isOlderThan3Months
  const fetchDays = isOlderThan3Months ? 180 : isOlderThan1Month ? 120 : maxDaysOld
  const minDaysOld = isOlderThan3Months ? 90 : isOlderThan1Month ? 30 : 0

  // Build job type filter for Indeed
  // Indeed API uses UPPERCASE values: FULL_TIME, PERMANENT, CONTRACT, INTERNSHIP, etc.
  let jobType: string | undefined = undefined
  let requestedContractType: string | undefined = undefined  // Track what we asked for
  if (contractTypes.length > 0) {
    const ct = contractTypes[0].toLowerCase() // Indeed only supports one job type
    if (ct === 'cdi') {
      jobType = 'PERMANENT'
      requestedContractType = 'permanent'
    }
    if (ct === 'cdd') {
      jobType = 'CONTRACT'
      requestedContractType = 'contract'
    }
    if (ct === 'stage') {
      jobType = 'INTERNSHIP'
      requestedContractType = 'internship'
    }
    // Freelance = CONTRACT in Indeed (they don't have a separate freelance type)
    if (ct === 'freelance') {
      jobType = 'CONTRACT'
      requestedContractType = 'freelance'  // But we display as "Freelance"
    }
  }
  console.log(`[Indeed DEBUG] Contract types requested: ${JSON.stringify(contractTypes)}`)
  console.log(`[Indeed DEBUG] Indeed jobType filter: ${jobType || 'none'}`)

  const input: Record<string, unknown> = {
    keywords,  // Now searches ALL roles!
    location: normalizeLocation(parsedData.location),
    country: 'France',
    datePosted: String(fetchDays), // Fetch more for "older than" filters
    maxItems: 50,  // Increased from 20
    ...(jobType && { jobType })  // Add job type filter if specified
  }

  console.log(`[Indeed] Input:`, JSON.stringify(input, null, 2))

  try {
    const jobs = await runApifyActor<IndeedJobOutput>({
      actorId: APIFY_ACTORS.INDEED_JOBS,
      input,
      timeoutSecs: 90
    })

    console.log(`[Indeed DEBUG] Raw results: ${jobs.length} jobs returned`)
    if (jobs.length > 0) {
      // Log a sample of the first 3 jobs to see their structure
      console.log(`[Indeed DEBUG] Sample jobs:`, jobs.slice(0, 3).map(j => ({
        title: j.title,
        company: j.company?.companyName,
        attributes: j.attributes
      })))
    }

    // Date threshold for "older than X" filters
    const now = new Date()
    const minDateThreshold = new Date(now)
    minDateThreshold.setDate(now.getDate() - minDaysOld)

    // Filter and map results
    return jobs
      .filter(job => {
        if (isOlderFilter && job.datePublished) {
          const jobDate = new Date(job.datePublished)
          if (jobDate > minDateThreshold) return false // Skip recent jobs
        }
        return true
      })
      .map(job => {
        // Detect remote type from job data
        const jobText = ((job.title || '') + ' ' + (job.description_text || '')).toLowerCase()
        let remoteType = 'on_site'
        if (jobText.includes('remote') || jobText.includes('télétravail') || jobText.includes('teletravail')) {
          remoteType = 'remote'
        } else if (jobText.includes('hybrid') || jobText.includes('hybride')) {
          remoteType = 'hybrid'
        }

        return {
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
            // Use the contract type we requested, or undefined if no filter
            contract_type: requestedContractType || undefined,
            remote_type: remoteType,
            salary_min: job.baseSalary_min || null,
            salary_max: job.baseSalary_max || null,
            full_description: job.description_text || ''
          },
          prefilter_score: 50
        }
      })
  } catch (error) {
    console.error('[Indeed] Error fetching jobs:', error)
    console.error('[Indeed] Error details:', JSON.stringify(error, Object.getOwnPropertyNames(error)))
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

// Normalize contract type for comparison
// Returns null for unknown/undefined types so they can be handled separately
function normalizeContractType(type: string | undefined): string | null {
  if (!type) return null  // Return null for unknown, don't assume 'cdi'
  const t = type.toLowerCase()
  if (t === 'contract' || t === 'cdd' || t === 'c' || t === 'temporary') return 'cdd'
  if (t === 'internship' || t === 'i' || t === 'stage') return 'stage'
  if (t === 'freelance' || t === 'contractor' || t === 'self-employed') return 'freelance'
  if (t === 'permanent' || t === 'cdi' || t === 'f' || t === 'full_time' || t === 'full-time') return 'cdi'
  return null  // Unknown type, don't exclude
}

// Normalize remote type for comparison
// Returns null for unknown/undefined types so they can be handled separately
function normalizeRemoteType(type: string | undefined): string | null {
  if (!type) return null  // Return null for unknown, don't assume 'on-site'
  const t = type.toLowerCase()
  if (t === 'remote' || t === 'full_remote' || t === 'fully_remote' || t === 'full remote') return 'full remote'
  if (t === 'hybrid') return 'hybrid'
  if (t === 'on-site' || t === 'on_site' || t === 'onsite') return 'on-site'
  return null  // Unknown type, don't exclude
}

// Adjust contract_type display based on user's filter selection
// If user searched for "Freelance", show "Freelance" instead of "CDD"
function getDisplayContractType(rawType: string | undefined, requestedTypes: string[]): string {
  const normalized = normalizeContractType(rawType)

  // If user explicitly searched for Freelance and job is contract/cdd type, display "Freelance"
  if (requestedTypes.some(t => t.toLowerCase() === 'freelance')) {
    if (normalized === 'cdd' || normalized === 'freelance' || rawType === 'contract') {
      return 'Freelance'
    }
  }

  // Otherwise return the normalized display value
  if (normalized === 'cdi') return 'CDI'
  if (normalized === 'cdd') return 'CDD'
  if (normalized === 'stage') return 'Stage'
  if (normalized === 'freelance') return 'Freelance'

  return rawType || 'CDI'  // Default display
}

// Filter agencies and score jobs
function filterAndScoreJobs(
  jobs: NormalizedJob[],
  parsedData: ParsedCV,
  searchId: string,
  excludeAgencies: boolean,
  contractTypes: string[] = [],
  remoteOptions: string[] = []
): NormalizedJob[] {
  let filtered = jobs

  // Filter agencies
  if (excludeAgencies) {
    filtered = filtered.filter(job => {
      const companyName = (job.company_name || '').toLowerCase()
      const description = (job.description || '').toLowerCase()
      return !RECRUITMENT_AGENCIES.some(agency => companyName.includes(agency) || description.includes(agency))
    })
  }

  // Filter by contract type (CDI, CDD, Stage, Freelance)
  if (contractTypes.length > 0) {
    const normalizedFilters = contractTypes.map(ct => ct.toLowerCase())
    const isFreelanceSearch = normalizedFilters.includes('freelance')

    // DEBUG: Log contract_type distribution BEFORE filtering
    const beforeContractTypeCounts: Record<string, number> = {}
    filtered.forEach(job => {
      const ct = (job.matching_details?.contract_type as string) || 'undefined'
      beforeContractTypeCounts[ct] = (beforeContractTypeCounts[ct] || 0) + 1
    })
    console.log(`[FILTER DEBUG] Before contract filter: ${filtered.length} jobs`)
    console.log(`[FILTER DEBUG] Contract type distribution: ${JSON.stringify(beforeContractTypeCounts)}`)
    console.log(`[FILTER DEBUG] Filtering for: ${JSON.stringify(normalizedFilters)}`)

    const beforeCount = filtered.length
    filtered = filtered.filter(job => {
      const rawContractType = job.matching_details?.contract_type as string | undefined

      // For Freelance searches: be STRICT - require explicit contract/freelance type
      // For other searches: be lenient with undefined types
      if (!rawContractType) {
        return !isFreelanceSearch  // Exclude undefined for Freelance, include for others
      }

      const jobContractType = normalizeContractType(rawContractType)

      // If normalization returned null (unknown type), same logic
      if (jobContractType === null) {
        return !isFreelanceSearch
      }

      // Map user filter values to normalized values
      const matchesFilter = normalizedFilters.some(filter => {
        if (filter === 'cdi' || filter === 'permanent') return jobContractType === 'cdi'
        if (filter === 'cdd' || filter === 'contract') return jobContractType === 'cdd'
        if (filter === 'stage' || filter === 'internship') return jobContractType === 'stage'
        // Freelance matches: freelance or cdd (contract) - NOT undefined
        if (filter === 'freelance') return jobContractType === 'freelance' || jobContractType === 'cdd'
        return false
      })
      return matchesFilter
    })

    // DEBUG: Log how many were filtered out
    const afterContractTypeCounts: Record<string, number> = {}
    filtered.forEach(job => {
      const ct = (job.matching_details?.contract_type as string) || 'undefined'
      afterContractTypeCounts[ct] = (afterContractTypeCounts[ct] || 0) + 1
    })
    console.log(`[FILTER DEBUG] After contract filter: ${filtered.length} jobs (removed ${beforeCount - filtered.length})`)
    console.log(`[FILTER DEBUG] Remaining contract types: ${JSON.stringify(afterContractTypeCounts)}`)
  }

  // Filter by remote options (On-site, Hybrid, Full remote)
  // Note: If job has unknown remote_type, we INCLUDE it (don't exclude unknown jobs)
  if (remoteOptions.length > 0) {
    const normalizedFilters = remoteOptions.map(ro => ro.toLowerCase())
    filtered = filtered.filter(job => {
      const rawRemoteType = job.matching_details?.remote_type as string | undefined

      // If job has no remote type info, include it (don't be too strict)
      if (!rawRemoteType) return true

      const jobRemoteType = normalizeRemoteType(rawRemoteType)

      // If normalization returned null (unknown type), include the job
      if (jobRemoteType === null) return true

      const matchesFilter = normalizedFilters.some(filter => {
        if (filter === 'on-site' || filter === 'on_site' || filter === 'onsite') return jobRemoteType === 'on-site'
        if (filter === 'hybrid') return jobRemoteType === 'hybrid'
        if (filter === 'full remote' || filter === 'remote' || filter === 'full_remote') return jobRemoteType === 'full remote'
        return false
      })
      return matchesFilter
    })
    console.log(`After remote filter (${remoteOptions.join(', ')}): ${filtered.length} jobs`)
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

      // Update contract_type display based on user's filter (e.g., show "Freelance" instead of "CDD")
      if (job.matching_details) {
        const rawContractType = job.matching_details.contract_type as string | undefined
        job.matching_details.contract_type = getDisplayContractType(rawContractType, contractTypes)
      }

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
    const maxDaysOld = search.max_days_old || 30  // Default to 30 days
    const contractTypes: string[] = search.contract_types || []  // CDI, CDD, Stage, Freelance
    const remoteOptions: string[] = search.remote_options || []  // On-site, Hybrid, Full remote

    // 2. Fetch jobs from all sources in parallel
    await updateStep(supabase, searchId, 'scraping')

    // Launch all scrapers in parallel (Adzuna + Indeed + ATS Jobs)
    const [adzunaJobs, indeedJobs, atsJobs] = await Promise.all([
      fetchAdzunaJobs(parsedData, maxDaysOld, contractTypes).then(jobs => {
        console.log(`[${searchId}] Adzuna: ${jobs.length} jobs`)
        return jobs
      }),
      fetchIndeedJobs(parsedData, maxDaysOld, contractTypes).then(jobs => {
        console.log(`[${searchId}] Indeed: ${jobs.length} jobs`)
        return jobs
      }),
      fetchATSJobs(parsedData, maxDaysOld, contractTypes, remoteOptions).then(jobs => {
        console.log(`[${searchId}] ATS (13 platforms): ${jobs.length} jobs`)
        return jobs
      })
    ])

    const allJobs = [...adzunaJobs, ...indeedJobs, ...atsJobs]
    console.log(`[${searchId}] Total raw jobs: ${allJobs.length}`)

    // DEBUG: Summary by source_engine
    const sourceEngineCounts: Record<string, number> = {}
    allJobs.forEach(job => {
      sourceEngineCounts[job.source_engine] = (sourceEngineCounts[job.source_engine] || 0) + 1
    })
    console.log(`[DEBUG] Jobs by source_engine: ${JSON.stringify(sourceEngineCounts)}`)

    if (allJobs.length === 0) {
      await supabase
        .from('searches')
        .update({ status: 'completed', processing_step: null })
        .eq('id', searchId)
      return NextResponse.json({ success: true, matches_inserted: 0 })
    }

    // 3. Filter and score
    await updateStep(supabase, searchId, 'filtering')
    const top50Jobs = filterAndScoreJobs(allJobs, parsedData, searchId, excludeAgencies, contractTypes, remoteOptions)
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
