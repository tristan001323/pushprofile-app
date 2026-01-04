'use client'

import { useState, useEffect, use } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

type Match = {
  id: string
  search_id: string
  job_title: string
  company_name: string
  location: string
  job_url: string
  score: number
  score_display: number
  justification: string
  status: string
  rank: number
  posted_date: string
  matching_details: any
}

export default function MatchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const router = useRouter()
  const [match, setMatch] = useState<Match | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadMatch()
  }, [])

  const loadMatch = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      router.push('/login')
      return
    }

    const { data } = await supabase
      .from('matches')
      .select('*')
      .eq('id', resolvedParams.id)
      .single()

    if (data) setMatch(data)
    setLoading(false)
  }

  const updateStatus = async (newStatus: string) => {
    if (!match) return

    const { error } = await supabase
      .from('matches')
      .update({ status: newStatus })
      .eq('id', match.id)

    if (!error) {
      setMatch({ ...match, status: newStatus })
    }
  }

  if (loading || !match) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#F8F9FA' }}>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: '#A8DADC' }}></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-8" style={{ backgroundColor: '#F8F9FA' }}>
      <div className="max-w-4xl mx-auto">
        <Button variant="outline" onClick={() => router.push(`/searches/${match.search_id}`)} className="mb-6">
          ← Retour aux résultats
        </Button>

        <Card className="p-8 shadow-lg mb-6">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h1 className="text-3xl font-bold mb-2" style={{ color: '#1D3557' }}>{match.job_title}</h1>
              <div className="flex gap-4 text-lg" style={{ color: '#457B9D' }}>
                <span>🏢 {match.company_name}</span>
                <span>•</span>
                <span>📍 {match.location}</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-4xl font-bold mb-2" style={{ color: match.score >= 70 ? '#059669' : match.score >= 50 ? '#d97706' : '#6b7280' }}>
                {match.score_display ? match.score_display.toFixed(1) : (match.score / 10).toFixed(1)}/10
              </div>
              {match.rank <= 10 && (
                <span className="px-3 py-1 rounded text-sm font-semibold" style={{ backgroundColor: '#E63946', color: 'white' }}>
                  TOP 10
                </span>
              )}
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-semibold mb-2" style={{ color: '#1D3557' }}>Statut</label>
            <Select value={match.status} onValueChange={updateStatus}>
              <SelectTrigger className="w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="nouveau">Nouveau</SelectItem>
                <SelectItem value="a_contacter">À contacter</SelectItem>
                <SelectItem value="rdv_pris">RDV pris</SelectItem>
                <SelectItem value="refuse">Refusé</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {match.justification && (
            <div className="mb-6 p-4 rounded-lg" style={{ backgroundColor: '#F1FAEE' }}>
              <h3 className="font-semibold mb-2" style={{ color: '#1D3557' }}>💡 Analyse de correspondance</h3>
              <p style={{ color: '#457B9D' }}>{match.justification}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 mb-6">
            {match.posted_date && (
              <div>
                <p className="text-sm font-semibold" style={{ color: '#1D3557' }}>Date de publication</p>
                <p style={{ color: '#457B9D' }}>{new Date(match.posted_date).toLocaleDateString('fr-FR')}</p>
              </div>
            )}
            {match.matching_details?.salary_min && (
              <div>
                <p className="text-sm font-semibold" style={{ color: '#1D3557' }}>Salaire</p>
                <p style={{ color: '#457B9D' }}>{match.matching_details.salary_min}€ - {match.matching_details.salary_max}€</p>
              </div>
            )}
          </div>

          <div className="flex gap-4">
            <Button onClick={() => window.open(match.job_url, '_blank')} style={{ backgroundColor: '#E63946', color: 'white' }}>
              Voir l'offre complète →
            </Button>
          </div>
        </Card>
      </div>
    </div>
  )
}
