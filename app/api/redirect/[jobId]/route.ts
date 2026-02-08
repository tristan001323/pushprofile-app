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
// Adzuna hosts some jobs directly but has a "Postuler" button linking to the real source
async function extractApplyUrlFromAdzuna(adzunaUrl: string): Promise<string | null> {
  try {
    const response = await fetch(adzunaUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    })

    if (!response.ok) return null

    const html = await response.text()

    // Look for the apply button link - Adzuna uses various patterns
    // Pattern 1: <a href="..." class="...apply..."
    // Pattern 2: data-apply-url="..."
    // Pattern 3: onclick="window.open('...')"

    // Try to find apply URL in href attributes
    const applyLinkMatch = html.match(/href=["']([^"']+)["'][^>]*(?:class=["'][^"']*(?:apply|postuler|candidat)[^"']*["']|>(?:[^<]*(?:Postuler|Apply|Candidater)))/i)
    if (applyLinkMatch && applyLinkMatch[1] && !applyLinkMatch[1].includes('adzuna')) {
      const url = applyLinkMatch[1]
      return url.startsWith('http') ? url : null
    }

    // Try data attribute pattern
    const dataApplyMatch = html.match(/data-(?:apply-url|href|redirect)=["']([^"']+)["']/i)
    if (dataApplyMatch && dataApplyMatch[1] && !dataApplyMatch[1].includes('adzuna')) {
      const url = dataApplyMatch[1]
      return url.startsWith('http') ? url : null
    }

    // Try to find external URL in "Postuler à ce poste" button area
    const postulerSectionMatch = html.match(/Postuler[^<]*<\/[^>]+>[\s\S]{0,500}?href=["']([^"']+)["']/i)
    if (postulerSectionMatch && postulerSectionMatch[1] && !postulerSectionMatch[1].includes('adzuna')) {
      const url = postulerSectionMatch[1]
      return url.startsWith('http') ? url : null
    }

    return null
  } catch (error) {
    console.error('Error extracting apply URL from Adzuna:', error)
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
