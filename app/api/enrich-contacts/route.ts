import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { runApifyActor, APIFY_ACTORS, DecisionMakerOutput } from '@/lib/apify'

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
  company_domain?: string  // Domain is preferred for better results
  match_id?: string
  user_id: string
}

interface EnrichedContact {
  full_name: string | null
  first_name: string | null
  last_name: string | null
  job_title: string | null
  email: string | null
  phone: string | null
  linkedin_url: string | null
  company_name: string | null
  company_domain: string | null
}

// Helper to extract domain from company name or URL
function extractDomain(companyName: string, providedDomain?: string): string | null {
  if (providedDomain) {
    // Clean the domain
    return providedDomain.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0]
  }

  // Try to guess domain from company name (basic heuristic)
  // This is a fallback - ideally the domain should be provided
  const cleanName = companyName.toLowerCase()
    .replace(/[^a-z0-9]/g, '')

  // Common French TLDs
  const possibleDomains = [
    `${cleanName}.fr`,
    `${cleanName}.com`,
    `${cleanName}.eu`
  ]

  return possibleDomains[0] // Return .fr as default guess
}

// Helper to split full name into first/last
function splitName(fullName: string): { firstName: string; lastName: string } {
  const nameParts = (fullName || '').trim().split(/\s+/)
  const firstName = nameParts[0] || ''
  const lastName = nameParts.slice(1).join(' ') || ''
  return { firstName, lastName }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabase()
    const body: EnrichContactRequest = await request.json()
    const { company_name, company_domain, match_id, user_id } = body

    if (!company_name) {
      return NextResponse.json({ error: 'company_name is required' }, { status: 400 })
    }

    if (!user_id) {
      return NextResponse.json({ error: 'user_id is required' }, { status: 400 })
    }

    // Extract or guess domain
    const domain = extractDomain(company_name, company_domain)

    if (!domain) {
      return NextResponse.json({ error: 'Could not determine company domain' }, { status: 400 })
    }

    console.log(`Enriching contacts for ${company_name} (domain: ${domain})`)

    // 1. Check cache first
    const { data: cachedContacts } = await supabase
      .from('contacts_cache')
      .select('*')
      .eq('company_domain', domain.toLowerCase())
      .gte('enriched_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()) // 30 days cache

    if (cachedContacts && cachedContacts.length > 0) {
      console.log(`Found ${cachedContacts.length} cached contacts for ${domain}`)
      return NextResponse.json({
        success: true,
        contacts: cachedContacts,
        from_cache: true,
        credits_used: 0
      })
    }

    // 2. Call Decision Maker Email Finder API
    const input = {
      domains: domain,  // String, not array
      seniority: ["c_suite", "director", "vp", "head", "manager"],
      maxLeadsPerDomain: 3
    }

    console.log(`Calling Decision Maker Finder with input:`, JSON.stringify(input))

    const results = await runApifyActor<DecisionMakerOutput>({
      actorId: APIFY_ACTORS.DECISION_MAKER_FINDER,
      input,
      timeoutSecs: 120
    })

    console.log(`Decision Maker Finder returned ${results.length} contacts`)

    // DEBUG: Log raw results
    if (results.length > 0) {
      console.log('Raw Decision Maker results:', JSON.stringify(results, null, 2))
    }

    // 3. Normalize results to our format
    const enrichedContacts: EnrichedContact[] = results
      .map(contact => {
        const { firstName, lastName } = splitName(contact.name || '')
        return {
          full_name: contact.name || null,
          first_name: firstName || null,
          last_name: lastName || null,
          job_title: contact.title || null,
          email: contact.email || null,
          phone: contact.phone || null,
          linkedin_url: contact.linkedin || null,
          company_name: contact.company || company_name,
          company_domain: contact.domain || domain
        }
      })
      // Filter out contacts without useful data
      .filter(contact =>
        (contact.full_name && contact.full_name.trim().length > 0) ||
        contact.email ||
        contact.linkedin_url
      )

    console.log(`After filtering: ${enrichedContacts.length} valid contacts`)

    // 4. Cache the results AND save to user's contacts
    if (enrichedContacts.length > 0) {
      const cacheEntries = enrichedContacts.map(contact => ({
        user_id,  // Track which user unlocked this contact
        company_name: company_name.toLowerCase(),
        company_domain: (contact.company_domain || domain).toLowerCase(),
        job_title_searched: 'decision_maker',
        full_name: contact.full_name,
        first_name: contact.first_name,
        last_name: contact.last_name,
        job_title: contact.job_title,
        email: contact.email,
        phone: contact.phone,
        linkedin_url: contact.linkedin_url,
        source: 'apify_decision_maker_finder',
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
          enriched_contacts: enrichedContacts
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
          domain,
          contacts_found: enrichedContacts.length,
          source: 'apify_decision_maker_finder'
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
