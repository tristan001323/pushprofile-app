/**
 * Apify API Helper
 *
 * Generic helper to call Apify actors for job scraping.
 * All scrapers use the same pattern: POST run -> wait -> fetch dataset items.
 */

const getApifyToken = () => process.env.APIFY_API_KEY || ''

const APIFY_BASE = 'https://api.apify.com/v2'

// Actor IDs for all scrapers
export const APIFY_ACTORS = {
  // Job scrapers (cheap_scraper)
  LINKEDIN_JOBS: '2rJKkhh7vjpX7pvjg',    // cheap_scraper/linkedin-job-scraper - $0.70/1000
  INDEED_JOBS: 'nlZZi3lZre4fM9IET',      // cheap_scraper/indeed-scraper - $1.00/1000
  GLASSDOOR_JOBS: 'bYSAbQqxwImLaf2nb',   // cheap_scraper/glassdoor-jobs-scraper - $1.00/1000

  // WTTJ scraper (shahidirfan)
  WTTJ_JOBS: 'TtyMcBQsSh3wzxbl9',        // shahidirfan/jungle-job-scraper - ~$0.003/job

  // Company Intelligence (saswave) - $15/month + usage
  WTTJ_COMPANY: 'OdeZQS0Wd7OV62KFe',     // saswave/welcome-to-the-jungle-scraper

  // Contact enrichment - Decision Maker Email Finder
  DECISION_MAKER_FINDER: '0d92bM36riVMXNvp3',  // snipercoder/decision-maker-email-finder - $1.00/1000

  // LinkedIn Company scraper
  LINKEDIN_COMPANY: 'UwSdACBp7ymaGUJjS',  // harvest_api/linkedin-company-scraper

  // Employee scraping
  LINKEDIN_EMPLOYEES: 'Vb6LZkh4EqRlR0Ka9', // harvestapi/linkedin-company-employees - $8/1000

  // LinkedIn Profile scraper (harvestapi) - $4/1000 profiles (details only, no email)
  LINKEDIN_PROFILE: 'LpVuK3Zozwuipa5bp',  // harvestapi/linkedin-profile-details
}

interface ApifyRunOptions {
  actorId: string
  input: Record<string, unknown>
  timeoutSecs?: number
}

interface ApifyRunResponse {
  data: {
    id: string
    status: string
    defaultDatasetId: string
  }
}

/**
 * Run an Apify actor and wait for results
 * Uses sync endpoint with timeout, falls back to async polling if needed
 */
