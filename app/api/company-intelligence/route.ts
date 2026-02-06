import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { runApifyActor, APIFY_ACTORS, WTTJCompanyOutput, LinkedInCompanyOutput } from '@/lib/apify'

const getSupabase = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('Missing Supabase credentials')
  }
  return createClient(url, key)
}

interface CompanyIntelRequest {
  company_url?: string    // WTTJ or LinkedIn URL
  company_name?: string   // Company name to search
  user_id: string
}

// Helper: Fetch WTTJ data
async function fetchWttjData(searchTerm: string, isUrl: boolean): Promise<WTTJCompanyOutput | null> {
  const input: Record<string, unknown> = {
    maxItems: 1,
    includeJobs: true
  }

  if (isUrl) {
    input.startUrls = [{ url: searchTerm }]
  } else {
    input.search = searchTerm
  }

  console.log(`Fetching WTTJ company data for: ${searchTerm}`)

  const results = await runApifyActor<WTTJCompanyOutput>({
    actorId: APIFY_ACTORS.WTTJ_COMPANY,
    input,
    timeoutSecs: 120
  })

  return results.length > 0 ? results[0] : null
}

// Helper: Fetch LinkedIn data
async function fetchLinkedInData(url: string): Promise<LinkedInCompanyOutput | null> {
  console.log(`Fetching LinkedIn company data for: ${url}`)

  const results = await runApifyActor<LinkedInCompanyOutput>({
    actorId: APIFY_ACTORS.LINKEDIN_COMPANY,
    input: { urls: [url] },
    timeoutSecs: 120
  })

  return results.length > 0 ? results[0] : null
}

// Helper: Normalize WTTJ data
function normalizeWttjData(data: WTTJCompanyOutput, slug?: string | null) {
  return {
    slug: data.slug || slug || data.name?.toLowerCase().replace(/\s+/g, '-'),
    name: data.name,
    wttj_url: data.organization_url,
    linkedin_url: data.social_networks?.linkedin || null,
    website: data.website || null,
    logo: null,
    description: data.descriptions?.map(d => `${d.title}: ${d.body}`).join('\n\n') || null,
    size: data.size || null,
    employee_count: data.nb_employees || null,
    average_age: data.average_age || null,
    creation_year: data.creation_year || null,
    parity_men: data.parity_men || null,
    parity_women: data.parity_women || null,
    offices: data.offices || [],
    headquarters_city: data.offices?.[0]?.city || null,
    headquarters_country: data.offices?.[0]?.country_code || null,
    sectors: data.sectors || [],
    tech_stack: data.technos_list || [],
    social_networks: data.social_networks || {},
    jobs_count: data.jobs_count || data.jobs?.length || 0,
    jobs: data.jobs?.slice(0, 20) || [],
    company_type: null,
    follower_count: null,
    specialities: [],
    funding_rounds: null,
    source: 'wttj',
  }
}

// Helper: Normalize LinkedIn data
function normalizeLinkedInData(data: LinkedInCompanyOutput) {
  const hq = data.locations?.find(l => l.headquarter) || data.locations?.[0]

  return {
    slug: data.universalName || data.name?.toLowerCase().replace(/\s+/g, '-'),
    name: data.name,
    wttj_url: null,
    linkedin_url: data.linkedinUrl,
    website: data.website?.split('?')[0] || null,
    logo: data.logo || null,
    description: data.description || data.tagline || null,
    size: data.employeeCountRange
      ? `${data.employeeCountRange.start}${data.employeeCountRange.end ? `-${data.employeeCountRange.end}` : '+'}`
      : null,
    employee_count: data.employeeCount || null,
    average_age: null,
    creation_year: data.foundedOn?.year || null,
    parity_men: null,
    parity_women: null,
    offices: data.locations?.map(loc => ({
      address: [loc.line1, loc.line2].filter(Boolean).join(', '),
      city: loc.parsed?.city || loc.city || '',
      country_code: loc.country || ''
    })) || [],
    headquarters_city: hq?.parsed?.city || hq?.city || null,
    headquarters_country: hq?.country || null,
    sectors: data.industries?.map(i => ({ name: i, parent_name: 'Industry' })) || [],
    tech_stack: [],
    social_networks: { linkedin: data.linkedinUrl },
    jobs_count: 0,
    jobs: [],
    company_type: data.companyType || null,
    follower_count: data.followerCount || null,
    specialities: data.specialities || [],
    funding_rounds: data.fundingData?.numFundingRounds || null,
    source: 'linkedin',
  }
}

