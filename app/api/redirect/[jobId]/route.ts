import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const getSupabase = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase credentials')
  return createClient(url, key)
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params
  const supabase = getSupabase()

  // Get the job URL from matches table
  const { data: match } = await supabase
    .from('matches')
    .select('job_url')
    .eq('id', jobId)
    .single()

  if (!match?.job_url) {
    // Fallback to searches page if job not found
    return NextResponse.redirect(new URL('/searches', request.url))
  }

  // Redirect to the actual job URL (hides Adzuna URLs from client)
  return NextResponse.redirect(match.job_url)
}