export async function runApifyActor<T = unknown>({
  actorId,
  input,
  timeoutSecs = 120
}: ApifyRunOptions): Promise<T[]> {
  const token = getApifyToken()

  if (!token) {
    console.log('No Apify API token, skipping actor run')
    return []
  }

  console.log(`Running Apify actor ${actorId} with input:`, JSON.stringify(input, null, 2))

  try {
    // Use AbortController for client-side timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutSecs * 1000)

    // Try sync endpoint first (faster for quick runs)
    const response = await fetch(
      `${APIFY_BASE}/acts/${actorId}/run-sync-get-dataset-items?token=${token}&timeout=${timeoutSecs}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
        signal: controller.signal
      }
    )

    clearTimeout(timeoutId)

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`Apify actor ${actorId} error:`, response.status, errorText)
      return []
    }

    const items: T[] = await response.json()
    console.log(`Apify actor ${actorId} returned ${items.length} items`)
    return items

  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.log(`Apify actor ${actorId} timed out after ${timeoutSecs}s`)
    } else {
      console.error(`Error running Apify actor ${actorId}:`, error)
    }
    return []
  }
}

/**
 * Run an Apify actor asynchronously with polling
 * Better for long-running tasks that might exceed sync timeout
 */
export async function runApifyActorAsync<T = unknown>({
  actorId,
  input,
  timeoutSecs = 300
}: ApifyRunOptions): Promise<T[]> {
  const token = getApifyToken()

  if (!token) {
    console.log('No Apify API token, skipping actor run')
    return []
  }

  console.log(`Running Apify actor ${actorId} (async) with input:`, JSON.stringify(input, null, 2))

  try {
    // 1. Start the run
    const startResponse = await fetch(
      `${APIFY_BASE}/acts/${actorId}/runs?token=${token}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input)
      }
    )

    if (!startResponse.ok) {
      const errorText = await startResponse.text()
      console.error(`Failed to start Apify actor ${actorId}:`, startResponse.status, errorText)
      return []
    }

    const runData: ApifyRunResponse = await startResponse.json()
    const runId = runData.data.id
    const datasetId = runData.data.defaultDatasetId

    console.log(`Apify run started: ${runId}, polling for completion...`)

    // 2. Poll for completion
    const startTime = Date.now()
    const pollInterval = 5000 // 5 seconds

    while (Date.now() - startTime < timeoutSecs * 1000) {
      await new Promise(resolve => setTimeout(resolve, pollInterval))

      const statusResponse = await fetch(
        `${APIFY_BASE}/actor-runs/${runId}?token=${token}`
      )

      if (!statusResponse.ok) {
        console.error(`Failed to get run status: ${statusResponse.status}`)
        continue
      }

      const statusData = await statusResponse.json()
      const status = statusData.data.status

      if (status === 'SUCCEEDED') {
        console.log(`Apify run ${runId} completed successfully`)
        break
      } else if (status === 'FAILED' || status === 'ABORTED' || status === 'TIMED-OUT') {
        console.error(`Apify run ${runId} ended with status: ${status}`)
        return []
      }

      console.log(`Apify run ${runId} status: ${status}, waiting...`)
    }

    // 3. Fetch results from dataset
    const itemsResponse = await fetch(
      `${APIFY_BASE}/datasets/${datasetId}/items?token=${token}`
    )

    if (!itemsResponse.ok) {
      console.error(`Failed to fetch dataset items: ${itemsResponse.status}`)
      return []
    }

    const items: T[] = await itemsResponse.json()
    console.log(`Apify actor ${actorId} returned ${items.length} items`)
    return items

  } catch (error) {
    console.error(`Error running Apify actor ${actorId} (async):`, error)
    return []
  }
}

// ============================================
// Type definitions for each scraper's output
// ============================================

// LinkedIn Jobs (cheap_scraper)
export interface LinkedInJobOutput {
  jobId: string
  jobTitle: string
  location: string
  salaryInfo?: string[]
  postedTime: string
  publishedAt: string
  searchString: string
  jobUrl: string
  companyName: string
  companyUrl: string
  companyLogo?: string
  jobDescription: string
  applicationsCount?: string
  contractType?: string
  experienceLevel?: string
  workType?: string
  sector?: string
  posterFullName?: string
  posterProfileUrl?: string
  companyId?: string
  applyUrl?: string
  applyType?: string
  companyAddress?: {
    streetAddress?: string
    addressLocality?: string
    addressRegion?: string
    postalCode?: string
    addressCountry?: string
  }
  companyDescription?: string
  companyEmployeeCount?: number
  companyWebsite?: string
}

// Indeed Jobs (cheap_scraper)
export interface IndeedJobOutput {
  key: string
  title: string
  normalizedTitle?: string
  jobCategory?: string
  jobUrl: string
  datePublished: string
  dateScraped?: string
  searchKeyword?: string
  location: {
    streetAddress?: string
    city: string
    state?: string
    country: string
    postalCode?: string
  }
  baseSalary_min?: number
  baseSalary_max?: number
  salary_period?: string
  salary_currency?: string
  applyUrl?: string
  company: {
    companyName: string
    companyShortName?: string
    companyPageUrl?: string
    logoImgUrl?: string
    companyAddress?: string
    companyType?: string
    estimatedEmployeeCount?: string
    estimatedRevenue?: string
    industryType?: string
    industrySector?: string
    corporateLink?: string
    ceoName?: string
    ceoPhotoUrl?: string
  }
  attributes?: string[]
  description_text: string
  description_html?: string
}

