import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { runApifyActor, APIFY_ACTORS, DecisionMakerOutput } from '@/lib/apify'
import { callClaude } from '@/lib/claude'

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
  job_description?: string  // Job description to extract recruiter names from
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

// Use Claude to find the company domain
async function findDomainWithClaude(companyName: string): Promise<string | null> {
  try {
    const prompt = `Quel est le domaine web principal de l'entreprise "${companyName}" ?

Reponds UNIQUEMENT avec le domaine (ex: google.com, microsoft.com, airbnb.fr).
Si tu ne connais pas, reponds "unknown".
Pas d'explication, juste le domaine.`

    const response = await callClaude({
      model: 'sonnet',  // Sonnet is more reliable for finding correct domains
      prompt,
      maxTokens: 50
    })

    const domain = response.text.trim().toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .split('/')[0]
      .replace(/[^a-z0-9.-]/g, '')

    if (domain && domain !== 'unknown' && domain.includes('.')) {
      console.log(`[Claude] Found domain for "${companyName}": ${domain}`)
      return domain
    }

    console.log(`[Claude] Could not find domain for "${companyName}"`)
    return null
  } catch (error) {
    console.error('[Claude] Error finding domain:', error)
    return null
  }
}

// Fallback: generate possible domains from company name
function generateFallbackDomains(companyName: string): string[] {
  const words = companyName.toLowerCase().split(/\s+/)
  const firstWord = words[0].replace(/[^a-z0-9]/g, '')

  return [
    `${firstWord}.com`,
    `${firstWord}.fr`,
    `${firstWord}.io`
  ].filter(d => d.length > 4)
}

// Helper to split full name into first/last
function splitName(fullName: string): { firstName: string; lastName: string } {
  const nameParts = (fullName || '').trim().split(/\s+/)
  const firstName = nameParts[0] || ''
  const lastName = nameParts.slice(1).join(' ') || ''
  return { firstName, lastName }
}

// Extract recruiter/HR names from job description using Claude
async function extractRecruiterNames(description: string, companyName: string): Promise<Array<{ firstName: string; lastName: string; jobTitle: string }>> {
  if (!description || description.length < 50) return []

  try {
    const prompt = `Analyse cette offre d'emploi et extrait les noms des recruteurs, RH, ou personnes de contact mentionnées.

Offre d'emploi:
"""
${description.substring(0, 3000)}
"""

Cherche:
- Noms après "Contact:", "Recruteur:", "Votre contact:", "Responsable RH:", etc.
- Noms dans les signatures (ex: "Marie Dupont, Talent Acquisition Manager")
- Noms après "Pour postuler, contactez" ou similaire
- Noms LinkedIn mentionnés
- Noms dans "Publié par", "Posted by", etc.

Réponds en JSON uniquement, format:
[{"firstName": "Marie", "lastName": "Dupont", "jobTitle": "Talent Acquisition Manager"}]

Si aucun nom trouvé, réponds: []
Pas d'explication, juste le JSON.`

    const response = await callClaude({
      model: 'haiku',  // Haiku is enough for extraction
      prompt,
      maxTokens: 200
    })

    const text = response.text.trim()
    // Extract JSON from response (handle potential markdown code blocks)
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) return []

    const names = JSON.parse(jsonMatch[0])
    console.log(`[Recruiter Extract] Found ${names.length} names in job description`)
    return names.filter((n: any) => n.firstName && n.lastName)
  } catch (error) {
    console.error('[Recruiter Extract] Error:', error)
    return []
  }
}

// Generate common HR/recruiting email aliases
function generateHREmailAliases(domain: string): EnrichedContact[] {
  const aliases = ['recrutement', 'rh', 'careers', 'jobs', 'hiring', 'talent', 'hr']
  return aliases.map(alias => ({
    full_name: null,
    first_name: null,
    last_name: null,
    job_title: 'Contact RH',
    email: `${alias}@${domain}`,
    phone: null,
    linkedin_url: null,
    company_name: null,
    company_domain: domain
  }))
}

// Email pattern types
type EmailPattern =
  | 'first.last'      // john.doe@company.com
  | 'firstlast'       // johndoe@company.com
  | 'first_last'      // john_doe@company.com
  | 'flast'           // jdoe@company.com
  | 'firstl'          // johnd@company.com
  | 'first'           // john@company.com
  | 'lfirst'          // doejohn@company.com
  | 'last.first'      // doe.john@company.com
  | 'unknown'

