import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const getSupabase = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase credentials')
  return createClient(url, key)
}

// Follow redirect chain to get the final destination URL
async function getFinalUrl(url: string, maxRedirects: number = 5): Promise<string> {
  let currentUrl = url
  let redirectCount = 0

  while (redirectCount < maxRedirects) {
    try {
      const response = await fetch(currentUrl, {
        method: 'HEAD',
        redirect: 'manual',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      })

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location')
        if (location) {
          currentUrl = location.startsWith('http') ? location : new URL(location, currentUrl).href
          redirectCount++
          continue
        }
      }

      return currentUrl
    } catch (error) {
      console.error('Error following redirect:', error)
      return currentUrl
    }
  }

  return currentUrl
}

// Known job board domains to look for
const JOB_BOARD_DOMAINS = [
  'welcometothejungle', 'wttj', 'talent.com', 'indeed', 'linkedin', 'apec.fr',
  'cadremploi', 'meteojob', 'hellowork', 'regionsjob', 'monster', 'francetravail',
  'pole-emploi', 'jobteaser', 'glassdoor', 'simplyhired', 'neuvoo', 'jooble',
  'optioncarriere', 'emploi-store', 'keljob', 'qapa', 'staffme', 'leboncoin',
  'HelloWork', 'lesjeudis', 'choosemycompany', 'jobijoba', 'wizbii', 'studentjob',
  'greenhouse.io', 'lever.co', 'workday', 'smartrecruiters', 'ashbyhq', 'jobs.lever',
  'boards.greenhouse', 'apply.workable', 'jobs.ashbyhq', 'recruitee', 'breezy',
  'taleo', 'icims', 'successfactors', 'myworkdayjobs', 'ultipro'
]