// Glassdoor Jobs (cheap_scraper)
export interface GlassdoorJobOutput {
  key: string
  title: string
  normalizedTitle?: string
  jobCategory?: string
  jobUrl: string
  isEasyApply?: boolean
  expired?: boolean
  isSponsored?: boolean
  jobRating?: number
  ageInDays?: number
  datePublished: string
  dateScraped?: string
  educationRequired?: string[]
  experienceRequired?: string[]
  searchKeyword?: string
  location_city: string
  location_state?: string
  location_country: string
  location_postalCode?: string
  location_latitude?: number
  location_longitude?: number
  jobTypes?: string[]
  remoteWorkTypes?: string[]
  baseSalary_min?: number
  baseSalary_max?: number
  baseSalary_median?: number
  salary_period?: string
  salary_currency?: string
  salarySource?: string
  applyUrl?: string
  company: {
    companyName: string
    companyShortName?: string
    companyPageUrl?: string
    logoImgUrl?: string
    companyAddress?: string
    companyType?: string
    companyYearFounded?: number
    estimatedEmployeeCount?: string
    companySizeCategory?: string
    estimatedRevenue?: string
    industryType?: string
    industrySector?: string
    corporateLink?: string
    overallRating?: number
    workLifeBalanceRating?: number
    compensationAndBenefitsRating?: number
    managementRating?: number
    cultureAndValuesRating?: number
    careerOpportunitiesRating?: number
    ceoRating?: number
    ceoRatingsCount?: number
    recommendToFriendRating?: number
    totalReviews?: number
    reviews?: Array<{
      title: string
      pros: string
      cons: string
      advice?: string
      overallRating: number
    }>
  }
  attributes?: string[]
  searchUrl?: string
  description_text: string
  description_html?: string
}

// WTTJ Jobs (shahidirfan)
export interface WTTJJobOutput {
  title: string
  company: string
  company_slug?: string
  location: string
  country?: string
  contract_type: string
  remote?: string
  salary?: string
  date_posted?: string
  description_html?: string
  description_text?: string
  url: string
  job_id?: string
}

// WTTJ Company (saswave)
export interface WTTJCompanyOutput {
  organization_url: string
  name: string
  descriptions?: Array<{
    title: string
    body: string
  }>
  reference?: string
  slug?: string
  jobs_count?: number
  size?: string
  sectors?: Array<{
    name: string
    parent_name: string
  }>
  offices?: Array<{
    address: string
    city: string
    country_code: string
  }>
  logo?: string
  nb_employees?: number
  average_age?: number
  creation_year?: number
  parity_men?: number
  parity_women?: number
  technos_list?: string[]
  social_networks?: {
    facebook?: string
    instagram?: string
    linkedin?: string
    twitter?: string
    youtube?: string
  }
  website?: string
  jobs?: Array<{
    slug: string
    name: string
    contract_type: string
    remote?: string
    published_at?: string
  }>
}

// Decision Maker Email Finder (snipercoder)
export interface DecisionMakerOutput {
  name?: string
  email?: string
  title?: string
  company?: string
  linkedin?: string
  phone?: string
  domain?: string
}

// LinkedIn Employees (harvestapi)
export interface LinkedInEmployeeOutput {
  name: string
  job_title: string
  linkedin_url: string
  profile_picture?: string
  location?: string
  summary?: string
  start_date?: string
  work_experience?: Array<{
    company: string
    title: string
    start_date: string
    end_date?: string
    duration?: string
    description?: string
  }>
  education?: Array<{
    school: string
    degree?: string
    field?: string
    start_date?: string
    end_date?: string
  }>
  skills?: string[]
}

