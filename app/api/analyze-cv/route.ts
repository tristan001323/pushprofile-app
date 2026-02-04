import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Environment variables - loaded at runtime
const getSupabase = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL')
  }
  if (!key) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY')
  }
  return createClient(url, key)
}

const getAnthropicKey = () => process.env.ANTHROPIC_API_KEY || ''
const getAdzunaCredentials = () => ({
  appId: process.env.ADZUNA_APP_ID || '',
  appKey: process.env.ADZUNA_APP_KEY || ''
})
const getApifyApiKey = () => process.env.APIFY_API_KEY || ''

// LinkedIn job format from Apify actor RIGGeqD6RqKmlVoQU
interface LinkedInJob {
  id: string
  url: string
  title: string
  location: string
  companyName: string
  companyUrl: string
  recruiterName: string
  recruiterUrl: string
  experienceLevel: string
  contractType: string
  workType: string
  sector: string
  salary: string
  applyType: string
  applyUrl: string
  postedTimeAgo: string
  postedDate: string
  applicationsCount: string
  description: string
  descriptionHtml: string
}

// Indeed job format from Apify actor TrtlecxAsNRbKl1na
interface IndeedJob {
  key: string
  url: string
  title: string
  jobUrl: string
  datePublished: string
  location: {
    countryName: string
    countryCode: string
    city: string
  }
  employer: {
    name: string
    companyPageUrl: string
  }
  jobTypes: Record<string, string>
  baseSalary?: {
    min: number
    max: number
    unitOfWork: string
    currencyCode: string
  }
  description: {
    text: string
    html: string
  }
}

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
      'x-api-key': getAnthropicKey(),
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

  // Handle Claude API errors
  if (!response.ok || !data.content || !data.content[0]) {
    console.error('Claude CV parsing API error:', data)
    throw new Error(`Claude API error: ${data.error?.message || 'Failed to parse CV'}`)
  }

  const cvDataText = cleanJsonResponse(data.content[0].text)

  try {
    return JSON.parse(cvDataText)
  } catch (parseError) {
    console.error('Failed to parse CV JSON:', cvDataText)
    throw new Error('Failed to parse CV data from Claude')
  }
}

// 2. Build Adzuna search URLs
function buildAdzunaUrls(cvData: ParsedCV): string[] {
  const { appId, appKey } = getAdzunaCredentials()
  const skills = (cvData.skills || []).map(s => s.toLowerCase())
  const targetRole = cvData.target_roles?.[0] || 'developer'
  const location = cvData.location?.toLowerCase() || 'paris'

  const itSkills = ['javascript', 'python', 'java', 'react', 'typescript', 'node', 'php', 'ruby', 'go', 'rust', 'c++', 'c#', 'sql', 'aws', 'docker', 'git', 'angular', 'vue', 'next', 'redux', 'graphql', 'mongodb', 'postgresql', 'kubernetes', 'jenkins']
  const isTech = skills.some(s => itSkills.includes(s))

  const baseUrl = 'https://api.adzuna.com/v1/api/jobs/fr/search/1'
  const params = `?app_id=${appId}&app_key=${appKey}&results_per_page=100&where=${encodeURIComponent(location)}&distance=50&max_days_old=30`

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
      console.log('Fetching Adzuna URL:', url.replace(/app_key=[^&]+/, 'app_key=***'))
      const response = await fetch(url)
      const data = await response.json()

      if (!response.ok) {
        console.error('Adzuna API error:', data)
        continue
      }

      console.log(`Adzuna returned ${data.results?.length || 0} results for this URL`)

      if (data.results) {
        allJobs.push(...data.results)
      }
    } catch (error) {
      console.error('Error fetching from Adzuna:', error)
    }
  }

  return allJobs
}

