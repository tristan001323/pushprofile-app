import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Allow up to 300s on Vercel Pro (60s on Hobby)
export const maxDuration = 300

const getSupabase = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL')
  if (!key) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, key)
}

const getAnthropicKey = () => process.env.ANTHROPIC_API_KEY || ''
const getApifyApiKey = () => process.env.APIFY_API_KEY || ''

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

function cleanJsonResponse(text: string): string {
  return text
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim()
}

// LinkedIn Post format from Apify actor buIWk2uOUzTmcLsuB (LinkedIn Posts Search Scraper)
interface LinkedInPost {
  type?: string
  id?: string
  linkedinUrl?: string
  content?: string
  author?: {
    universalName?: string | null
    publicIdentifier?: string
    type?: string
    name?: string
    linkedinUrl?: string
    info?: string
    website?: string | null
    avatar?: { url?: string }
  }
  postedAt?: {
    timestamp?: number
    date?: string
    postedAgoShort?: string
    postedAgoText?: string
  }
  engagement?: {
    likes?: number
    comments?: number
    shares?: number
  }
  postImages?: any[]
}

interface ParsedJobPost {
  job_title: string
  company_name: string
  location: string
  contract_type: string
  salary: string | null
  description: string
  is_job_post: boolean
  score: number
}

// Build search queries for the actor
// Each query must be under 85 chars (LinkedIn limit)
function buildSearchQueries(
  keywords: string,
  contractTypes: string[],
  location: string
): string[] {
  const keyword = keywords.trim()
  const queries: string[] = []

  // Query 1: French - "recrute {keyword}" with location
  let q1 = `recrute ${keyword}`
  if (location) q1 += ` ${location}`
  if (contractTypes.length > 0) q1 += ` ${contractTypes[0]}`
  if (q1.length > 85) q1 = q1.substring(0, 85)
  queries.push(q1)

  // Query 2: English - "hiring {keyword}" with location
  let q2 = `hiring ${keyword}`
  if (location) q2 += ` ${location}`
  if (q2.length > 85) q2 = q2.substring(0, 85)
  queries.push(q2)

  return queries
}

// Helper: wait for ms
function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Search LinkedIn posts via Apify actor buIWk2uOUzTmcLsuB (async with polling)
// Price: $2/1000 posts. maxPosts=25 per query x 2 queries = 50 posts max = $0.10 max
async function searchLinkedInPosts(queries: string[]): Promise<LinkedInPost[]> {
  const apiKey = getApifyApiKey()

  if (!apiKey) {
    console.log('No Apify API key, skipping LinkedIn posts search')
    return []
  }

  console.log('LinkedIn posts search queries:', queries)

  const MAX_WAIT_MS = 270000 // 4.5 minutes max wait (leave room for Claude parsing)

  try {
    const requestBody = {
      searchQueries: queries,
      postedLimit: 'month',
      maxPosts: 20,
      sortBy: 'relevance',
      scrapeReactions: false,
      scrapeComments: false,
    }

    console.log('Apify request body:', JSON.stringify(requestBody))

    // Step 1: Start the actor run (async)
    const startResponse = await fetch(
      `https://api.apify.com/v2/acts/buIWk2uOUzTmcLsuB/runs?token=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      }
    )

    if (!startResponse.ok) {
      const errorText = await startResponse.text()
      console.error('Apify start run error:', startResponse.status, errorText)
      return []
    }

    const runData = await startResponse.json()
    const runId = runData.data?.id
    const datasetId = runData.data?.defaultDatasetId

    if (!runId || !datasetId) {
      console.error('Apify run missing id or datasetId:', JSON.stringify(runData).substring(0, 500))
      return []
    }

    console.log(`Apify run started: ${runId}, dataset: ${datasetId}`)

    // Step 2: Poll for completion
    const startTime = Date.now()
    let status = runData.data?.status || 'RUNNING'

    while (status === 'RUNNING' || status === 'READY') {
      if (Date.now() - startTime > MAX_WAIT_MS) {
        console.log(`Apify run ${runId} still running after ${MAX_WAIT_MS / 1000}s, aborting wait`)
        // Try to abort the run
        await fetch(`https://api.apify.com/v2/actor-runs/${runId}/abort?token=${apiKey}`, { method: 'POST' }).catch(() => {})
        return []
      }

      await sleep(5000) // Poll every 5 seconds

      const pollResponse = await fetch(
        `https://api.apify.com/v2/actor-runs/${runId}?token=${apiKey}`
      )

      if (!pollResponse.ok) {
        console.error('Apify poll error:', pollResponse.status)
        continue
      }

      const pollData = await pollResponse.json()
      status = pollData.data?.status || 'UNKNOWN'
      console.log(`Apify run ${runId} status: ${status} (${Math.round((Date.now() - startTime) / 1000)}s elapsed)`)
    }

    if (status !== 'SUCCEEDED') {
      console.error(`Apify run ${runId} ended with status: ${status}`)
      return []
    }

    // Step 3: Fetch dataset items
    console.log(`Fetching dataset items from ${datasetId}...`)
    const itemsResponse = await fetch(
      `https://api.apify.com/v2/datasets/${datasetId}/items?token=${apiKey}`
    )

    if (!itemsResponse.ok) {
      const errorText = await itemsResponse.text()
      console.error('Apify dataset fetch error:', itemsResponse.status, errorText)
      return []
    }

    const rawData = await itemsResponse.json()
    console.log('Apify dataset items:', typeof rawData, Array.isArray(rawData) ? `array[${rawData.length}]` : 'object')

    let posts: LinkedInPost[] = []

    if (Array.isArray(rawData)) {
      posts = rawData.filter((item: any) => !item.type || item.type === 'post')
      console.log(`LinkedIn posts: ${posts.length} posts extracted (${rawData.length} total items)`)
    } else {
      console.log('Unexpected response format:', JSON.stringify(rawData).substring(0, 500))
    }

    // Deduplicate by id or linkedinUrl
    const seen = new Set<string>()
    const uniquePosts: LinkedInPost[] = []
    for (const post of posts) {
      const key = post.id || post.linkedinUrl || post.content?.substring(0, 100) || ''
      if (key && !seen.has(key)) {
        seen.add(key)
        uniquePosts.push(post)
      }
    }

    console.log(`LinkedIn posts: ${uniquePosts.length} unique posts after dedup`)
    return uniquePosts

  } catch (error: any) {
    console.error('Error in LinkedIn posts search:', error)
    return []
  }
}

