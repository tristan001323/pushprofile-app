'use client'

import { useState, useEffect, use } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-indigo-50/30 to-purple-50/20">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-xl shadow-indigo-500/30 animate-pulse">
              <span className="text-white font-bold text-2xl">P</span>
            </div>
            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 animate-ping" />
          </div>
        </div>
      </div>
    )
  }

  const getScoreColor = (score: number) => {
    if (score >= 70) return 'from-emerald-500 to-teal-500'
    if (score >= 50) return 'from-amber-500 to-orange-500'
    return 'from-gray-400 to-gray-500'
  }

  return (
    <div className="min-h-screen p-4 md:p-8 bg-gradient-to-br from-slate-50 via-indigo-50/30 to-purple-50/20">
      {/* Background decorations */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-br from-indigo-200/20 to-purple-200/20 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-gradient-to-tr from-blue-200/20 to-cyan-200/20 rounded-full blur-3xl" />
      </div>

      <div className="max-w-4xl mx-auto relative">
        <Button
          variant="outline"
          onClick={() => router.push(`/searches/${match.search_id}`)}
          className="mb-6 rounded-xl hover:bg-white/80"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Retour aux resultats
        </Button>

        <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-4 md:p-8 shadow-xl border border-white/50 mb-6">
          <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4 mb-6">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold mb-2 text-gray-900">{match.job_title}</h1>
              <div className="flex flex-wrap gap-2 md:gap-4 text-base md:text-lg text-gray-500">
                <span className="flex items-center gap-1.5">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  {match.company_name}
                </span>
                <span className="hidden md:inline text-gray-300">|</span>
                <span className="flex items-center gap-1.5">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {match.location}
                </span>
              </div>
            </div>
            <div className="text-left md:text-right">
              <div className={`text-4xl font-bold bg-gradient-to-r ${getScoreColor(match.score)} bg-clip-text text-transparent`}>
                {match.score_display ? match.score_display.toFixed(1) : (match.score / 10).toFixed(1)}/10
              </div>
              {match.rank <= 10 && (
                <span className="inline-block mt-2 px-3 py-1 rounded-full text-sm font-semibold bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/30">
                  TOP 10
                </span>
              )}
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-semibold mb-2 text-gray-900">Statut</label>
            <Select value={match.status} onValueChange={updateStatus}>
              <SelectTrigger className="w-64 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="nouveau">Nouveau</SelectItem>
                <SelectItem value="a_contacter">A contacter</SelectItem>
                <SelectItem value="rdv_pris">RDV pris</SelectItem>
                <SelectItem value="refuse">Refuse</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {match.justification && (
            <div className="mb-6 p-5 rounded-xl bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200/50">
              <h3 className="font-semibold mb-2 text-gray-900 flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </span>
                Analyse de correspondance
              </h3>
              <p className="text-gray-600 leading-relaxed">{match.justification}</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {match.posted_date && (
              <div className="p-4 rounded-xl bg-gray-50 border border-gray-200/50">
                <p className="text-sm font-semibold text-gray-900">Date de publication</p>
                <p className="text-gray-500">{new Date(match.posted_date).toLocaleDateString('fr-FR')}</p>
              </div>
            )}
            {match.matching_details?.salary_min && (
              <div className="p-4 rounded-xl bg-gray-50 border border-gray-200/50">
                <p className="text-sm font-semibold text-gray-900">Salaire</p>
                <p className="text-gray-500">{match.matching_details.salary_min}€ - {match.matching_details.salary_max}€</p>
              </div>
            )}
          </div>

          <div className="flex gap-4">
            <Button
              onClick={() => window.open(match.job_url, '_blank')}
              className="h-12 px-6 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-lg shadow-indigo-500/30 transition-all duration-300"
            >
              Voir l'offre complete
              <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