// 3b. Fetch jobs from LinkedIn via Apify (actor RIGGeqD6RqKmlVoQU)
// Price: $0.40/1000 results + $0.001 actor start = ~$0.01 per search (20 jobs)
async function searchLinkedInJobs(
  jobTitle: string,
  location: string,
  remoteOptions?: string[],
  contractTypes?: string[],
  excludeAgencies: boolean = true
): Promise<NormalizedJob[]> {
  const apiKey = getApifyApiKey()

  if (!apiKey) {
    console.log('No Apify API key, skipping LinkedIn search')
    return []
  }

  // Map remote options to LinkedIn format
  let remoteFilter: string | undefined
  if (remoteOptions && remoteOptions.length > 0) {
    if (remoteOptions.includes('Full remote')) remoteFilter = 'Remote'
    else if (remoteOptions.includes('Hybrid')) remoteFilter = 'Hybrid'
    else if (remoteOptions.includes('On-site')) remoteFilter = 'On-site'
  }

  // Map contract types to LinkedIn format
  let contractFilter: string | undefined
  if (contractTypes && contractTypes.length > 0) {
    if (contractTypes.includes('CDI')) contractFilter = 'Full-time'
    else if (contractTypes.includes('CDD')) contractFilter = 'Contract'
    else if (contractTypes.includes('Stage')) contractFilter = 'Internship'
    else if (contractTypes.includes('Freelance')) contractFilter = 'Contract'
  }

  // Build request body for actor RIGGeqD6RqKmlVoQU
  const requestBody: Record<string, any> = {
    title: jobTitle,
    location: location,
    limit: 35,
    datePosted: 'Past month'
  }

  if (remoteFilter) requestBody.remoteType = remoteFilter
  if (contractFilter) requestBody.contractType = contractFilter

  console.log('LinkedIn search request:', JSON.stringify(requestBody, null, 2))

  try {
    // Use AbortController for timeout (60 seconds)
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 60000)

    const response = await fetch(
      `https://api.apify.com/v2/acts/RIGGeqD6RqKmlVoQU/run-sync-get-dataset-items?token=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      }
    )

    clearTimeout(timeoutId)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Apify API error:', response.status, errorText)
      return []
    }

    const linkedInJobs: LinkedInJob[] = await response.json()
    console.log(`LinkedIn returned ${linkedInJobs.length} jobs`)

    // Filter out recruitment agencies
    let filteredJobs = linkedInJobs
    if (excludeAgencies) {
      const beforeCount = filteredJobs.length
      filteredJobs = linkedInJobs.filter(job => {
        const companyName = (job.companyName || '').toLowerCase()
        const description = (job.description || '').toLowerCase()
        return !RECRUITMENT_AGENCIES.some(agency =>
          companyName.includes(agency) || description.includes(agency)
        )
      })
      console.log(`Filtered ${beforeCount - filteredJobs.length} LinkedIn jobs from recruitment agencies`)
    }

    // Normalize to our format
    const normalizedJobs: NormalizedJob[] = filteredJobs.map(job => {
      // Parse contract type
      let contractType = 'permanent'
      if (job.contractType) {
        const ct = job.contractType.toLowerCase()
        if (ct.includes('contract') || ct.includes('temporary')) {
          contractType = 'contract'
        } else if (ct.includes('internship')) {
          contractType = 'internship'
        } else if (ct.includes('part-time')) {
          contractType = 'part_time'
        }
      }

      // Determine remote type from job data
      let remoteType = 'on_site'
      const jobText = (job.title + ' ' + job.location + ' ' + (job.workType || '')).toLowerCase()
      if (jobText.includes('remote') || jobText.includes('télétravail')) {
        remoteType = 'remote'
      } else if (jobText.includes('hybrid') || jobText.includes('hybride')) {
        remoteType = 'hybrid'
      }

      // Parse salary if available
      let salaryMin: number | null = null
      let salaryMax: number | null = null
      if (job.salary) {
        const salaryMatch = job.salary.match(/\$?([\d,]+)/g)
        if (salaryMatch && salaryMatch.length >= 1) {
          salaryMin = parseInt(salaryMatch[0].replace(/[,$]/g, ''))
          if (salaryMatch.length >= 2) {
            salaryMax = parseInt(salaryMatch[1].replace(/[,$]/g, ''))
          }
        }
      }

      // Use applyUrl or url
      const finalUrl = job.applyUrl || job.url

      return {
        search_id: '', // Will be set later
        external_id: `linkedin_${job.id}`,
        source: 'linkedin',
        job_url: finalUrl,
        job_title: job.title,
        company_name: job.companyName || 'Unknown',
        location: job.location || 'Remote',
        description: (job.description || '').substring(0, 2000),
        posted_date: job.postedDate || null,
        matching_details: {
          contract_type: contractType,
          remote_type: remoteType,
          salary_min: salaryMin,
          salary_max: salaryMax,
          full_description: job.description || '',
          recruiter_name: job.recruiterName || null,
          recruiter_url: job.recruiterUrl || null
        },
        prefilter_score: 50 // Base score, will be recalculated
      }
    })

    return normalizedJobs

  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.log('LinkedIn search timed out after 60s, continuing without LinkedIn')
    } else {
      console.error('Error fetching LinkedIn jobs:', error)
    }
    return []
  }
}

// 3c. Fetch jobs from Indeed via Apify (actor TrtlecxAsNRbKl1na)
// Price: $0.001 actor start + $0.1/1000 results = ~$0.005 per search (35 jobs)
async function searchIndeedJobs(
  jobTitle: string,
  location: string,
  excludeAgencies: boolean = true
): Promise<NormalizedJob[]> {
  const apiKey = getApifyApiKey()

  if (!apiKey) {
    console.log('No Apify API key, skipping Indeed search')
    return []
  }

  // Build request body for actor TrtlecxAsNRbKl1na
  const requestBody: Record<string, any> = {
    title: jobTitle,
    location: location,
    maxResults: 35,
    datePosted: '14 days'
  }

  console.log('Indeed search request:', JSON.stringify(requestBody, null, 2))

  try {
    // Use AbortController for timeout (60 seconds)
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 60000)

    const response = await fetch(
      `https://api.apify.com/v2/acts/TrtlecxAsNRbKl1na/run-sync-get-dataset-items?token=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      }
    )

    clearTimeout(timeoutId)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Indeed Apify API error:', response.status, errorText)
      return []
    }

    const indeedJobs: IndeedJob[] = await response.json()
    console.log(`Indeed returned ${indeedJobs.length} jobs`)

    // Filter out recruitment agencies
    let filteredJobs = indeedJobs
    if (excludeAgencies) {
      const beforeCount = filteredJobs.length
      filteredJobs = indeedJobs.filter(job => {
        const companyName = (job.employer?.name || '').toLowerCase()
        const description = (job.description?.text || '').toLowerCase()
        return !RECRUITMENT_AGENCIES.some(agency =>
          companyName.includes(agency) || description.includes(agency)
        )
      })
      console.log(`Filtered ${beforeCount - filteredJobs.length} Indeed jobs from recruitment agencies`)
    }

    // Normalize to our format
    const normalizedJobs: NormalizedJob[] = filteredJobs.map(job => {
      // Determine contract type from jobTypes
      let contractType = 'permanent'
      const jobTypesStr = Object.values(job.jobTypes || {}).join(' ').toLowerCase()
      if (jobTypesStr.includes('contract') || jobTypesStr.includes('temporary')) {
        contractType = 'contract'
      } else if (jobTypesStr.includes('internship')) {
        contractType = 'internship'
      } else if (jobTypesStr.includes('part-time')) {
        contractType = 'part_time'
      }

      // Determine remote type
      let remoteType = 'on_site'
      const locationStr = (job.location?.city || '') + ' ' + (job.title || '')
      if (locationStr.toLowerCase().includes('remote')) {
        remoteType = 'remote'
      } else if (locationStr.toLowerCase().includes('hybrid')) {
        remoteType = 'hybrid'
      }

      // Use direct job URL if available, otherwise Indeed URL
      const finalUrl = job.jobUrl || job.url

      // Format location string
      const locationDisplay = job.location?.city
        ? `${job.location.city}, ${job.location.countryCode || ''}`
        : 'Remote'

      return {
        search_id: '', // Will be set later
        external_id: `indeed_${job.key}`,
        source: 'indeed',
        job_url: finalUrl,
        job_title: job.title,
        company_name: job.employer?.name || 'Unknown',
        location: locationDisplay,
        description: (job.description?.text || '').substring(0, 2000),
        posted_date: job.datePublished ? job.datePublished.split('T')[0] : null,
        matching_details: {
          contract_type: contractType,
          remote_type: remoteType,
          salary_min: job.baseSalary?.min || null,
          salary_max: job.baseSalary?.max || null,
          full_description: job.description?.text || ''
        },
        prefilter_score: 50 // Base score, will be recalculated
      }
    })

    return normalizedJobs

  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.log('Indeed search timed out after 60s, continuing without Indeed')
    } else {
      console.error('Error fetching Indeed jobs:', error)
    }
    return []
  }
}

