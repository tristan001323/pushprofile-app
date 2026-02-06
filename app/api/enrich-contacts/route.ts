import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { runApifyActor, APIFY_ACTORS, LeadsFinderOutput } from '@/lib/apify'

const getSupabase = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('Missing Supabase credentials')
  }
  return createClient(url, key)
}

interface EnrichContactRequest {
  company_name: string
  job_titles?: string[]  // e.g., ["CTO", "VP Engineering", "Head of HR"]
  match_id?: string      // Optional: link to a specific match
  user_id: string
}

interface EnrichedContact {
  full_name: string | null
  first_name: string | null
  last_name: string | null
  job_title: string | null
  email: string | null
  email_status: string | null
  phone: string | null
  linkedin_url: string | null
  company_name: string | null
  company_domain: string | null
  company_industry: string | null
  company_size: string | null
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabase()
    const body: EnrichContactRequest = await request.json()
    const { company_name, job_titles, match_id, user_id } = body

    if (!company_name) {
      return NextResponse.json({ error: 'company_name is required' }, { status: 400 })
    }

    if (!user_id) {
      return NextResponse.json({ error: 'user_id is required' }, { status: 400 })
    }

    // Default job titles to search for (decision makers)
    const titlesToSearch = job_titles || [
      'CEO', 'CTO', 'CFO', 'COO',
      'VP Engineering', 'VP Product', 'VP HR',
      'Head of Engineering', 'Head of Product', 'Head of HR',
      'Director of Engineering', 'Director of HR',
      'DRH', 'Directeur Technique', 'Directeur RH'
    ]

    console.log(`Enriching contacts for ${company_name}, searching for: ${titlesToSearch.join(', ')}`)

    // 1. Check cache first
    const { data: cachedContacts } = await supabase
      .from('contacts_cache')
      .select('*')
      .eq('company_name', company_name.toLowerCase())
      .in('job_title_searched', titlesToSearch.map(t => t.toLowerCase()))
      .gte('enriched_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()) // 30 days cache

    if (cachedContacts && cachedContacts.length > 0) {
      console.log(`Found ${cachedContacts.length} cached contacts for ${company_name}`)
      return NextResponse.json({
        success: true,
        contacts: cachedContacts,
        from_cache: true,
        credits_used: 0
      })
    }

    // 2. Call Leads Finder API
    // The actor expects: company domain or name, and optionally job titles
    const input = {
      companies: [company_name],
      jobTitles: titlesToSearch,
      limit: 10,  // Get up to 10 contacts per company
      onlyVerifiedEmails: false  // Include unverified to get more results
    }

    const results = await runApifyActor<LeadsFinderOutput>({
      actorId: APIFY_ACTORS.LEADS_FINDER,
      input,
      timeoutSecs: 120
    })

    console.log(`Leads Finder returned ${results.length} contacts`)

    // 3. Normalize and enrich results
    const enrichedContacts: EnrichedContact[] = results
      .map(contact => ({
        full_name: contact.full_name || `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || null,
        first_name: contact.first_name || null,
        last_name: contact.last_name || null,
        job_title: contact.job_title || contact.headline || null,
        email: contact.email || null,
        email_status: contact.email_status || null,
        phone: contact.mobile_number || null,
        linkedin_url: contact.linkedin_url || null,
        company_name: contact.company_name || company_name,
        company_domain: contact.company_domain || null,
        company_industry: contact.company_industry || null,
        company_size: contact.company_size || null
      }))
      // Filter out contacts that don't have useful data (at least name OR email OR linkedin)
      .filter(contact =>
        (contact.full_name && contact.full_name.trim().length > 0) ||
        contact.email ||
        contact.linkedin_url
      )

    console.log(`After filtering empty contacts: ${enrichedContacts.length} valid contacts`)

    // 4. Cache the results
    if (enrichedContacts.length > 0) {
      const cacheEntries = enrichedContacts.map(contact => ({
        company_name: company_name.toLowerCase(),
        job_title_searched: (contact.job_title || 'unknown').toLowerCase(),
        full_name: contact.full_name,
        first_name: contact.first_name,
        last_name: contact.last_name,
        job_title: contact.job_title,
        email: contact.email,
        email_status: contact.email_status,
        phone: contact.phone,
        linkedin_url: contact.linkedin_url,
        company_domain: contact.company_domain,
        company_industry: contact.company_industry,
        company_size: contact.company_size,
        enriched_at: new Date().toISOString()
      }))

      const { error: cacheError } = await supabase
        .from('contacts_cache')
        .upsert(cacheEntries, { onConflict: 'company_name,linkedin_url' })

      if (cacheError) {
        console.error('Failed to cache contacts:', cacheError)
      }
    }

    // 5. If match_id provided, update the match with contact info
    if (match_id && enrichedContacts.length > 0) {
      const primaryContact = enrichedContacts[0]
      await supabase
        .from('matches')
        .update({
          matching_details: supabase.rpc('jsonb_set', {
            target: 'matching_details',
            path: '{enriched_contact}',
            value: JSON.stringify(primaryContact)
          })
        })
        .eq('id', match_id)
    }

    // 6. Log usage for billing
    await supabase
      .from('api_usage')
      .insert({
        user_id,
        api_name: 'enrich-contacts',
        credits_used: results.length,
        metadata: {
          company_name,
          contacts_found: results.length
        }
      })

    return NextResponse.json({
      success: true,
      contacts: enrichedContacts,
      from_cache: false,
      credits_used: results.length
    })

  } catch (error) {
    console.error('Error enriching contacts:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Failed to enrich contacts'
    }, { status: 500 })
  }
}
