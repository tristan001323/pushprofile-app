'use client'

import { useState, useEffect, use } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

type Match = {
  id: string
  job_title: string
  company_name: string
  location: string
  score: number
  score_display: number
  status: string
  rank: number
}

export default function SearchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const router = useRouter()
  const [matches, setMatches] = useState<Match[]>([])
  const [searchName, setSearchName] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadMatches()
  }, [])

  const loadMatches = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      router.push('/login')
      return
    }

    const { data: search } = await supabase
      .from('searches')
      .select('name')
      .eq('id', resolvedParams.id)
      .single()

    if (search) setSearchName(search.name)

    const { data } = await supabase
      .from('matches')
      .select('*')
      .eq('search_id', resolvedParams.id)
      .order('rank', { ascending: true })

    if (data) setMatches(data)
    setLoading(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#F8F9FA' }}>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: '#A8DADC' }}></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-8" style={{ backgroundColor: '#F8F9FA' }}>
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <Button variant="outline" onClick={() => router.push('/searches')} className="mb-4">
            ← Retour aux recherches
          </Button>
          <h1 className="text-3xl font-bold" style={{ color: '#1D3557' }}>{searchName}</h1>
          <p className="mt-2" style={{ color: '#457B9D' }}>{matches.length} opportunités trouvées</p>
        </div>

        <div className="grid gap-4">
          {matches.map((match) => (
            <Link key={match.id} href={`/match/${match.id}`}>
              <Card className="p-6 hover:shadow-xl transition-shadow cursor-pointer">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-semibold" style={{ color: '#1D3557' }}>
                        {match.job_title}
                      </h3>
                      {match.rank <= 10 && (
                        <span className="px-2 py-1 rounded text-xs font-semibold" style={{ backgroundColor: '#E63946', color: 'white' }}>
                          TOP 10
                        </span>
                      )}
                    </div>
                    <div className="flex gap-4 text-sm" style={{ color: '#457B9D' }}>
                      <span>🏢 {match.company_name}</span>
                      <span>•</span>
                      <span>📍 {match.location}</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <div className="text-2xl font-bold" style={{ color: match.score >= 70 ? '#059669' : match.score >= 50 ? '#d97706' : '#6b7280' }}>
                      {match.score_display ? match.score_display.toFixed(1) : (match.score / 10).toFixed(1)}/10
                    </div>
                    <div className="px-3 py-1 rounded-full text-xs" style={{ backgroundColor: match.status === 'nouveau' ? '#dbeafe' : '#d1fae5', color: match.status === 'nouveau' ? '#1e40af' : '#065f46' }}>
                      {match.status === 'nouveau' ? 'Nouveau' : match.status}
                    </div>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
