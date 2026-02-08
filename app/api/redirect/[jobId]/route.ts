import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const getSupabase = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase credentials')
  return createClient(url, key)
}

// Follow redirect chain to get the final destination URL
// This hides intermediate URLs (like Adzuna) from the client
async function getFinalUrl(url: string, maxRedirects: number = 5): Promise<string> {
  let currentUrl = url
  let redirectCount = 0

  while (redirectCount < maxRedirects) {
    try {
      // Use HEAD request with redirect: 'manual' to check for redirects without downloading content
      const response = await fetch(currentUrl, {
        method: 'HEAD',
        redirect: 'manual',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; PushProfile/1.0)'
        }
      })

      // Check if it's a redirect (3xx status)
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location')
        if (location) {
          // Handle relative URLs
          currentUrl = location.startsWith('http') ? location : new URL(location, currentUrl).href
          redirectCount++
          continue
        }
      }

      // No more redirects, return current URL
      return currentUrl
    } catch (error) {
      console.error('Error following redirect:', error)
      // On error, return the last known URL
      return currentUrl
    }
  }

  // Max redirects reached, return current URL
  return currentUrl
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params
  const supabase = getSupabase()

  // Get the job URL and source_engine from matches table
  const { data: match } = await supabase
    .from('matches')
    .select('job_url, source_engine')
    .eq('id', jobId)
    .single()

  if (!match?.job_url) {
    // Fallback to searches page if job not found
    return NextResponse.redirect(new URL('/searches', request.url))
  }

  let finalUrl = match.job_url

  // For Adzuna jobs, follow the redirect chain to get the final URL
  // This hides the adzuna.fr URL from the client's browser
  if (match.source_engine === 'adzuna' || match.job_url.includes('adzuna')) {
    try {
      finalUrl = await getFinalUrl(match.job_url)
      console.log(`[Redirect] Adzuna URL resolved: ${match.job_url} -> ${finalUrl}`)
    } catch (error) {
      console.error('[Redirect] Failed to resolve Adzuna URL, using original:', error)
      // Fall back to original URL if resolution fails
    }
  }

  // Redirect to the final URL (client never sees Adzuna)
  return NextResponse.redirect(finalUrl)
}
