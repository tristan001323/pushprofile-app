import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { runApifyActor, APIFY_ACTORS, WTTJCompanyOutput } from '@/lib/apify'

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

    // Extract slug from URL if provided
    let slug: string | null = null
    if (company_url) {
      // Handle WTTJ URLs: https://www.welcometothejungle.com/fr/companies/doctolib
      const wttjMatch = company_url.match(/welcometothejungle\.com\/\w+\/companies\/([^\/\?]+)/)
      if (wttjMatch) {
        slug = wttjMatch[1]
      }
    }

    // 1. Check cache first (30 days validity)
    const cacheQuery = slug
      ? supabase.from('company_profiles').select('*').eq('slug', slug)
      : supabase.from('company_profiles').select('*').ilike('name', `%${company_name}%`)

    const { data: cachedProfile } = await cacheQuery
      .gte('scraped_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .single()

    if (cachedProfile) {
      console.log(`Found cached company profile for ${slug || company_name}`)
      return NextResponse.json({
        success: true,
        company: cachedProfile,
        from_cache: true,
        credits_used: 0
      })
    }

    // 2. Build input for saswave/welcome-to-the-jungle-scraper
    const input: Record<string, unknown> = {
      maxItems: 1,
      includeJobs: true
    }

    if (company_url) {
      input.startUrls = [{ url: company_url }]
    } else if (company_name) {
      input.search = company_name
    }

    console.log(`Fetching company intelligence for ${company_url || company_name}`)

    // 3. Call WTTJ Company scraper
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

    // 4. Normalize and structure the data
    const companyProfile = {
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
      jobs: companyData.jobs?.slice(0, 20) || [],  // Keep top 20 jobs

      // Raw data for future use
      raw_data: companyData,

      // Timestamps
      scraped_at: new Date().toISOString()
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
          company_name: companyData.name,
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
