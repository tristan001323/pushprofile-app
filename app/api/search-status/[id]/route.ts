import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const getSupabase = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase credentials')
  return createClient(url, key)
}

// Step labels for frontend display
const STEP_LABELS: Record<string, { label: string; progress: number }> = {
  'parsing': { label: 'Analyse des critères...', progress: 10 },
  'scraping': { label: 'Recherche sur les jobboards...', progress: 30 },
  'filtering': { label: 'Filtrage des résultats...', progress: 70 },
  'scoring': { label: 'Scoring IA des meilleurs matchs...', progress: 85 },
  'saving': { label: 'Sauvegarde des résultats...', progress: 95 },
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: searchId } = await params
    const supabase = getSupabase()

    const { data: search, error } = await supabase
      .from('searches')
      .select('id, status, processing_step, error_message, name, created_at')
      .eq('id', searchId)
      .single()

    if (error || !search) {
      return NextResponse.json({ error: 'Search not found' }, { status: 404 })
    }

    // Get match count if completed
    let matchCount = 0
    if (search.status === 'completed') {
      const { count } = await supabase
        .from('matches')
        .select('id', { count: 'exact', head: true })
        .eq('search_id', searchId)
      matchCount = count || 0
    }

    // Build response
    const stepInfo = search.processing_step ? STEP_LABELS[search.processing_step] : null

    return NextResponse.json({
      id: search.id,
      name: search.name,
      status: search.status,
      processing_step: search.processing_step,
      step_label: stepInfo?.label || null,
      progress: search.status === 'completed' ? 100 : (stepInfo?.progress || 0),
      error_message: search.error_message,
      match_count: matchCount,
      created_at: search.created_at
    })

  } catch (error) {
    console.error('Error fetching search status:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Failed to fetch status'
    }, { status: 500 })
  }
}