// Parse posts with Claude to extract structured job info
async function parsePostsWithClaude(posts: LinkedInPost[]): Promise<ParsedJobPost[]> {
  if (posts.length === 0) return []

  const batchSize = 15
  const allParsed: ParsedJobPost[] = []

  for (let i = 0; i < posts.length; i += batchSize) {
    const batch = posts.slice(i, i + batchSize)

    const postsText = batch.map((post, index) =>
      `Post ${index + 1}:
Auteur: ${post.author?.name || 'Inconnu'} (${post.author?.info || ''})
Profil: ${post.author?.linkedinUrl || ''}
Date: ${post.postedAt?.date || post.postedAt?.postedAgoText || 'Inconnue'}
Texte: ${(post.content || '').substring(0, 800)}
---`
    ).join('\n')

    const prompt = `Analyse ces posts LinkedIn. Pour chaque post qui contient une offre d'emploi, une annonce de recrutement ou une recherche de profil, extrais les informations structurees. L'auteur du post peut etre n'importe qui : CTO, manager, fondateur, RH, recruteur, collegue...

IMPORTANT:
- Seuls les posts qui annoncent VRAIMENT un poste a pourvoir ou une recherche de profil doivent avoir is_job_post=true
- Ignore les posts qui sont du contenu marketing, des articles, des temoignages, des conseils carriere, etc.
- Le score (0-100) represente la qualite/completude de l'offre (salaire mentionne, description detaillee, poste clair, etc.)

Posts:
${postsText}

Retourne UNIQUEMENT un JSON array (sans backticks, sans markdown):
[
  {
    "post_index": 1,
    "job_title": "titre du poste",
    "company_name": "entreprise qui recrute",
    "location": "ville/lieu ou 'Non specifie'",
    "contract_type": "CDI/CDD/Freelance/Stage ou 'Non specifie'",
    "salary": "salaire si mentionne ou null",
    "description": "resume de l'offre en 2-3 phrases",
    "is_job_post": true,
    "score": 75
  }
]`

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01',
          'x-api-key': getAnthropicKey(),
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4000,
          messages: [{
            role: 'user',
            content: prompt
          }]
        }),
      })

      const data = await response.json()

      if (!response.ok || !data.content || !data.content[0]) {
        console.error('Claude parsing API error:', data)
        continue
      }

      const parsed = JSON.parse(cleanJsonResponse(data.content[0].text))

      for (const item of parsed) {
        if (item.is_job_post) {
          allParsed.push({
            job_title: item.job_title,
            company_name: item.company_name,
            location: item.location || 'Non specifie',
            contract_type: item.contract_type || 'Non specifie',
            salary: item.salary || null,
            description: item.description,
            is_job_post: true,
            score: item.score || 50,
          })

          const postIndex = item.post_index - 1
          if (postIndex >= 0 && postIndex < batch.length) {
            ;(allParsed[allParsed.length - 1] as any)._post = batch[postIndex]
          }
        }
      }
    } catch (error) {
      console.error('Error parsing posts with Claude:', error)
    }
  }

  return allParsed
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabase()
    const body = await request.json()
    const { name, keywords, location, contract_types, exclude_agencies, user_id } = body

    if (!keywords || !keywords.trim()) {
      return NextResponse.json({ error: 'Les mots-cles sont obligatoires' }, { status: 400 })
    }

    if (!user_id) {
      return NextResponse.json({ error: 'Utilisateur non authentifie' }, { status: 401 })
    }

    // 1. Create search record
    const searchName = name || `LinkedIn Posts - ${keywords}`
    const { data: searchData, error: searchError } = await supabase
      .from('searches')
      .insert({
        user_id,
        name: searchName,
        search_type: 'linkedin_posts',
        job_title: keywords,
        location: location || null,
        status: 'processing',
        recurrence: null,
        is_recurrence_active: false,
      })
      .select()
      .single()

    if (searchError) {
      console.error('Supabase search error:', searchError)
      return NextResponse.json({
        error: `Failed to save search: ${searchError.message}`
      }, { status: 500 })
    }

    const searchId = searchData.id

    // 2. Build search queries (2 queries x 20 posts = 40 max = $0.08 max)
    const queries = buildSearchQueries(
      keywords,
      contract_types || [],
      location || ''
    )

    // 3. Search LinkedIn posts
    console.log('Searching LinkedIn posts...')
    const posts = await searchLinkedInPosts(queries)

    if (posts.length === 0) {
      await supabase
        .from('searches')
        .update({ status: 'completed' })
        .eq('id', searchId)

      return NextResponse.json({
        success: true,
        search_id: searchId,
        matches_inserted: 0,
      })
    }

    // 4. Filter by agencies if needed
    let filteredPosts = posts
    if (exclude_agencies !== false) {
      filteredPosts = posts.filter(post => {
        const text = ((post.content || '') + ' ' + (post.author?.name || '') + ' ' + (post.author?.info || '')).toLowerCase()
        return !RECRUITMENT_AGENCIES.some(agency => text.includes(agency))
      })
      console.log(`Filtered ${posts.length - filteredPosts.length} posts from recruitment agencies`)
    }

    // 5. Parse posts with Claude
    console.log(`Parsing ${filteredPosts.length} posts with Claude...`)
    const parsedJobs = await parsePostsWithClaude(filteredPosts)
    console.log(`Claude identified ${parsedJobs.length} job posts out of ${filteredPosts.length} posts`)

    if (parsedJobs.length === 0) {
      await supabase
        .from('searches')
        .update({ status: 'completed' })
        .eq('id', searchId)

      return NextResponse.json({
        success: true,
        search_id: searchId,
        matches_inserted: 0,
      })
    }

    // 6. Build matches
    const matches = parsedJobs.map((job, index) => {
      const post = (job as any)._post as LinkedInPost | undefined

      return {
        search_id: searchId,
        job_title: job.job_title,
        company_name: job.company_name,
        location: job.location,
        posted_date: post?.postedAt?.date ? post.postedAt.date.split('T')[0] : null,
        job_url: post?.linkedinUrl || '',
        score: job.score,
        score_type: 'claude_ai',
        justification: job.description,
        status: 'nouveau',
        external_id: `linkedin_post_${post?.id || index}`,
        source: 'linkedin_post',
        rank: index + 1,
        matching_details: {
          contract_type: job.contract_type,
          remote_type: 'non_specifie',
          salary_min: null,
          salary_max: null,
          full_description: post?.content || job.description,
          recruiter_name: post?.author?.name || null,
          recruiter_url: post?.author?.linkedinUrl || null,
          post_engagement: {
            likes: post?.engagement?.likes || 0,
            comments: post?.engagement?.comments || 0,
            shares: post?.engagement?.shares || 0,
          }
        }
      }
    })

    // Sort by score
    matches.sort((a, b) => b.score - a.score)
    matches.forEach((m, i) => { m.rank = i + 1 })

    // 7. Deduplicate against existing matches
    const { data: existingMatches } = await supabase
      .from('matches')
      .select('external_id, job_title, company_name')
      .eq('search_id', searchId)

    const existingKeys = new Set<string>()
    if (existingMatches) {
      existingMatches.forEach(m => {
        if (m.external_id) existingKeys.add(m.external_id)
        existingKeys.add(`${m.job_title?.toLowerCase()}_${m.company_name?.toLowerCase()}`)
      })
    }

    const newMatches = matches.filter(m => {
      if (m.external_id && existingKeys.has(m.external_id)) return false
      const key = `${m.job_title?.toLowerCase()}_${m.company_name?.toLowerCase()}`
      return !existingKeys.has(key)
    })

    // 8. Save to Supabase
    if (newMatches.length > 0) {
      const { error: matchesError } = await supabase
        .from('matches')
        .insert(newMatches)

      if (matchesError) {
        console.error('Supabase matches error:', matchesError)
      }
    }

    // 9. Update search status
    await supabase
      .from('searches')
      .update({ status: 'completed' })
      .eq('id', searchId)

    console.log(`LinkedIn posts search complete: ${newMatches.length} matches inserted`)

    return NextResponse.json({
      success: true,
      search_id: searchId,
      matches_inserted: newMatches.length,
      duplicates_skipped: matches.length - newMatches.length,
    })

  } catch (error) {
    console.error('LinkedIn Posts API Error:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'An error occurred'
    }, { status: 500 })
  }
}