// Helper: Merge profiles (base + complement, no duplicates)
function mergeProfiles(base: Record<string, unknown>, complement: Record<string, unknown>): Record<string, unknown> {
  const merged = { ...base }

  // Fields to complement if missing in base
  const fieldsToComplement = [
    'wttj_url', 'linkedin_url', 'website', 'logo', 'description',
    'size', 'employee_count', 'average_age', 'creation_year',
    'parity_men', 'parity_women', 'headquarters_city', 'headquarters_country',
    'company_type', 'follower_count', 'funding_rounds'
  ]

  for (const field of fieldsToComplement) {
    if (!merged[field] && complement[field]) {
      merged[field] = complement[field]
    }
  }

  // Merge arrays (avoid duplicates)
  if (Array.isArray(complement.offices) && (complement.offices as unknown[]).length > 0) {
    const baseOffices = (merged.offices as Array<{city: string}>) || []
    const complementOffices = complement.offices as Array<{city: string, address: string, country_code: string}>
    const existingCities = new Set(baseOffices.map(o => o.city?.toLowerCase()))
    for (const office of complementOffices) {
      if (!existingCities.has(office.city?.toLowerCase())) {
        baseOffices.push(office)
      }
    }
    merged.offices = baseOffices
  }

  if (Array.isArray(complement.sectors) && (complement.sectors as unknown[]).length > 0) {
    const baseSectors = (merged.sectors as Array<{name: string}>) || []
    const complementSectors = complement.sectors as Array<{name: string, parent_name: string}>
    const existingNames = new Set(baseSectors.map(s => s.name?.toLowerCase()))
    for (const sector of complementSectors) {
      if (!existingNames.has(sector.name?.toLowerCase())) {
        baseSectors.push(sector)
      }
    }
    merged.sectors = baseSectors
  }

  if (Array.isArray(complement.tech_stack) && (complement.tech_stack as unknown[]).length > 0) {
    const baseTech = (merged.tech_stack as string[]) || []
    const complementTech = complement.tech_stack as string[]
    const existingTech = new Set(baseTech.map(t => t.toLowerCase()))
    for (const tech of complementTech) {
      if (!existingTech.has(tech.toLowerCase())) {
        baseTech.push(tech)
      }
    }
    merged.tech_stack = baseTech
  }

  if (Array.isArray(complement.specialities) && (complement.specialities as unknown[]).length > 0) {
    const baseSpec = (merged.specialities as string[]) || []
    const complementSpec = complement.specialities as string[]
    const existingSpec = new Set(baseSpec.map(s => s.toLowerCase()))
    for (const spec of complementSpec) {
      if (!existingSpec.has(spec.toLowerCase())) {
        baseSpec.push(spec)
      }
    }
    merged.specialities = baseSpec
  }

  // Jobs: prefer WTTJ jobs
  if (Array.isArray(complement.jobs) && (complement.jobs as unknown[]).length > 0 && (!merged.jobs || (merged.jobs as unknown[]).length === 0)) {
    merged.jobs = complement.jobs
    merged.jobs_count = complement.jobs_count
  }

  // Merge social networks
  const baseSocial = (merged.social_networks as Record<string, string>) || {}
  const complementSocial = (complement.social_networks as Record<string, string>) || {}
  merged.social_networks = { ...complementSocial, ...baseSocial }

  // Mark as combined source if both were used
  if (base.source !== complement.source) {
    merged.source = 'combined'
  }

  return merged
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabase()
    const body: CompanyIntelRequest = await request.json()
    const { company_url, company_name, user_id } = body

    if (!company_url && !company_name) {
      return NextResponse.json(
        { error: 'company_url or company_name is required' },
        { status: 400 }
      )
    }

    if (!user_id) {
      return NextResponse.json({ error: 'user_id is required' }, { status: 400 })
    }

    // Detect URL type
    const isLinkedInUrl = company_url?.includes('linkedin.com/company/')
    const isWttjUrl = company_url?.includes('welcometothejungle.com')

    // Extract identifiers from URL
    let wttjSlug: string | null = null
    let linkedinUniversalName: string | null = null

    if (company_url) {
      if (isWttjUrl) {
        const match = company_url.match(/welcometothejungle\.com\/\w+\/companies\/([^\/\?]+)/)
        if (match) wttjSlug = match[1]
      } else if (isLinkedInUrl) {
        const match = company_url.match(/linkedin\.com\/company\/([^\/\?]+)/)
        if (match) linkedinUniversalName = match[1]
      }
    }

    // 1. Check cache first (30 days validity)
    let cacheQuery
    if (wttjSlug) {
      cacheQuery = supabase.from('company_profiles').select('*').eq('slug', wttjSlug)
    } else if (linkedinUniversalName) {
      cacheQuery = supabase.from('company_profiles').select('*').eq('slug', linkedinUniversalName)
    } else if (company_name) {
      cacheQuery = supabase.from('company_profiles').select('*').ilike('name', `%${company_name}%`)
    }

    if (cacheQuery) {
      const { data: cachedProfile } = await cacheQuery
        .gte('scraped_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
        .single()

      if (cachedProfile) {
        console.log(`Found cached company profile for ${wttjSlug || linkedinUniversalName || company_name}`)
        return NextResponse.json({
          success: true,
          company: cachedProfile,
          from_cache: true,
          credits_used: 0
        })
      }
    }

    let companyProfile: Record<string, unknown> | null = null
    let creditsUsed = 0

    // 2. Fetch data based on input type
    if (isLinkedInUrl && company_url) {
      // LinkedIn URL provided: Get LinkedIn first, then complement with WTTJ
      const linkedinData = await fetchLinkedInData(company_url)

      if (!linkedinData) {
        return NextResponse.json({
          success: false,
          error: 'Entreprise non trouvee sur LinkedIn'
        }, { status: 404 })
      }

      companyProfile = normalizeLinkedInData(linkedinData)
      creditsUsed++
      console.log(`LinkedIn data fetched for: ${linkedinData.name}`)

      // Try to complement with WTTJ data
      const wttjData = await fetchWttjData(linkedinData.name, false)
      if (wttjData) {
        console.log(`Complementing with WTTJ data for: ${wttjData.name}`)
        const wttjProfile = normalizeWttjData(wttjData)
        companyProfile = mergeProfiles(companyProfile, wttjProfile)
        creditsUsed++
      }

    } else if (isWttjUrl && company_url) {
      // WTTJ URL provided: Get WTTJ only
      const wttjData = await fetchWttjData(company_url, true)

      if (!wttjData) {
        return NextResponse.json({
          success: false,
          error: 'Entreprise non trouvee sur Welcome to the Jungle'
        }, { status: 404 })
      }

      companyProfile = normalizeWttjData(wttjData, wttjSlug)
      creditsUsed++

    } else if (company_name) {
      // Company name: Try WTTJ first, fallback to LinkedIn
      const wttjData = await fetchWttjData(company_name, false)

      if (wttjData) {
        console.log(`WTTJ data found for: ${wttjData.name}`)
        companyProfile = normalizeWttjData(wttjData)
        creditsUsed++
      } else {
        // Fallback to LinkedIn search
        console.log(`WTTJ not found, trying LinkedIn for: ${company_name}`)

        // Build LinkedIn company URL from name
        const linkedinSearchUrl = `https://www.linkedin.com/company/${company_name.toLowerCase().replace(/\s+/g, '-')}`
        const linkedinData = await fetchLinkedInData(linkedinSearchUrl)

        if (linkedinData) {
          console.log(`LinkedIn fallback found: ${linkedinData.name}`)
          companyProfile = normalizeLinkedInData(linkedinData)
          creditsUsed++
        } else {
          return NextResponse.json({
            success: false,
            error: 'Entreprise non trouvee sur WTTJ ni LinkedIn'
          }, { status: 404 })
        }
      }
    }

    if (!companyProfile) {
      return NextResponse.json({
        success: false,
        error: 'Impossible de recuperer les donnees'
      }, { status: 500 })
    }

    // Add timestamps
    companyProfile.scraped_at = new Date().toISOString()

    // 3. Cache the result
    const { error: upsertError } = await supabase
      .from('company_profiles')
      .upsert(companyProfile, { onConflict: 'slug' })

    if (upsertError) {
      console.error('Failed to cache company profile:', upsertError)
    }

    // 4. Log usage
    await supabase
      .from('api_usage')
      .insert({
        user_id,
        api_name: 'company-intelligence',
        credits_used: creditsUsed,
        metadata: {
          company_name: companyProfile.name,
          company_slug: companyProfile.slug,
          source: companyProfile.source
        }
      })

    return NextResponse.json({
      success: true,
      company: companyProfile,
      from_cache: false,
      credits_used: creditsUsed
    })

  } catch (error) {
    console.error('Error fetching company intelligence:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Failed to fetch company intelligence'
    }, { status: 500 })
  }
}

// GET endpoint to fetch cached company by slug
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabase()
    const { searchParams } = new URL(request.url)
    const slug = searchParams.get('slug')

    if (!slug) {
      return NextResponse.json({ error: 'slug is required' }, { status: 400 })
    }

    const { data: company, error } = await supabase
      .from('company_profiles')
      .select('*')
      .eq('slug', slug)
      .single()

    if (error || !company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, company })

  } catch (error) {
    console.error('Error fetching company:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Failed to fetch company'
    }, { status: 500 })
  }
}