// Extract the actual job URL from an Adzuna details page
async function extractApplyUrlFromAdzuna(adzunaUrl: string): Promise<string | null> {
  try {
    const response = await fetch(adzunaUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
        'Cookie': 'consent=1'  // Try to bypass consent popup
      }
    })

    if (!response.ok) {
      console.log(`[Adzuna Extract] Failed to fetch page: ${response.status}`)
      return null
    }

    const html = await response.text()
    console.log(`[Adzuna Extract] Page length: ${html.length} chars`)

    // Helper to validate URL
    const isValidExternalUrl = (url: string): boolean => {
      if (!url || !url.startsWith('http')) return false
      if (url.includes('adzuna')) return false
      if (url.includes('javascript:')) return false
      if (url.includes('#')) return false
      return true
    }

    // Pattern 1: Look for "redirect_url" or "url" in JSON data embedded in page
    const jsonUrlMatch = html.match(/["'](?:redirect_url|external_url|job_url|apply_url|source_url)["']\s*:\s*["']([^"']+)["']/i)
    if (jsonUrlMatch && isValidExternalUrl(jsonUrlMatch[1])) {
      console.log(`[Adzuna Extract] Found JSON URL: ${jsonUrlMatch[1]}`)
      return jsonUrlMatch[1]
    }

    // Pattern 2: Look for data-redirect or data-url attributes
    const dataAttrMatch = html.match(/data-(?:redirect|url|href|link|external)=["']([^"']+)["']/i)
    if (dataAttrMatch && isValidExternalUrl(dataAttrMatch[1])) {
      console.log(`[Adzuna Extract] Found data attribute URL: ${dataAttrMatch[1]}`)
      return dataAttrMatch[1]
    }

    // Pattern 3: Look for known job board URLs anywhere in the page
    const domainPattern = JOB_BOARD_DOMAINS.join('|')
    const jobBoardRegex = new RegExp(`https?://[^"'\\s<>]*(?:${domainPattern})[^"'\\s<>]*`, 'gi')
    const jobBoardMatches = html.match(jobBoardRegex)
    if (jobBoardMatches && jobBoardMatches.length > 0) {
      // Find the longest/most complete URL (likely the actual job URL)
      const bestMatch = jobBoardMatches
        .filter(url => !url.includes('adzuna'))
        .sort((a, b) => b.length - a.length)[0]
      if (bestMatch) {
        console.log(`[Adzuna Extract] Found job board URL: ${bestMatch}`)
        return bestMatch
      }
    }

    // Pattern 4: Look for "Postuler" or "Apply" button with href
    const applyButtonMatch = html.match(/<a[^>]+href=["']([^"']+)["'][^>]*>[\s\S]*?(?:Postuler|Apply|Candidater)[\s\S]*?<\/a>/i)
    if (applyButtonMatch && isValidExternalUrl(applyButtonMatch[1])) {
      console.log(`[Adzuna Extract] Found Apply button URL: ${applyButtonMatch[1]}`)
      return applyButtonMatch[1]
    }

    // Pattern 5: Look for "Non merci" link
    const nonMerciMatch = html.match(/<a[^>]+href=["']([^"']+)["'][^>]*>[\s\S]*?(?:Non merci|voir l'offre|see the job)[\s\S]*?<\/a>/gi)
    if (nonMerciMatch) {
      for (const match of nonMerciMatch) {
        const urlMatch = match.match(/href=["']([^"']+)["']/)
        if (urlMatch && isValidExternalUrl(urlMatch[1])) {
          console.log(`[Adzuna Extract] Found "Non merci" URL: ${urlMatch[1]}`)
          return urlMatch[1]
        }
      }
    }

    // Pattern 6: Look for any external https URL in href (but not adzuna/static/css/js)
    const externalHrefMatch = html.match(/href=["'](https:\/\/(?!.*(?:adzuna|static|\.css|\.js|\.png|\.jpg|fonts|analytics|tracking|google|facebook|twitter))[^"']+)["']/gi)
    if (externalHrefMatch) {
      for (const match of externalHrefMatch) {
        const urlMatch = match.match(/href=["']([^"']+)["']/)
        if (urlMatch && isValidExternalUrl(urlMatch[1]) && urlMatch[1].includes('/')) {
          // Prefer URLs with paths (not just domains)
          if (urlMatch[1].split('/').length > 3) {
            console.log(`[Adzuna Extract] Found external href: ${urlMatch[1]}`)
            return urlMatch[1]
          }
        }
      }
    }

    // Log a sample of the HTML for debugging
    console.log(`[Adzuna Extract] No URL found. HTML sample: ${html.substring(0, 1000)}...`)
    return null
  } catch (error) {
    console.error('[Adzuna Extract] Error:', error)
    return null
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params
  const supabase = getSupabase()

  const { data: match } = await supabase
    .from('matches')
    .select('job_url, source_engine')
    .eq('id', jobId)
    .single()

  if (!match?.job_url) {
    return NextResponse.redirect(new URL('/searches', request.url))
  }

  let finalUrl = match.job_url

  // For Adzuna jobs, try to get the real destination
  if (match.source_engine === 'adzuna' || match.job_url.includes('adzuna')) {
    try {
      // Step 1: Follow initial redirect chain
      const redirectedUrl = await getFinalUrl(match.job_url)
      console.log(`[Redirect] Adzuna initial redirect: ${match.job_url} -> ${redirectedUrl}`)

      // Step 2: If we're still on Adzuna, try to extract the apply URL from the page
      if (redirectedUrl.includes('adzuna.fr') || redirectedUrl.includes('adzuna.com')) {
        const extractedUrl = await extractApplyUrlFromAdzuna(redirectedUrl)
        if (extractedUrl) {
          console.log(`[Redirect] Extracted URL from page: ${extractedUrl}`)
          // Step 3: Follow the extracted URL's redirects too
          const finalExtractedUrl = await getFinalUrl(extractedUrl)
          console.log(`[Redirect] Final URL after following redirects: ${finalExtractedUrl}`)
          finalUrl = finalExtractedUrl
        } else {
          // Couldn't extract, use the Adzuna page as fallback
          console.log(`[Redirect] No URL found, using Adzuna page as fallback`)
          finalUrl = redirectedUrl
        }
      } else {
        // Redirect led to external site, use that
        finalUrl = redirectedUrl
      }
    } catch (error) {
      console.error('[Redirect] Failed to resolve Adzuna URL:', error)
    }
  }

  return NextResponse.redirect(finalUrl)
}
