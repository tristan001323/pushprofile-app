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

// Helper to generate possible domains from company name
function generatePossibleDomains(companyName: string, providedDomain?: string): string[] {
  if (providedDomain) {
    // Clean the domain
    const clean = providedDomain.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0]
    return [clean]
  }

  const domains: string[] = []

  // Clean the full name
  const fullClean = companyName.toLowerCase()
    .replace(/\s*(sas|sarl|sa|inc|ltd|gmbh|group|france|global|education|tech|digital|consulting|solutions|services)\s*/gi, ' ')
    .trim()
    .replace(/\s+/g, '') // No spaces version
    .replace(/[^a-z0-9]/g, '')

  // First word only
  const words = companyName.toLowerCase().split(/\s+/)
  const firstWord = words[0].replace(/[^a-z0-9]/g, '')

  // Hyphenated version (first 2-3 words)
  const hyphenated = words.slice(0, 3)
    .map(w => w.replace(/[^a-z0-9]/g, ''))
    .filter(w => w.length > 0 && !['sas', 'sarl', 'sa', 'inc', 'ltd', 'gmbh', 'the', 'le', 'la', 'les'].includes(w))
    .join('-')

  // Generate variations with different TLDs
  const bases = [firstWord, hyphenated, fullClean].filter(b => b && b.length > 2)
  const tlds = ['.com', '.fr', '.io', '.co']

  for (const base of bases) {
    for (const tld of tlds) {
      const domain = base + tld
      if (!domains.includes(domain)) {
        domains.push(domain)
      }
    }
  }

  console.log(`[Domain] Generated ${domains.length} possible domains for "${companyName}":`, domains.slice(0, 6))
  return domains.slice(0, 6) // Max 6 attempts
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

    // Generate possible domains to try
    const possibleDomains = generatePossibleDomains(company_name, company_domain)

    if (possibleDomains.length === 0) {
      return NextResponse.json({ error: 'Could not determine company domain' }, { status: 400 })
    }

    console.log(`Enriching contacts for ${company_name}`)

    // 1. Check cache first (for any of the possible domains)
    for (const domain of possibleDomains) {
      const { data: cachedContacts } = await supabase
        .from('contacts_cache')
        .select('*')
        .eq('company_domain', domain.toLowerCase())
        .gte('enriched_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())

      if (cachedContacts && cachedContacts.length > 0) {
        console.log(`Found ${cachedContacts.length} cached contacts for ${domain}`)
        return NextResponse.json({
          success: true,
          contacts: cachedContacts,
          from_cache: true,
          credits_used: 0
        })
      }
    }

    // 2. Try each domain until we find contacts
    let results: DecisionMakerOutput[] = []
    let successDomain: string | null = null

    for (const domain of possibleDomains) {
      console.log(`[Try] Searching domain: ${domain}`)

      const input = {
        domain: domain,
        seniority: ["c_suite", "director", "vp", "head", "manager"],
        maxLeadsPerDomain: 3
      }

      const domainResults = await runApifyActor<DecisionMakerOutput>({
        actorId: APIFY_ACTORS.DECISION_MAKER_FINDER,
        input,
        timeoutSecs: 30  // Shorter timeout per attempt
      })

      // Check if we got real results (not "no emails found" message)
      const hasRealResults = domainResults.some(r =>
        r.email || r.linkedin || (r.name && !r.name.includes('no emails found'))
      )

      if (hasRealResults) {
        console.log(`[Success] Found contacts for domain: ${domain}`)
        results = domainResults
        successDomain = domain
        break
      } else {
        console.log(`[No results] Domain ${domain} returned no contacts`)
      }
    }

    console.log(`Decision Maker Finder returned ${results.length} contacts`)

    // DEBUG: Log raw results
    if (results.length > 0) {
      console.log('Raw Decision Maker results:', JSON.stringify(results, null, 2))
    }

    // Use the successful domain or fallback to first one
    const domain = successDomain || possibleDomains[0]

    // 3. Normalize results to our format
    // Note: API returns fields like "01_Name", "04_Email", etc.
    const enrichedContacts: EnrichedContact[] = results
      .map((contact: any) => {
        // Handle both old format (name, email) and new format (01_Name, 04_Email)
        const name = contact.name || contact['01_Name'] || ''
        const email = contact.email || contact['04_Email'] || null
        const phone = contact.phone || contact['05_Phone_number'] || null
        const linkedin = contact.linkedin || contact['06_Linkedin_url'] || null
        const title = contact.title || contact['07_Title'] || null
        const companyName = contact.company || contact['16_Company_name'] || company_name

        // Skip "no emails found" placeholder entries
        if (name.includes('no emails found')) {
          return null
        }

        const { firstName, lastName } = splitName(name)
        return {
          full_name: name || null,
          first_name: contact['02_First_name'] || firstName || null,
          last_name: contact['03_Last_name'] || lastName || null,
          job_title: title,
          email: email,
          phone: phone,
          linkedin_url: linkedin,
          company_name: companyName,
          company_domain: contact['17_Query_domain'] || domain
        }
      })
      // Filter out null entries and contacts without useful data
      .filter((contact): contact is EnrichedContact =>
        contact !== null &&
        ((contact.full_name && contact.full_name.trim().length > 0) ||
        contact.email ||
        contact.linkedin_url)
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