// 4. Prefilter and score jobs
function prefilterJobs(jobs: Job[], cvData: ParsedCV, searchId: string, excludeAgencies: boolean = true): NormalizedJob[] {
  // Filter out recruitment agencies if enabled (using shared list)
  let filteredJobs = jobs
  if (excludeAgencies) {
    filteredJobs = jobs.filter(job => {
      const companyName = (job.company?.display_name || '').toLowerCase()
      const description = (job.description || '').toLowerCase()
      // Check both company name and description for agencies
      return !RECRUITMENT_AGENCIES.some(agency =>
        companyName.includes(agency) || description.includes(agency)
      )
    })
    console.log(`Filtered ${jobs.length - filteredJobs.length} jobs from recruitment agencies`)
  }

  // Filter out business/sales roles for tech profiles
  const isTechProfile = cvData.skills.some(skill => {
    const techSkills = ['javascript', 'python', 'java', 'react', 'typescript', 'node', 'php', 'ruby', 'go', 'rust', 'c++', 'c#', 'sql', 'aws', 'docker', 'git', 'angular', 'vue', 'next', 'redux', 'graphql', 'mongodb', 'postgresql']
    return techSkills.includes(skill.toLowerCase())
  })

  filteredJobs = isTechProfile
    ? filteredJobs.filter(job => {
        const title = job.title.toLowerCase()
        return !(
          title.includes('business developer') ||
          title.includes('business development') ||
          title.includes('account manager') ||
          title.includes('sales')
        )
      })
    : filteredJobs

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
      'x-api-key': getAnthropicKey(),
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

  // Handle Claude API errors
  if (!response.ok || !data.content || !data.content[0]) {
    console.error('Claude scoring API error:', data)
    throw new Error(`Claude API error: ${data.error?.message || 'Unknown error'}`)
  }

  let scoresText = data.content[0].text
  scoresText = scoresText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

  try {
    return JSON.parse(scoresText)
  } catch (parseError) {
    console.error('Failed to parse Claude scoring response:', scoresText)
    throw new Error('Failed to parse job scores from Claude')
  }
}

