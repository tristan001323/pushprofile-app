import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { callClaudeWithFallback, cleanJsonResponse } from '@/lib/claude'
import { scrapeLinkedInProfile, isValidLinkedInProfileUrl } from '@/lib/apify'
import { linkedInProfileToCvData, type LinkedInCvData } from '@/lib/linkedin-to-cv'

const getSupabase = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase credentials')
  return createClient(url, key)
}

interface ParsedCV {
  target_roles: string[]
  skills: string[]
  experience_years: number
  location: string
  seniority: string
  education: string
  languages: string[]
}

// Extended type for LinkedIn-based searches
interface ExtendedParsedData extends ParsedCV {
  name?: string
  linkedin_url?: string
  profile_picture?: string | null
  headline?: string
  current_company?: string | null
}

// Parse CV with Claude Haiku (fallback to Sonnet if fails)
async function parseCV(cvText: string): Promise<ParsedCV> {
  // Tronquer si trop long (économie de tokens)
  const maxLength = 8000
  const truncatedCV = cvText.length > maxLength
    ? cvText.substring(0, maxLength) + '\n[... CV tronqué ...]'
    : cvText

  const prompt = `Tu es un expert en recrutement. Analyse ce CV et extrais les informations de manière EXHAUSTIVE.

RÈGLES IMPORTANTES:
1. target_roles: Extrais LE POSTE ACTUEL ou le plus récent + les variations possibles. Ex: si "Chef de Projet Digital", ajoute aussi "Digital Project Manager", "Product Owner", etc.
2. skills: Sois EXHAUSTIF. Extrais TOUTES les technologies, outils, méthodes, langages, frameworks mentionnés. Inclus les soft skills importants (management, agile, etc.)
3. experience_years: Calcule le TOTAL des années d'expérience professionnelle (pas les études). Si dates présentes, calcule précisément.
4. location: Cherche la ville dans les coordonnées, l'adresse, ou les expériences récentes. Si "Île-de-France" ou "IDF", mets "Paris".
5. seniority: Base-toi sur les années d'expérience ET les responsabilités (management = senior minimum)
6. education: Le diplôme le plus élevé avec l'école si prestigieuse (HEC, Polytechnique, etc.)
7. languages: Toutes les langues mentionnées avec leur niveau si indiqué

CV À ANALYSER:
---
${truncatedCV}
---

Réponds UNIQUEMENT avec le JSON, sans backticks, sans explication:
{"target_roles":["poste principal","variation 1","variation 2"],"skills":["skill1","skill2","..."],"experience_years":0,"location":"Ville","seniority":"Junior|Confirmé|Senior|Expert","education":"Diplôme - École","languages":["Français","Anglais"]}`

  const response = await callClaudeWithFallback(
    { model: 'haiku', prompt, maxTokens: 2500 },
    'sonnet'
  )

  if (response.usedFallback) {
    console.log('CV parsing fell back to Sonnet')
  }

  try {
    const parsed = JSON.parse(cleanJsonResponse(response.text))

    // Validation et nettoyage
    const targetRoles: string[] = Array.isArray(parsed.target_roles)
      ? parsed.target_roles.filter((r: unknown): r is string => typeof r === 'string' && r.length > 1)
      : []
    const skillsArray: string[] = Array.isArray(parsed.skills)
      ? parsed.skills.filter((s: unknown): s is string => typeof s === 'string' && s.length > 1)
      : []
    const languages: string[] = Array.isArray(parsed.languages)
      ? parsed.languages.filter((l: unknown): l is string => typeof l === 'string')
      : ['Français']

    return {
      target_roles: targetRoles,
      skills: Array.from(new Set(skillsArray)),
      experience_years: typeof parsed.experience_years === 'number' ? parsed.experience_years : parseInt(parsed.experience_years) || 0,
      location: parsed.location || 'France',
      seniority: ['Junior', 'Confirmé', 'Senior', 'Expert'].includes(parsed.seniority) ? parsed.seniority : 'Confirmé',
      education: parsed.education || '',
      languages
    }
  } catch (parseError) {
    console.error('Failed to parse CV response:', response.text)
    throw new Error('Échec du parsing du CV. Veuillez réessayer.')
  }
}

