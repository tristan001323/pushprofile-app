import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  runApifyActor,
  APIFY_ACTORS,
  LinkedInJobOutput,
  IndeedJobOutput,
  GlassdoorJobOutput
} from '@/lib/apify'

const getSupabase = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('Missing Supabase credentials')
  }
  return createClient(url, key)
}

interface CompanyJob {
  title: string
  location: string
  url: string
  source: string
  posted_date: string | null
  contract_type: string | null
  remote: string | null
  salary_min: number | null
  salary_max: number | null
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabase()
    const { company_name, company_slug, user_id } = await request.json()

    if (!company_name) {
      return NextResponse.json({ error: 'company_name is required' }, { status: 400 })
    }

    if (!user_id) {
      return NextResponse.json({ error: 'user_id is required' }, { status: 400 })
    }

    console.log(`Fetching jobs for company: ${company_name}`)

    const allJobs: CompanyJob[] = []
    const companyNameLower = company_name.toLowerCase().trim()

    // Helper to check if job matches company
    const matchesCompany = (jobCompanyName: string | undefined): boolean => {
      if (!jobCompanyName) return false
      const jobCompanyLower = jobCompanyName.toLowerCase().trim()
      return jobCompanyLower.includes(companyNameLower) || companyNameLower.includes(jobCompanyLower)
    }

    // Fetch from LinkedIn
    try {
      const linkedinJobs = await runApifyActor<LinkedInJobOutput>({
        actorId: APIFY_ACTORS.LINKEDIN_JOBS,
        input: {
          searchQueries: [company_name],
          location: 'France',
          maxResults: 50,
          publishedAt: 'pastMonth',
          rows: 50
        },
        timeoutSecs: 60
      })

      for (const job of linkedinJobs) {
        if (matchesCompany(job.companyName)) {
          allJobs.push({
            title: job.jobTitle,
            location: job.location || 'Non specifie',
            url: job.applyUrl || job.jobUrl,
            source: 'linkedin',
            posted_date: job.publishedAt ? job.publishedAt.split('T')[0] : null,
            contract_type: job.contractType === 'C' ? 'CDD' : job.contractType === 'I' ? 'Stage' : 'CDI',
            remote: (job.workType || '').toLowerCase().includes('remote') ? 'Remote' : null,
            salary_min: null,
            salary_max: null
          })
        }
      }
      console.log(`LinkedIn: found ${allJobs.length} jobs for ${company_name}`)
    } catch (error) {
      console.error('LinkedIn jobs error:', error)
    }

    // Fetch from Indeed
    try {
      const indeedJobs = await runApifyActor<IndeedJobOutput>({
        actorId: APIFY_ACTORS.INDEED_JOBS,
        input: {
          keyword: company_name,
          location: 'France',
          country: 'fr',
          maxItems: 50,
          parseCompanyDetails: false
        },
        timeoutSecs: 60
      })

      for (const job of indeedJobs) {
        if (matchesCompany(job.company?.companyName)) {
          allJobs.push({
            title: job.title,
            location: job.location?.city ? `${job.location.city}, ${job.location.country}` : 'Non specifie',
            url: job.applyUrl || job.jobUrl,
            source: 'indeed',
            posted_date: job.datePublished ? job.datePublished.split('T')[0] : null,
            contract_type: null,
            remote: null,
            salary_min: job.baseSalary_min || null,
            salary_max: job.baseSalary_max || null
          })
        }
      }
      console.log(`Indeed: total ${allJobs.length} jobs for ${company_name}`)
    } catch (error) {
      console.error('Indeed jobs error:', error)
    }

    // Fetch from Glassdoor
    try {
      const glassdoorJobs = await runApifyActor<GlassdoorJobOutput>({
        actorId: APIFY_ACTORS.GLASSDOOR_JOBS,
        input: {
          keyword: company_name,
          location: 'France',
          maxItems: 50,
          parseCompanyDetails: false
        },
        timeoutSecs: 60
      })

      for (const job of glassdoorJobs) {
        if (matchesCompany(job.company?.companyName)) {
          allJobs.push({
            title: job.title,
            location: job.location_city ? `${job.location_city}, ${job.location_country}` : 'Non specifie',
            url: job.jobUrl,
            source: 'glassdoor',
            posted_date: job.datePublished ? job.datePublished.split('T')[0] : null,
            contract_type: job.jobTypes?.[0] || null,
            remote: job.remoteWorkTypes?.[0] || null,
            salary_min: job.baseSalary_min || null,
            salary_max: job.baseSalary_max || null
          })
        }
      }
      console.log(`Glassdoor: total ${allJobs.length} jobs for ${company_name}`)
    } catch (error) {
      console.error('Glassdoor jobs error:', error)
    }

    // Deduplicate by title + location
    const seen = new Map<string, boolean>()
    const uniqueJobs: CompanyJob[] = []

    for (const job of allJobs) {
      const key = `${job.title.toLowerCase().trim()}|${job.location.toLowerCase().trim()}`
      if (!seen.has(key)) {
        seen.set(key, true)
        uniqueJobs.push(job)
      }
    }

    console.log(`Total unique jobs for ${company_name}: ${uniqueJobs.length}`)

    // Update company profile in cache if slug provided
    if (company_slug && uniqueJobs.length > 0) {
      await supabase
        .from('company_profiles')
        .update({ jobs: uniqueJobs, jobs_count: uniqueJobs.length })
        .eq('slug', company_slug)
    }

    // Log usage (~$0.15-0.17 for job search across 3 platforms)
    await supabase
      .from('api_usage')
      .insert({
        user_id,
        api_name: 'company-jobs',
        credits_used: 3, // 3 API calls (LinkedIn, Indeed, Glassdoor)
        metadata: {
          company_name,
          jobs_found: uniqueJobs.length
        }
      })

    return NextResponse.json({
      success: true,
      jobs: uniqueJobs,
      jobs_count: uniqueJobs.length
    })

  } catch (error) {
    console.error('Error fetching company jobs:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Failed to fetch company jobs'
    }, { status: 500 })
  }
}
