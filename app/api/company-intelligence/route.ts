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

    // Extract slug from URL if provided
    let slug: string | null = null
    let linkedinUniversalName: string | null = null

    if (company_url) {
      if (isWttjUrl) {
        const wttjMatch = company_url.match(/welcometothejungle\.com\/\w+\/companies\/([^\/\?]+)/)
        if (wttjMatch) slug = wttjMatch[1]
      } else if (isLinkedInUrl) {
        const linkedinMatch = company_url.match(/linkedin\.com\/company\/([^\/\?]+)/)
        if (linkedinMatch) linkedinUniversalName = linkedinMatch[1]
      }
    }

    // 1. Check cache first (30 days validity)
    let cacheQuery
    if (slug) {
      cacheQuery = supabase.from('company_profiles').select('*').eq('slug', slug)
    } else if (linkedinUniversalName) {
      cacheQuery = supabase.from('company_profiles').select('*').eq('slug', linkedinUniversalName)
    } else {
      cacheQuery = supabase.from('company_profiles').select('*').ilike('name', `%${company_name}%`)
    }

    const { data: cachedProfile } = await cacheQuery
      .gte('scraped_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .single()

    if (cachedProfile) {
      console.log(`Found cached company profile for ${slug || linkedinUniversalName || company_name}`)
      return NextResponse.json({
        success: true,
        company: cachedProfile,
        from_cache: true,
        credits_used: 0
      })
    }

    let companyProfile

    // 2. Use LinkedIn scraper if LinkedIn URL provided
    if (isLinkedInUrl && company_url) {
      console.log(`Fetching LinkedIn company data for ${company_url}`)

      const results = await runApifyActor<LinkedInCompanyOutput>({
        actorId: APIFY_ACTORS.LINKEDIN_COMPANY,
        input: {
          urls: [company_url]
        },
        timeoutSecs: 120
      })

      if (results.length === 0) {
        return NextResponse.json({
          success: false,
          error: 'Company not found on LinkedIn'
        }, { status: 404 })
      }

      const linkedinData = results[0]
      console.log(`LinkedIn Company scraper returned data for: ${linkedinData.name}`)

      // Find headquarters
      const hq = linkedinData.locations?.find(l => l.headquarter) || linkedinData.locations?.[0]

      // Normalize LinkedIn data to our format
      companyProfile = {
        slug: linkedinData.universalName || linkedinData.name?.toLowerCase().replace(/\s+/g, '-'),
        name: linkedinData.name,
        wttj_url: null,
        linkedin_url: linkedinData.linkedinUrl,
        website: linkedinData.website?.split('?')[0] || null, // Remove UTM params
        logo: linkedinData.logo || null,

        // Company info
        description: linkedinData.description || linkedinData.tagline || null,
        size: linkedinData.employeeCountRange
          ? `${linkedinData.employeeCountRange.start}${linkedinData.employeeCountRange.end ? `-${linkedinData.employeeCountRange.end}` : '+'}`
          : null,
        employee_count: linkedinData.employeeCount || null,
        average_age: null,
        creation_year: linkedinData.foundedOn?.year || null,

        // Parity (not available on LinkedIn)
        parity_men: null,
        parity_women: null,

        // Location
        offices: linkedinData.locations?.map(loc => ({
          address: [loc.line1, loc.line2].filter(Boolean).join(', '),
          city: loc.parsed?.city || loc.city || '',
          country_code: loc.country || ''
        })) || [],
        headquarters_city: hq?.parsed?.city || hq?.city || null,
        headquarters_country: hq?.country || null,

        // Industry & Tech
        sectors: linkedinData.industries?.map(i => ({ name: i, parent_name: 'Industry' })) || [],
        tech_stack: [],

        // Social
        social_networks: {
          linkedin: linkedinData.linkedinUrl
        },

        // Additional LinkedIn data
        company_type: linkedinData.companyType || null,
        follower_count: linkedinData.followerCount || null,
        specialities: linkedinData.specialities || [],
        funding_rounds: linkedinData.fundingData?.numFundingRounds || null,

        // Jobs (not available from this scraper)
        jobs_count: 0,
        jobs: [],

        // Source
        source: 'linkedin',
        raw_data: linkedinData,
        scraped_at: new Date().toISOString()
      }
    } else {
      // 3. Use WTTJ scraper for WTTJ URLs or company name search
      const input: Record<string, unknown> = {
        maxItems: 1,
        includeJobs: true
      }

      if (company_url && isWttjUrl) {
        input.startUrls = [{ url: company_url }]
      } else if (company_name) {
        input.search = company_name
      }

      console.log(`Fetching WTTJ company data for ${company_url || company_name}`)

      const results = await runApifyActor<WTTJCompanyOutput>({
        actorId: APIFY_ACTORS.WTTJ_COMPANY,
        input,
        timeoutSecs: 120
      })

      if (results.length === 0) {
        return NextResponse.json({
          success: false,
          error: 'Company not found on Welcome to the Jungle'
        }, { status: 404 })
      }

      const companyData = results[0]
      console.log(`WTTJ Company scraper returned data for: ${companyData.name}`)

      // Normalize WTTJ data to our format
      companyProfile = {
        slug: companyData.slug || slug || companyData.name?.toLowerCase().replace(/\s+/g, '-'),
        name: companyData.name,
        wttj_url: companyData.organization_url,
        linkedin_url: companyData.social_networks?.linkedin || null,
        website: companyData.website || null,

        // Company info
        description: companyData.descriptions?.map(d => `${d.title}: ${d.body}`).join('\n\n') || null,
        size: companyData.size || null,
        employee_count: companyData.nb_employees || null,
        average_age: companyData.average_age || null,
        creation_year: companyData.creation_year || null,

        // Parity
        parity_men: companyData.parity_men || null,
        parity_women: companyData.parity_women || null,

        // Location
        offices: companyData.offices || [],
        headquarters_city: companyData.offices?.[0]?.city || null,
        headquarters_country: companyData.offices?.[0]?.country_code || null,

        // Industry & Tech
        sectors: companyData.sectors || [],
        tech_stack: companyData.technos_list || [],

        // Social
        social_networks: companyData.social_networks || {},

        // Jobs
        jobs_count: companyData.jobs_count || companyData.jobs?.length || 0,
        jobs: companyData.jobs?.slice(0, 20) || [],

        // Source
        source: 'wttj',
        raw_data: companyData,
        scraped_at: new Date().toISOString()
      }
    }

    // 5. Cache the result
    const { error: upsertError } = await supabase
      .from('company_profiles')
      .upsert(companyProfile, { onConflict: 'slug' })

    if (upsertError) {
      console.error('Failed to cache company profile:', upsertError)
    }

    // 6. Log usage
    await supabase
      .from('api_usage')
      .insert({
        user_id,
        api_name: 'company-intelligence',
        credits_used: 1,
        metadata: {
          company_name: companyProfile.name,
          company_slug: companyProfile.slug
        }
      })

    return NextResponse.json({
      success: true,
      company: companyProfile,
      from_cache: false,
      credits_used: 1
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