// LinkedIn Profile Details (harvestapi) - $4/1000 profiles
export interface LinkedInProfileOutput {
  id: string
  publicIdentifier: string
  linkedinUrl: string
  firstName: string
  lastName: string
  headline: string
  about?: string
  photo?: string
  location?: {
    linkedinText: string
    countryCode?: string
    parsed?: {
      text: string
      country?: string
      state?: string
      city?: string
    }
  }
  premium?: boolean
  openToWork?: boolean
  hiring?: boolean
  verified?: boolean
  connectionsCount?: number
  followerCount?: number
  topSkills?: string
  currentPosition?: Array<{
    companyName: string
  }>
  experience?: Array<{
    position: string
    companyName: string
    companyLinkedinUrl?: string
    location?: string
    employmentType?: string
    workplaceType?: string
    duration?: string
    description?: string
    skills?: string[]
    startDate?: { month?: string; year?: number; text?: string }
    endDate?: { month?: string; year?: number; text?: string }
  }>
  education?: Array<{
    schoolName: string
    schoolLinkedinUrl?: string
    degree?: string
    fieldOfStudy?: string
    period?: string
    startDate?: { month?: string; year?: number; text?: string }
    endDate?: { month?: string; year?: number; text?: string }
  }>
  skills?: Array<{
    name: string
    endorsements?: string
  }>
  certifications?: Array<{
    title: string
    issuedAt?: string
    issuedBy?: string
  }>
  languages?: Array<{
    name: string
    proficiency?: string
  }>
  projects?: Array<{
    title: string
    description?: string
    duration?: string
  }>
  publications?: Array<{
    title: string
    publishedAt?: string
    link?: string
  }>
  status: number
}

// LinkedIn Company (harvest_api/linkedin-company-scraper)
export interface LinkedInCompanyOutput {
  id: string
  universalName: string
  linkedinUrl: string
  name: string
  tagline?: string
  website?: string
  logo?: string
  foundedOn?: { year: number }
  employeeCount?: number
  employeeCountRange?: { start: number; end?: number }
  followerCount?: number
  description?: string
  companyType?: string
  locations?: Array<{
    country: string
    geographicArea?: string
    city?: string
    line1?: string
    line2?: string
    postalCode?: string
    headquarter?: boolean
    description?: string
    parsed?: {
      text: string
      countryCode?: string
      country?: string
      state?: string
      city?: string
    }
  }>
  specialities?: string[]
  industries?: string[]
  logos?: Array<{
    url: string
    width: number
    height: number
  }>
  backgroundCovers?: Array<{
    url: string
    width: number
    height: number
  }>
  phone?: string
  fundingData?: {
    numFundingRounds?: number
    lastFundingRound?: {
      fundingType?: string
      moneyRaised?: {
        currencyCode: string
        amount: string
      }
      announcedOn?: {
        month: number
        day: number
        year: number
      }
    }
  }
}

// ============================================
// LinkedIn Profile Scraper Helper
// ============================================

/**
 * Validate LinkedIn profile URL
 */
export function isValidLinkedInProfileUrl(url: string): boolean {
  const pattern = /^https?:\/\/(www\.)?linkedin\.com\/in\/[\w-]+\/?(\?.*)?$/
  return pattern.test(url)
}

/**
 * Extract public identifier from LinkedIn URL
 */
export function extractLinkedInPublicId(url: string): string | null {
  const match = url.match(/linkedin\.com\/in\/([\w-]+)/)
  return match ? match[1] : null
}

/**
 * Scrape a LinkedIn profile (profile details only, no email search)
 * Cost: $4/1000 profiles = $0.004 per profile
 */
export async function scrapeLinkedInProfile(profileUrl: string): Promise<LinkedInProfileOutput> {
  // Validate URL
  if (!isValidLinkedInProfileUrl(profileUrl)) {
    throw new Error('URL LinkedIn invalide. Format attendu: https://linkedin.com/in/nom-prenom')
  }

  // Clean URL (remove query params and trailing slash)
  const cleanUrl = profileUrl.split('?')[0].replace(/\/$/, '')

  console.log(`Scraping LinkedIn profile: ${cleanUrl}`)

  const results = await runApifyActor<LinkedInProfileOutput>({
    actorId: APIFY_ACTORS.LINKEDIN_PROFILE,
    input: {
      profileUrls: [cleanUrl],
      scrapeProfiles: true,      // Profile details only
      scrapeEmails: false,       // NO email search ($4/1000 instead of $10/1000)
    },
    timeoutSecs: 60
  })

  if (!results || results.length === 0) {
    throw new Error('Profil LinkedIn non trouvé ou privé')
  }

  const profile = results[0]

  // Check for error status
  if (profile.status !== 200) {
    throw new Error(`Erreur lors du scraping du profil LinkedIn (status: ${profile.status})`)
  }

  console.log(`LinkedIn profile scraped: ${profile.firstName} ${profile.lastName}`)
  return profile
}