// Normalize French accents for email generation
function normalizeForEmail(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^a-z]/g, '') // Remove non-letters
}

// Detect email pattern from a known email + name
function detectEmailPattern(email: string, firstName: string, lastName: string): EmailPattern {
  if (!email || !firstName || !lastName) return 'unknown'

  const localPart = email.split('@')[0].toLowerCase()
  const first = normalizeForEmail(firstName)
  const last = normalizeForEmail(lastName)

  if (!first || !last) return 'unknown'

  // Check patterns in order of commonality
  if (localPart === `${first}.${last}`) return 'first.last'
  if (localPart === `${first}${last}`) return 'firstlast'
  if (localPart === `${first}_${last}`) return 'first_last'
  if (localPart === `${first[0]}${last}`) return 'flast'
  if (localPart === `${first}${last[0]}`) return 'firstl'
  if (localPart === first) return 'first'
  if (localPart === `${last}${first}`) return 'lfirst'
  if (localPart === `${last}.${first}`) return 'last.first'

  return 'unknown'
}

// Generate email from pattern
function generateEmail(firstName: string, lastName: string, domain: string, pattern: EmailPattern): string | null {
  if (!firstName || !lastName || !domain || pattern === 'unknown') return null

  const first = normalizeForEmail(firstName)
  const last = normalizeForEmail(lastName)

  if (!first || !last) return null

  const localParts: Record<EmailPattern, string> = {
    'first.last': `${first}.${last}`,
    'firstlast': `${first}${last}`,
    'first_last': `${first}_${last}`,
    'flast': `${first[0]}${last}`,
    'firstl': `${first}${last[0]}`,
    'first': first,
    'lfirst': `${last}${first}`,
    'last.first': `${last}.${first}`,
    'unknown': ''
  }

  const localPart = localParts[pattern]
  return localPart ? `${localPart}@${domain}` : null
}