// Helper: Calculate next run date based on recurrence
function calculateNextRunAt(recurrence: string): string | null {
  if (!recurrence) return null

  const now = new Date()
  let nextRun = new Date(now)

  switch (recurrence) {
    case '2days':
      nextRun.setDate(now.getDate() + 2)
      break
    case '4days':
      nextRun.setDate(now.getDate() + 4)
      break
    case 'weekly':
      nextRun.setDate(now.getDate() + 7)
      break
    case 'biweekly':
      nextRun.setDate(now.getDate() + 14)
      break
    case 'monthly':
      nextRun.setMonth(now.getMonth() + 1)
      break
    default:
      return null
  }

  // Set to 9:00 AM on weekday
  nextRun.setHours(9, 0, 0, 0)

  // Skip weekends
  const day = nextRun.getDay()
  if (day === 0) nextRun.setDate(nextRun.getDate() + 1) // Sunday -> Monday
  if (day === 6) nextRun.setDate(nextRun.getDate() + 2) // Saturday -> Monday

  return nextRun.toISOString()
}

// Build parsed data from standard criteria (no CV)
function buildFromStandardCriteria(body: any): ParsedCV {
  const { job_title, location, seniority, brief, contract_types, remote_options } = body

  // Extract skills from brief
  const skills: string[] = []
  if (brief) {
    // Common tech skills to extract
    const techKeywords = ['react', 'vue', 'angular', 'node', 'nodejs', 'python', 'java', 'javascript', 'typescript', 'php', 'ruby', 'go', 'rust', 'c++', 'c#', 'sql', 'aws', 'docker', 'kubernetes', 'git', 'graphql', 'mongodb', 'postgresql', 'mysql', 'redis', 'django', 'spring', 'express', 'nextjs', 'next.js', 'tailwind', 'sass', 'css', 'html', 'flutter', 'swift', 'kotlin', 'android', 'ios', 'figma', 'sketch', 'agile', 'scrum', 'devops', 'ci/cd', 'terraform', 'jenkins', 'linux', 'api', 'rest', 'microservices']

    const briefLower = brief.toLowerCase()
    techKeywords.forEach(skill => {
      if (briefLower.includes(skill)) {
        skills.push(skill)
      }
    })

    // If no tech skills found, use brief words as skills
    if (skills.length === 0) {
      const words = brief.split(/[,;.\s]+/).filter((w: string) => w.length > 2)
      skills.push(...words.slice(0, 10))
    }
  }

  return {
    target_roles: job_title ? [job_title] : ['developer'],
    skills: skills,
    experience_years: seniority === 'junior' ? 1 : seniority === 'confirmé' ? 3 : seniority === 'senior' ? 7 : seniority === 'expert' ? 12 : 3,
    location: location || 'France',
    seniority: seniority || 'confirmé',
    education: '',
    languages: ['Français']
  }
}