// Build parsed data from standard criteria (no CV)
function buildFromStandardCriteria(body: any): ParsedCV {
  const { job_title, location, seniority, brief } = body

  const skills: string[] = []
  if (brief) {
    const techKeywords = ['react', 'vue', 'angular', 'node', 'nodejs', 'python', 'java', 'javascript', 'typescript', 'php', 'ruby', 'go', 'rust', 'c++', 'c#', 'sql', 'aws', 'docker', 'kubernetes', 'git', 'graphql', 'mongodb', 'postgresql', 'mysql', 'redis', 'django', 'spring', 'express', 'nextjs', 'next.js', 'tailwind', 'figma', 'agile', 'scrum', 'devops', 'ci/cd', 'terraform', 'api', 'rest', 'microservices']
    const briefLower = brief.toLowerCase()
    techKeywords.forEach(skill => { if (briefLower.includes(skill)) skills.push(skill) })
    if (skills.length === 0) {
      skills.push(...brief.split(/[,;.\s]+/).filter((w: string) => w.length > 2).slice(0, 10))
    }
  }

  return {
    target_roles: job_title ? [job_title] : ['developer'],
    skills,
    experience_years: seniority === 'junior' ? 1 : seniority === 'confirmé' ? 3 : seniority === 'senior' ? 7 : seniority === 'expert' ? 12 : 3,
    location: location || 'France',
    seniority: seniority || 'confirmé',
    education: '',
    languages: ['Français']
  }
}