// Detect the most common email pattern from a list of contacts
function detectCompanyEmailPattern(contacts: EnrichedContact[]): { pattern: EmailPattern; confidence: number } {
  const patterns: Record<EmailPattern, number> = {
    'first.last': 0,
    'firstlast': 0,
    'first_last': 0,
    'flast': 0,
    'firstl': 0,
    'first': 0,
    'lfirst': 0,
    'last.first': 0,
    'unknown': 0
  }

  for (const contact of contacts) {
    if (contact.email && contact.first_name && contact.last_name) {
      const pattern = detectEmailPattern(contact.email, contact.first_name, contact.last_name)
      patterns[pattern]++
    }
  }

  // Find the most common pattern (excluding unknown)
  let bestPattern: EmailPattern = 'unknown'
  let maxCount = 0

  for (const [pattern, count] of Object.entries(patterns)) {
    if (pattern !== 'unknown' && count > maxCount) {
      maxCount = count
      bestPattern = pattern as EmailPattern
    }
  }

  const totalKnown = Object.entries(patterns)
    .filter(([p]) => p !== 'unknown')
    .reduce((sum, [, count]) => sum + count, 0)

  const confidence = totalKnown > 0 ? maxCount / totalKnown : 0

  console.log(`[Email Pattern] Detected pattern: ${bestPattern} (confidence: ${(confidence * 100).toFixed(0)}%, from ${totalKnown} emails)`)

  return { pattern: bestPattern, confidence }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabase()
    const body: EnrichContactRequest = await request.json()
    const { company_name, company_domain, match_id, user_id, job_description } = body

    if (!company_name) {
      return NextResponse.json({ error: 'company_name is required' }, { status: 400 })
    }

    if (!user_id) {
      return NextResponse.json({ error: 'user_id is required' }, { status: 400 })
    }

    console.log(`Enriching contacts for ${company_name}`)

    // 1. Determine domain: use provided, or ask Claude, or fallback to guessing
    let domain: string | null = null

    if (company_domain) {
      domain = company_domain.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0]
      console.log(`[Domain] Using provided domain: ${domain}`)
    } else {
      // Ask Claude to find the domain
      domain = await findDomainWithClaude(company_name)

      // Fallback to simple guessing if Claude doesn't know
      if (!domain) {
        const fallbacks = generateFallbackDomains(company_name)
        domain = fallbacks[0] || null
        console.log(`[Domain] Using fallback domain: ${domain}`)
      }
    }

    if (!domain) {
      return NextResponse.json({ error: 'Could not determine company domain' }, { status: 400 })
    }

    // 2. Check cache first
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

    // 3. Call Decision Maker Email Finder API
    console.log(`[Search] Searching contacts for domain: ${domain}`)

    // Decision Maker Finder - just use domain, let it return what it finds
    // The recruiter extraction from job descriptions will add HR contacts
    const input = {
      domain: domain,
      maxLeadsPerDomain: 20  // Increased to get more contacts
    }

    const results = await runApifyActor<DecisionMakerOutput>({
      actorId: APIFY_ACTORS.DECISION_MAKER_FINDER,
      input,
      timeoutSecs: 60
    })

    console.log(`Decision Maker Finder returned ${results.length} results`)

    // DEBUG: Log raw results
    if (results.length > 0) {
      console.log('Raw Decision Maker results:', JSON.stringify(results, null, 2))
    }

    // 4. Normalize results to our format
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

    // 5. Detect email pattern and generate emails for contacts without them
    const { pattern: emailPattern, confidence } = detectCompanyEmailPattern(enrichedContacts)

    if (emailPattern !== 'unknown' && confidence >= 0.5) {
      // Generate emails for contacts that have names but no email
      for (const contact of enrichedContacts) {
        if (!contact.email && contact.first_name && contact.last_name) {
          const generatedEmail = generateEmail(contact.first_name, contact.last_name, domain, emailPattern)
          if (generatedEmail) {
            contact.email = generatedEmail
            console.log(`[Email Gen] Generated email for ${contact.full_name}: ${generatedEmail}`)
          }
        }
      }
    }

    // 6. Extract recruiter names from job description and generate their emails
    if (job_description && emailPattern !== 'unknown') {
      const recruiterNames = await extractRecruiterNames(job_description, company_name)

      for (const recruiter of recruiterNames) {
        // Check if we already have this person
        const alreadyExists = enrichedContacts.some(c =>
          c.first_name?.toLowerCase() === recruiter.firstName.toLowerCase() &&
          c.last_name?.toLowerCase() === recruiter.lastName.toLowerCase()
        )
        if (alreadyExists) continue

        // Generate email using detected pattern
        const generatedEmail = generateEmail(recruiter.firstName, recruiter.lastName, domain, emailPattern)

        enrichedContacts.push({
          full_name: `${recruiter.firstName} ${recruiter.lastName}`,
          first_name: recruiter.firstName,
          last_name: recruiter.lastName,
          job_title: recruiter.jobTitle || 'Recruteur',
          email: generatedEmail,
          phone: null,
          linkedin_url: null,
          company_name: company_name,
          company_domain: domain
        })

        console.log(`[Recruiter] Added ${recruiter.firstName} ${recruiter.lastName} (${recruiter.jobTitle}) with email: ${generatedEmail}`)
      }
    }

    // 7. Add generic HR email aliases if we have few contacts with emails
    const contactsWithEmail = enrichedContacts.filter(c => c.email).length
    if (contactsWithEmail < 3) {
      console.log(`[HR Aliases] Only ${contactsWithEmail} contacts with email, adding generic HR aliases`)
      const hrAliases = generateHREmailAliases(domain)
      // Add only a few aliases to not overwhelm
      const aliasesToAdd = hrAliases.slice(0, 3)
      for (const alias of aliasesToAdd) {
        alias.company_name = company_name
        enrichedContacts.push(alias)
      }
      console.log(`[HR Aliases] Added ${aliasesToAdd.length} generic HR emails`)
    }

    // 8. Cache the results AND save to user's contacts
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

    // 9. If match_id provided, update the match with contact info
    if (match_id && enrichedContacts.length > 0) {
      const primaryContact = enrichedContacts[0]
      await supabase
        .from('matches')
        .update({
          enriched_contacts: enrichedContacts
        })
        .eq('id', match_id)
    }

    // 10. Log usage for billing
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