// Build Adzuna URLs from standard criteria (more direct approach)
function buildAdzunaUrlsFromCriteria(body: any): string[] {
  const { appId, appKey } = getAdzunaCredentials()
  const { job_title, location, contract_types, remote_options, brief } = body

  const baseUrl = 'https://api.adzuna.com/v1/api/jobs/fr/search/1'
  const locationParam = location || 'france'
  const params = `?app_id=${appId}&app_key=${appKey}&results_per_page=100&where=${encodeURIComponent(locationParam)}&distance=50&max_days_old=30`

  const urls: string[] = []

  // Main search by job title
  if (job_title) {
    urls.push(baseUrl + params + `&what=${encodeURIComponent(job_title)}`)
  }

  // Check if it's a tech role
  const techRoles = ['developer', 'développeur', 'dev', 'engineer', 'ingénieur', 'frontend', 'backend', 'fullstack', 'devops', 'data', 'product', 'designer', 'ux', 'ui']
  const isTechRole = job_title && techRoles.some(role => job_title.toLowerCase().includes(role))

  if (isTechRole || (!job_title && brief)) {
    // Add IT category search
    urls.push(baseUrl + params + '&category=it-jobs')
  }

  // Add searches based on brief/skills
  if (brief) {
    const topSkills = ['react', 'python', 'typescript', 'node', 'java', 'php', 'angular', 'vue', 'django', 'spring', 'devops', 'data']
    const briefLower = brief.toLowerCase()
    const matchedSkills = topSkills.filter(skill => briefLower.includes(skill)).slice(0, 2)

    matchedSkills.forEach(skill => {
      urls.push(baseUrl + params + `&what=${encodeURIComponent(skill)}`)
    })
  }

  // Fallback if no URLs generated
  if (urls.length === 0) {
    urls.push(baseUrl + params + '&category=it-jobs')
  }

  return urls
}

