import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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

// LinkedIn Post format from Apify actor 29VKGPinaGwpfxTrv
interface LinkedInPost {
  postUrn?: string
  url?: string
  content?: string
  author?: {
    name?: string
    profileUrl?: string
  }
  reactionsCount?: number
  commentsCount?: number
  sharesCount?: number
  timestamp?: string
  postedAt?: string
  media_urls?: string[]
}

// Apify actor response wrapper
interface ApifyPostsResponse {
  success?: boolean
  keywords?: string
  totalPosts?: number
  posts?: LinkedInPost[]
  error?: string
  scrapedAt?: string
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

// Build a single broad LinkedIn search query
function buildLinkedInPostQuery(
  keywords: string,
  contractTypes: string[],
  location: string
): string {
  const keyword = keywords.trim()

  // Simple and direct - like the actor example: "hiring engineer" OR "looking for job"
  let query = `"hiring ${keyword}" OR "recrute ${keyword}"`

  if (location) {
    query += ` ${location}`
  }

  if (contractTypes.length > 0) {
    query += ` ${contractTypes[0]}`
  }

  // Keep under 85 chars
  if (query.length > 85) {
    query = `hiring OR recrute ${keyword}`
    if (location) query += ` ${location}`
  }

  if (query.length > 85) {
    query = query.substring(0, 85)
  }

  return query
}

// Search LinkedIn posts via Apify actor 29VKGPinaGwpfxTrv
async function searchLinkedInPosts(query: string): Promise<LinkedInPost[]> {
  const apiKey = getApifyApiKey()

  if (!apiKey) {
    console.log('No Apify API key, skipping LinkedIn posts search')
    return []
  }

  console.log(`LinkedIn posts search query: "${query}"`)

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 55000) // 55s to stay under Vercel 60s

    const response = await fetch(
      `https://api.apify.com/v2/acts/29VKGPinaGwpfxTrv/run-sync-get-dataset-items?token=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keywords: query,
          datePosted: 'past-month',
          limit: 50
        }),
        signal: controller.signal
      }
    )

    clearTimeout(timeoutId)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Apify LinkedIn Posts API error:', response.status, errorText)
      return []
    }

    const rawData = await response.json()
    console.log('Apify raw response type:', typeof rawData, Array.isArray(rawData) ? `array[${rawData.length}]` : 'object')

    // Log the actual content to debug
    const debugStr = JSON.stringify(rawData).substring(0, 1000)
    console.log('Apify raw response preview:', debugStr)

    // run-sync-get-dataset-items returns dataset items as an array
    // Each item is a { success, posts: [...] } object
    const allPosts: LinkedInPost[] = []

    if (Array.isArray(rawData)) {
      for (const item of rawData) {
        console.log('Item keys:', Object.keys(item).join(', '))
        console.log('Item success:', item.success, 'totalPosts:', item.totalPosts, 'posts length:', item.posts?.length, 'error:', item.error)

        // Could be the wrapper object with posts array
        if (item.posts && Array.isArray(item.posts)) {
          allPosts.push(...item.posts)
        }
        // Or could be a flat post object itself (if actor pushes posts individually)
        else if (item.content || item.url || item.postUrn) {
          allPosts.push(item as LinkedInPost)
        }
      }
    } else if (rawData && typeof rawData === 'object') {
      console.log('Object keys:', Object.keys(rawData).join(', '))
      if (rawData.posts && Array.isArray(rawData.posts)) {
        allPosts.push(...rawData.posts)
      }
    }

    console.log(`LinkedIn posts: extracted ${allPosts.length} posts`)

    // Deduplicate by url or postUrn
    const seen = new Set<string>()
    const uniquePosts: LinkedInPost[] = []
    for (const post of allPosts) {
      const key = post.url || post.postUrn || post.content?.substring(0, 100) || ''
      if (key && !seen.has(key)) {
        seen.add(key)
        uniquePosts.push(post)
      }
    }

    console.log(`LinkedIn posts: ${uniquePosts.length} unique posts after dedup`)
    return uniquePosts

  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.log('LinkedIn posts search timed out after 55s')
    } else {
      console.error('Error fetching LinkedIn posts:', error)
    }
    return []
  }
}

// Parse posts with Claude to extract structured job info
async function parsePostsWithClaude(posts: LinkedInPost[]): Promise<ParsedJobPost[]> {
  if (posts.length === 0) return []

  // Send posts in batches of 15 to avoid token limits
  const batchSize = 15
  const allParsed: ParsedJobPost[] = []

  for (let i = 0; i < posts.length; i += batchSize) {
    const batch = posts.slice(i, i + batchSize)

    const postsText = batch.map((post, index) =>
      `Post ${index + 1}:
Auteur: ${post.author?.name || 'Inconnu'}
Profil: ${post.author?.profileUrl || ''}
Date: ${post.postedAt || post.timestamp || 'Inconnue'}
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

      // Map parsed results back to posts
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

          // Store post_index to link back to the original post data
          const postIndex = item.post_index - 1
          if (postIndex >= 0 && postIndex < batch.length) {
            const post = batch[postIndex]
            ;(allParsed[allParsed.length - 1] as any)._post = post
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

    // 2. Build ONE broad query (stay under Vercel 60s timeout)
    const query = buildLinkedInPostQuery(
      keywords,
      contract_types || [],
      location || ''
    )
    console.log('LinkedIn posts query:', query)

    // 3. Search LinkedIn posts (single call)
    console.log('Searching LinkedIn posts...')
    const posts = await searchLinkedInPosts(query)

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
        const text = ((post.content || '') + ' ' + (post.author?.name || '')).toLowerCase()
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
        posted_date: post?.postedAt ? post.postedAt.split('T')[0] : null,
        job_url: post?.url || '',
        score: job.score,
        score_type: 'claude_ai',
        justification: job.description,
        status: 'nouveau',
        external_id: `linkedin_post_${post?.postUrn || post?.url ? Buffer.from(post?.postUrn || post?.url || '').toString('base64').substring(0, 40) : index}`,
        source: 'linkedin_post',
        rank: index + 1,
        matching_details: {
          contract_type: job.contract_type,
          remote_type: 'non_specifie',
          salary_min: null,
          salary_max: null,
          full_description: post?.content || job.description,
          recruiter_name: post?.author?.name || null,
          recruiter_url: post?.author?.profileUrl || null,
          post_engagement: {
            likes: post?.reactionsCount || 0,
            comments: post?.commentsCount || 0,
            shares: post?.sharesCount || 0,
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
