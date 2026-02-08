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

// Extract the actual apply URL from an Adzuna details page
// Adzuna shows popups asking for email, but has a "Non merci, je veux voir l'offre" link
// that goes to the actual job site
async function extractApplyUrlFromAdzuna(adzunaUrl: string): Promise<string | null> {
  try {
    const response = await fetch(adzunaUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8'
      }
    })

    if (!response.ok) {
      console.log(`[Adzuna Extract] Failed to fetch page: ${response.status}`)
      return null
    }

    const html = await response.text()

    // Pattern 1: "Non merci, je veux voir l'offre d'emploi" link - this is the key one!
    const nonMerciMatch = html.match(/href=["']([^"']+)["'][^>]*>[^<]*(?:Non merci|voir l'offre|see the job)/i)
    if (nonMerciMatch && nonMerciMatch[1]) {
      const url = nonMerciMatch[1]
      if (!url.includes('adzuna') && url.startsWith('http')) {
        console.log(`[Adzuna Extract] Found "Non merci" link: ${url}`)
        return url
      }
    }

    // Pattern 2: Look for the link with "Non merci" text anywhere
    const nonMerciMatch2 = html.match(/<a[^>]+href=["']([^"']+)["'][^>]*>[\s\S]*?Non merci[\s\S]*?<\/a>/i)
    if (nonMerciMatch2 && nonMerciMatch2[1]) {
      const url = nonMerciMatch2[1]
      if (!url.includes('adzuna') && url.startsWith('http')) {
        console.log(`[Adzuna Extract] Found "Non merci" link (pattern 2): ${url}`)
        return url
      }
    }

    // Pattern 3: Look for external job URLs in the page (inzejob, welcometothejungle, etc.)
    const externalJobMatch = html.match(/href=["'](https?:\/\/(?:www\.)?(?:inzejob|welcometothejungle|wttj|talent\.com|indeed|linkedin|apec|cadremploi|meteojob|hellowork|regionsjob|monster|francetravail|pole-emploi)[^"']+)["']/i)
    if (externalJobMatch && externalJobMatch[1]) {
      console.log(`[Adzuna Extract] Found external job URL: ${externalJobMatch[1]}`)
      return externalJobMatch[1]
    }

    // Pattern 4: Look for any external URL in data-href or data-url attributes
    const dataUrlMatch = html.match(/data-(?:href|url|redirect|link)=["'](https?:\/\/(?!.*adzuna)[^"']+)["']/i)
    if (dataUrlMatch && dataUrlMatch[1]) {
      console.log(`[Adzuna Extract] Found data-url: ${dataUrlMatch[1]}`)
      return dataUrlMatch[1]
    }

    // Pattern 5: Look for onclick with window.open or window.location containing external URL
    const onclickMatch = html.match(/onclick=["'][^"']*(?:window\.open|window\.location)[^"']*["'](https?:\/\/(?!.*adzuna)[^"']+)["']/i)
    if (onclickMatch && onclickMatch[1]) {
      console.log(`[Adzuna Extract] Found onclick URL: ${onclickMatch[1]}`)
      return onclickMatch[1]
    }

    // Pattern 6: Generic external http URL that's not adzuna (last resort)
    const anyExternalMatch = html.match(/href=["'](https?:\/\/(?!(?:www\.)?adzuna)[a-z0-9.-]+\.[a-z]{2,}\/[^"']*(?:job|emploi|offre|career|apply)[^"']*)["']/i)
    if (anyExternalMatch && anyExternalMatch[1]) {
      console.log(`[Adzuna Extract] Found generic external URL: ${anyExternalMatch[1]}`)
      return anyExternalMatch[1]
    }

    console.log(`[Adzuna Extract] No external URL found in page`)
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
      // Step 1: Follow redirect chain
      const redirectedUrl = await getFinalUrl(match.job_url)
      console.log(`[Redirect] Adzuna redirect: ${match.job_url} -> ${redirectedUrl}`)

      // Step 2: If we're still on Adzuna, try to extract the apply URL from the page
      if (redirectedUrl.includes('adzuna.fr') || redirectedUrl.includes('adzuna.com')) {
        const applyUrl = await extractApplyUrlFromAdzuna(redirectedUrl)
        if (applyUrl) {
          console.log(`[Redirect] Extracted apply URL: ${applyUrl}`)
          finalUrl = applyUrl
        } else {
          // Couldn't extract, use the Adzuna page as fallback
          console.log(`[Redirect] No apply URL found, using Adzuna page`)
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