// Main API handler
export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabase()
    const body = await request.json()
    const { cv_text, user_id, name, search_type, filename, recurrence, job_title, location, seniority, brief, contract_types, remote_options, exclude_agencies } = body

    // Validation: need either CV or standard criteria
    const hasCV = cv_text && cv_text.trim().length > 0
    const hasStandardCriteria = job_title || location || brief

    if (!hasCV && !hasStandardCriteria) {
      return NextResponse.json({ error: 'Veuillez fournir un CV ou des critères de recherche' }, { status: 400 })
    }

    let parsedData: ParsedCV

    // Determine how to get parsed data based on search type
    if (hasCV && (search_type === 'cv' || search_type === 'both')) {
      // Parse CV with Claude
      console.log('Parsing CV with Claude...')
      parsedData = await parseCV(cv_text)

      // If "both" mode, merge with standard criteria (standard criteria override CV data)
      if (search_type === 'both' && hasStandardCriteria) {
        console.log('Merging CV data with standard criteria...')
        if (job_title) parsedData.target_roles = [job_title, ...parsedData.target_roles]
        if (location) parsedData.location = location
        if (seniority) parsedData.seniority = seniority
        if (brief) {
          const additionalSkills = brief.split(/[,;.\s]+/).filter((w: string) => w.length > 2)
          parsedData.skills = [...new Set([...parsedData.skills, ...additionalSkills])]
        }
      }
    } else {
      // Standard search - build from criteria
      console.log('Building search from standard criteria...')
      parsedData = buildFromStandardCriteria(body)
    }

    // Generate search name if not provided
    const searchName = name || `${parsedData.target_roles[0] || 'Profil'} - ${parsedData.location || 'France'}`

    // 2. Save search to Supabase
    console.log('Saving search...')
    const { data: searchData, error: searchError } = await supabase
      .from('searches')
      .insert({
        user_id: user_id,
        name: searchName,
        search_type: search_type || 'cv',
        job_title: parsedData.target_roles[0] || null,
        location: parsedData.location || null,
        seniority: parsedData.seniority || null,
        brief: parsedData.skills.join(', ') || null,
        cv_text: cv_text,
        parsed_data: parsedData,
        status: 'processing',
        recurrence: recurrence || null,
        is_recurrence_active: recurrence ? true : false,
        next_run_at: calculateNextRunAt(recurrence)
      })
      .select()
      .single()

    if (searchError) {
      console.error('Supabase search error:', searchError)
      return NextResponse.json({
        error: `Failed to save search: ${searchError.message || searchError.code || 'Unknown error'}`
      }, { status: 500 })
    }

    const searchId = searchData.id

    // 3. Fetch jobs from Adzuna, LinkedIn, and Indeed in parallel
    console.log('Fetching jobs from Adzuna, LinkedIn, and Indeed...')

    // Build Adzuna URLs
    const urls = (search_type === 'standard' && !hasCV)
      ? buildAdzunaUrlsFromCriteria(body)
      : buildAdzunaUrls(parsedData)

    console.log(`Built ${urls.length} Adzuna search URLs for type: ${search_type}`)

    const searchJobTitle = parsedData.target_roles[0] || job_title || 'developer'
    const searchLocation = parsedData.location || location || 'France'

    // Fetch from all 3 sources in parallel
    const [adzunaJobs, linkedInJobs, indeedJobs] = await Promise.all([
      fetchAdzunaJobs(urls),
      searchLinkedInJobs(
        searchJobTitle,
        searchLocation,
        remote_options,
        contract_types,
        exclude_agencies !== false
      ),
      searchIndeedJobs(
        searchJobTitle,
        searchLocation,
        exclude_agencies !== false
      )
    ])

    console.log(`Found ${adzunaJobs.length} jobs from Adzuna`)
    console.log(`Found ${linkedInJobs.length} jobs from LinkedIn`)
    console.log(`Found ${indeedJobs.length} jobs from Indeed`)
    console.log('Parsed CV data:', JSON.stringify(parsedData, null, 2))

    const totalJobsFound = adzunaJobs.length + linkedInJobs.length + indeedJobs.length

    if (totalJobsFound === 0) {
      // Update search status to completed with no results
      await supabase
        .from('searches')
        .update({ status: 'completed' })
        .eq('id', searchId)

      return NextResponse.json({
        success: true,
        search_id: searchId,
        matches_inserted: 0,
        debug: {
          reason: 'No jobs found from any source',
          parsed_cv: parsedData,
          urls_tried: urls
        }
      })
    }

    // 4. Prefilter Adzuna jobs
    console.log('Prefiltering Adzuna jobs...')
    const prefilteredAdzuna = prefilterJobs(adzunaJobs, parsedData, searchId, exclude_agencies !== false)
    console.log(`Prefiltered Adzuna to ${prefilteredAdzuna.length} relevant jobs`)

    // 4b. Score LinkedIn and Indeed jobs
    const scoreExternalJob = (job: NormalizedJob) => {
      job.search_id = searchId
      let score = 50 // Base score

      const jobText = (job.job_title + ' ' + job.description).toLowerCase()
      const cvSkills = (parsedData.skills || []).map(s => s.toLowerCase())

      // Skill matching
      let skillMatches = 0
      cvSkills.forEach(skill => {
        if (jobText.includes(skill)) skillMatches++
      })
      if (cvSkills.length > 0) {
        score += (skillMatches / cvSkills.length) * 30
      }

      // Location matching
      const cvLocation = (parsedData.location || '').toLowerCase()
      if (job.location.toLowerCase().includes(cvLocation) || cvLocation.includes(job.location.toLowerCase().split(',')[0])) {
        score += 10
      }

      job.prefilter_score = Math.round(score)
    }

    linkedInJobs.forEach(scoreExternalJob)
    indeedJobs.forEach(scoreExternalJob)

    // 4c. Combine and deduplicate jobs from all sources
    const combinedJobs = [...prefilteredAdzuna, ...linkedInJobs, ...indeedJobs]

    // Deduplicate across sources
    const seen = new Map<string, boolean>()
    const top50Jobs: NormalizedJob[] = []

    for (const job of combinedJobs.sort((a, b) => (b.prefilter_score || 0) - (a.prefilter_score || 0))) {
      const normalizedTitle = job.job_title.toLowerCase().replace(/[^a-z0-9]/g, '')
      const normalizedCompany = job.company_name.toLowerCase().replace(/[^a-z0-9]/g, '')
      const key = `${normalizedTitle}_${normalizedCompany}`

      if (!seen.has(key)) {
        seen.set(key, true)
        top50Jobs.push(job)
        if (top50Jobs.length >= 50) break
      }
    }

    console.log(`Combined and deduplicated to ${top50Jobs.length} jobs (${prefilteredAdzuna.length} Adzuna + ${linkedInJobs.length} LinkedIn + ${indeedJobs.length} Indeed)`)

    if (top50Jobs.length === 0) {
      await supabase
        .from('searches')
        .update({ status: 'completed' })
        .eq('id', searchId)

      return NextResponse.json({
        success: true,
        search_id: searchId,
        matches_inserted: 0,
        debug: {
          reason: 'All jobs filtered out by prefilter',
          total_from_adzuna: adzunaJobs.length,
          total_from_linkedin: linkedInJobs.length,
          total_from_indeed: indeedJobs.length,
          parsed_cv: parsedData
        }
      })
    }

    // 4d. Résoudre les URLs directes pour Adzuna seulement (en parallèle pour les 20 premiers)
    console.log('Resolving direct job URLs for Adzuna jobs...')
    const urlPromises = top50Jobs
      .filter(job => job.source === 'adzuna')
      .slice(0, 20)
      .map(async (job) => {
        const directUrl = await getDirectJobUrl(job.job_url)
        job.job_url = directUrl
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

    // 7. Check for existing matches to avoid duplicates (important for recurrence)
    console.log('Checking for duplicates...')
    const { data: existingMatches } = await supabase
      .from('matches')
      .select('external_id, job_title, company_name')
      .eq('search_id', searchId)

    // Create a Set of existing job identifiers
    const existingJobKeys = new Set<string>()
    if (existingMatches) {
      existingMatches.forEach(match => {
        // Use external_id as primary key, fallback to title+company
        if (match.external_id) {
          existingJobKeys.add(match.external_id)
        }
        existingJobKeys.add(`${match.job_title?.toLowerCase()}_${match.company_name?.toLowerCase()}`)
      })
    }

    // Filter out duplicates
    const newMatches = allMatches.filter(match => {
      const externalIdExists = match.external_id && existingJobKeys.has(match.external_id)
      const titleCompanyKey = `${match.job_title?.toLowerCase()}_${match.company_name?.toLowerCase()}`
      const titleCompanyExists = existingJobKeys.has(titleCompanyKey)
      return !externalIdExists && !titleCompanyExists
    })

    console.log(`Filtered ${allMatches.length - newMatches.length} duplicates, inserting ${newMatches.length} new matches`)

    // 8. Save new matches to Supabase
    console.log('Saving matches...')
    if (newMatches.length > 0) {
      const { error: matchesError } = await supabase
        .from('matches')
        .insert(newMatches)

      if (matchesError) {
        console.error('Supabase matches error:', matchesError)
      }
    }

    // 9. Update search status to completed
    await supabase
      .from('searches')
      .update({ status: 'completed' })
      .eq('id', searchId)

    console.log('Done!')

    return NextResponse.json({
      success: true,
      search_id: searchId,
      matches_inserted: newMatches.length,
      duplicates_skipped: allMatches.length - newMatches.length
    })

  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'An error occurred'
    }, { status: 500 })
  }
}