// Calculate next run date for recurrence
function calculateNextRunAt(recurrence: string): string | null {
  if (!recurrence) return null
  const now = new Date()
  let nextRun = new Date(now)

  switch (recurrence) {
    case '2days': nextRun.setDate(now.getDate() + 2); break
    case '4days': nextRun.setDate(now.getDate() + 4); break
    case 'weekly': nextRun.setDate(now.getDate() + 7); break
    case 'biweekly': nextRun.setDate(now.getDate() + 14); break
    case 'monthly': nextRun.setMonth(now.getMonth() + 1); break
    default: return null
  }

  nextRun.setHours(9, 0, 0, 0)
  const day = nextRun.getDay()
  if (day === 0) nextRun.setDate(nextRun.getDate() + 1)
  if (day === 6) nextRun.setDate(nextRun.getDate() + 2)

  return nextRun.toISOString()
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabase()
    const body = await request.json()
    const {
      cv_text,
      linkedin_url,        // NEW: LinkedIn profile URL
      input_type,          // NEW: 'cv' | 'linkedin' | 'manual'
      user_id,
      name,
      search_type,
      recurrence,
      job_title,
      location,
      seniority,
      brief,
      contract_types,
      remote_options,
      exclude_agencies
    } = body

    // Validation
    const hasCV = cv_text && cv_text.trim().length > 0
    const hasLinkedIn = linkedin_url && linkedin_url.trim().length > 0
    const hasStandardCriteria = job_title || location || brief

    if (!hasCV && !hasLinkedIn && !hasStandardCriteria) {
      return NextResponse.json({
        error: 'Veuillez fournir un CV, une URL LinkedIn, ou des critères de recherche'
      }, { status: 400 })
    }

    // Validate LinkedIn URL if provided
    if (hasLinkedIn && !isValidLinkedInProfileUrl(linkedin_url)) {
      return NextResponse.json({
        error: 'URL LinkedIn invalide. Format attendu: https://linkedin.com/in/nom-prenom'
      }, { status: 400 })
    }

    // 1. Parse input based on type
    let parsedData: ExtendedParsedData
    let actualInputType = input_type || (hasLinkedIn ? 'linkedin' : hasCV ? 'cv' : 'manual')

    if (hasLinkedIn && (actualInputType === 'linkedin' || !hasCV)) {
      // MODE LINKEDIN: Scrape profile and convert to CV format
      console.log(`Scraping LinkedIn profile: ${linkedin_url}`)
      const linkedInProfile = await scrapeLinkedInProfile(linkedin_url)
      const linkedInData = linkedInProfileToCvData(linkedInProfile)

      parsedData = linkedInData

      // Apply overrides if provided
      if (location) parsedData.location = location
      if (seniority) parsedData.seniority = seniority
      if (job_title) parsedData.target_roles = [job_title, ...parsedData.target_roles]

      actualInputType = 'linkedin'
      console.log(`LinkedIn profile parsed: ${linkedInData.name}`)

    } else if (hasCV && (search_type === 'cv' || search_type === 'both' || actualInputType === 'cv')) {
      // MODE CV: Parse with Claude
      console.log('Parsing CV with Claude...')
      parsedData = await parseCV(cv_text)

      if ((search_type === 'both' || actualInputType === 'both') && hasStandardCriteria) {
        if (job_title) parsedData.target_roles = [job_title, ...parsedData.target_roles]
        if (location) parsedData.location = location
        if (seniority) parsedData.seniority = seniority
        if (brief) {
          const additionalSkills = brief.split(/[,;.\s]+/).filter((w: string) => w.length > 2)
          parsedData.skills = [...new Set([...parsedData.skills, ...additionalSkills])]
        }
      }
      actualInputType = 'cv'

    } else {
      // MODE MANUAL: Build from criteria
      parsedData = buildFromStandardCriteria(body)
      actualInputType = 'manual'
    }

    // Build search name
    let searchName = name
    if (!searchName) {
      const profileName = (parsedData as LinkedInCvData).name
      const targetRole = parsedData.target_roles[0]
      const loc = parsedData.location || 'France'
      searchName = profileName
        ? `${profileName} - ${loc}`
        : `${targetRole || 'Recherche'} - ${loc}`
    }

    // 2. Create search with status "processing"
    const { data: searchData, error: searchError } = await supabase
      .from('searches')
      .insert({
        user_id,
        name: searchName,
        search_type: search_type || actualInputType,
        input_type: actualInputType,              // NEW: track input source
        job_title: parsedData.target_roles[0] || null,
        location: parsedData.location || null,
        seniority: parsedData.seniority || null,
        brief: parsedData.skills.join(', ') || null,
        cv_text: hasCV ? cv_text : null,
        linkedin_url: hasLinkedIn ? linkedin_url : null,  // NEW: store LinkedIn URL
        profile_picture: (parsedData as LinkedInCvData).profile_picture || null,  // NEW
        parsed_data: parsedData,
        status: 'processing',
        processing_step: actualInputType === 'linkedin' ? 'scraping' : 'parsing',
        recurrence: recurrence || null,
        is_recurrence_active: recurrence ? true : false,
        next_run_at: calculateNextRunAt(recurrence),
        exclude_agencies: exclude_agencies !== false
      })
      .select()
      .single()

    if (searchError) {
      console.error('Supabase search error:', searchError)
      return NextResponse.json({ error: `Failed to save search: ${searchError.message}` }, { status: 500 })
    }

    const searchId = searchData.id
    console.log(`Search created: ${searchId}`)

    // 3. Trigger background processing using request origin
    const origin = request.headers.get('origin')
      || request.headers.get('host')?.replace(/^([^:]+)/, 'https://$1')
      || process.env.NEXT_PUBLIC_APP_URL
      || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)
      || 'http://localhost:3000'

    // Ensure we have a proper URL
    const baseUrl = origin.startsWith('http') ? origin : `https://${origin}`

    console.log(`Triggering process-search at: ${baseUrl}/api/process-search/${searchId}`)

    // Must await the fetch to ensure request is sent before function terminates
    try {
      const processResponse = await fetch(`${baseUrl}/api/process-search/${searchId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      })
      console.log(`Process-search triggered, status: ${processResponse.status}`)
    } catch (err) {
      console.error('Failed to trigger processing:', err)
      // Don't fail the whole request, just log the error
    }

    // 4. Return with search ID
    return NextResponse.json({
      success: true,
      search_id: searchId,
      status: 'processing',
      message: 'Recherche lancée en arrière-plan'
    })

  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'An error occurred'
    }, { status: 500 })
  }
}
