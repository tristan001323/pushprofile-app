'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Card } from '@/components/ui/card'
import AppLayout from '@/components/AppLayout'
import { useRouter } from 'next/navigation'

type MatchData = {
  id: string
  search_id: string
  rank: number
  status: string
  viewed_at: string | null
  is_favorite: boolean
  source: string
  score: number
  company_name: string
}

type Stats = {
  totalSearches: number
  totalJobs: number
  top10Jobs: number
  otherJobs: number
  viewedJobs: number
  favoriteJobs: number
  avgScoreTop10: number
  sourceCounts: { linkedin: number; adzuna: number; indeed: number; linkedin_post: number }
  statusCounts: { nouveau: number; a_contacter: number; rdv_pris: number; refuse: number }
  topCompanies: { name: string; count: number }[]
}

function computeStats(matches: MatchData[], searches: { id: string; is_favorite: boolean }[]): Stats {
  const statusCounts = {
    nouveau: matches.filter(m => m.status === 'nouveau').length,
    a_contacter: matches.filter(m => m.status === 'a_contacter').length,
    rdv_pris: matches.filter(m => m.status === 'rdv_pris').length,
    refuse: matches.filter(m => m.status === 'refuse').length,
  }

  const sourceCounts = {
    linkedin: matches.filter(m => m.source === 'linkedin').length,
    adzuna: matches.filter(m => m.source === 'adzuna').length,
    indeed: matches.filter(m => m.source === 'indeed').length,
    linkedin_post: matches.filter(m => m.source === 'linkedin_post').length,
  }

  const top10Matches = matches.filter(m => m.rank <= 10)
  const avgScoreTop10 = top10Matches.length > 0
    ? Math.round(top10Matches.reduce((sum, m) => sum + (m.score || 0), 0) / top10Matches.length)
    : 0

  // Top 5 entreprises
  const companyCounts: Record<string, number> = {}
  matches.forEach(m => {
    const name = m.company_name || 'Inconnu'
    companyCounts[name] = (companyCounts[name] || 0) + 1
  })
  const topCompanies = Object.entries(companyCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }))

  return {
    totalSearches: searches.length,
    totalJobs: matches.length,
    top10Jobs: top10Matches.length,
    otherJobs: matches.filter(m => m.rank > 10).length,
    viewedJobs: matches.filter(m => m.viewed_at).length,
    favoriteJobs: matches.filter(m => m.is_favorite).length,
    avgScoreTop10,
    sourceCounts,
    statusCounts,
    topCompanies,
  }
}

export default function DataPage() {
  const router = useRouter()
  const [allMatches, setAllMatches] = useState<MatchData[]>([])
  const [searches, setSearches] = useState<{ id: string; is_favorite: boolean }[]>([])
  const [loading, setLoading] = useState(true)
  const [filterMode, setFilterMode] = useState<'all' | 'top10'>('all')

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      router.push('/login')
      return
    }

    // Charger les recherches du user
    const { data: searchesData, error: searchError } = await supabase
      .from('searches')
      .select('id, is_favorite')
      .eq('user_id', session.user.id)

    if (searchError) {
      console.error('Error loading searches:', searchError)
    }

    if (!searchesData || searchesData.length === 0) {
      setSearches([])
      setAllMatches([])
      setLoading(false)
      return
    }

    setSearches(searchesData)
    const searchIds = new Set(searchesData.map(s => s.id))

    // Charger tous les matches et filtrer côté client
    const { data: matchesData, error: matchError } = await supabase
      .from('matches')
      .select('id, search_id, rank, status, viewed_at, is_favorite, source, score, company_name')

    if (matchError) {
      console.error('Error loading matches:', matchError)
    }

    if (matchesData) {
      // Filtrer par les recherches du user
      const userMatches = matchesData.filter(m => searchIds.has(m.search_id))
      setAllMatches(userMatches)
    }
    setLoading(false)
  }

  // Filtrer selon le mode
  const filteredMatches = filterMode === 'top10'
    ? allMatches.filter(m => m.rank <= 10)
    : allMatches

  const stats = computeStats(filteredMatches, searches)

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'nouveau': return '#6366F1'
      case 'a_contacter': return '#F59E0B'
      case 'rdv_pris': return '#10B981'
      case 'refuse': return '#EF4444'
      default: return '#9CA3AF'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'nouveau': return 'Nouveau'
      case 'a_contacter': return 'À contacter'
      case 'rdv_pris': return 'RDV pris'
      case 'refuse': return 'Refusé'
      default: return status
    }
  }

  const getSourceColor = (source: string) => {
    switch (source) {
      case 'linkedin': return '#0A66C2'
      case 'linkedin_post': return '#004182'
      case 'adzuna': return '#FF6B35'
      case 'indeed': return '#6B5CE7'
      default: return '#9CA3AF'
    }
  }

  const getSourceLabel = (source: string) => {
    switch (source) {
      case 'linkedin': return 'LinkedIn'
      case 'linkedin_post': return 'LinkedIn Post'
      case 'adzuna': return 'Adzuna'
      case 'indeed': return 'Indeed'
      default: return source
    }
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-xl shadow-indigo-500/30 animate-pulse">
                <span className="text-white font-bold text-2xl">P</span>
              </div>
              <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 animate-ping" />
            </div>
          </div>
        </div>
      </AppLayout>
    )
  }

  const totalStatusJobs = Object.values(stats.statusCounts).reduce((a, b) => a + b, 0)
  const viewedPercent = stats.totalJobs > 0 ? Math.round((stats.viewedJobs / stats.totalJobs) * 100) : 0

  // Funnel data
  const funnel = [
    { label: 'Jobs trouvés', value: stats.totalJobs, color: '#6366F1' },
    { label: 'Consultés', value: stats.viewedJobs, color: '#8B5CF6' },
    { label: 'À contacter', value: stats.statusCounts.a_contacter, color: '#F59E0B' },
    { label: 'RDV pris', value: stats.statusCounts.rdv_pris, color: '#10B981' },
  ]
  const funnelMax = funnel[0].value || 1

  return (
    <AppLayout>
      <div className="p-4 md:p-8">
        <div className="max-w-6xl mx-auto">
          {/* Header avec toggle */}
          <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Data & Analytics</h1>
                <p className="text-gray-500">Vue d'ensemble de votre activite</p>
              </div>
            </div>
            <div className="flex gap-2 bg-gray-100 rounded-xl p-1">
              <button
                onClick={() => setFilterMode('all')}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-300 ${
                  filterMode === 'all' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Tous les jobs
              </button>
              <button
                onClick={() => setFilterMode('top10')}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-300 ${
                  filterMode === 'top10' ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                TOP 10 uniquement
              </button>
            </div>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
            <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-4 md:p-6 shadow-lg border border-white/50 hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5">
              <p className="text-xs md:text-sm font-medium text-gray-500">Recherches</p>
              <p className="text-2xl md:text-3xl font-bold text-gray-900">{stats.totalSearches}</p>
            </div>
            <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-4 md:p-6 shadow-lg border border-white/50 hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5">
              <p className="text-xs md:text-sm font-medium text-gray-500">Jobs trouves</p>
              <p className="text-2xl md:text-3xl font-bold text-gray-900">{stats.totalJobs}</p>
            </div>
            <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-4 md:p-6 shadow-lg border border-white/50 hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5">
              <p className="text-xs md:text-sm font-medium text-gray-500">Jobs consultes</p>
              <p className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">{stats.viewedJobs}</p>
            </div>
            <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-4 md:p-6 shadow-lg border border-white/50 hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5">
              <p className="text-xs md:text-sm font-medium text-gray-500">Favoris</p>
              <p className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-amber-500 to-orange-500 bg-clip-text text-transparent">{stats.favoriteJobs}</p>
            </div>
            <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-4 md:p-6 shadow-lg border border-white/50 hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5">
              <p className="text-xs md:text-sm font-medium text-gray-500">Score moyen</p>
              <p className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-emerald-500 to-teal-500 bg-clip-text text-transparent">{stats.avgScoreTop10}<span className="text-lg">/100</span></p>
            </div>
          </div>

          {/* Row 2: Sources + Taux consultation */}
          <div className="grid md:grid-cols-2 gap-6 mb-8">
            {/* Répartition par source */}
            <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 shadow-lg border border-white/50">
              <h3 className="text-lg font-semibold mb-4 text-gray-900">Repartition par source</h3>
              <div className="space-y-4">
                {(['linkedin', 'adzuna', 'indeed', 'linkedin_post'] as const).map(source => {
                  const count = stats.sourceCounts[source]
                  const percent = stats.totalJobs > 0 ? (count / stats.totalJobs) * 100 : 0
                  return (
                    <div key={source}>
                      <div className="flex justify-between mb-1">
                        <span className="text-sm font-medium" style={{ color: getSourceColor(source) }}>
                          {getSourceLabel(source)}
                        </span>
                        <span className="text-sm text-gray-500">
                          {count} ({Math.round(percent)}%)
                        </span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                        <div
                          className="h-3 rounded-full transition-all duration-500"
                          style={{ backgroundColor: getSourceColor(source), width: `${percent}%` }}
                        ></div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Taux de consultation */}
            <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 shadow-lg border border-white/50">
              <h3 className="text-lg font-semibold mb-4 text-gray-900">Taux de consultation</h3>
              <div className="flex items-center justify-center h-32">
                <div className="relative w-32 h-32">
                  <svg className="w-32 h-32 transform -rotate-90">
                    <defs>
                      <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#6366F1" />
                        <stop offset="100%" stopColor="#A855F7" />
                      </linearGradient>
                    </defs>
                    <circle cx="64" cy="64" r="56" stroke="#E5E7EB" strokeWidth="12" fill="none" />
                    <circle
                      cx="64" cy="64" r="56"
                      stroke="url(#progressGradient)" strokeWidth="12" fill="none"
                      strokeDasharray={`${(viewedPercent / 100) * 351.86} 351.86`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">{viewedPercent}%</span>
                  </div>
                </div>
              </div>
              <p className="text-center text-sm mt-2 text-gray-500">
                {stats.viewedJobs} sur {stats.totalJobs} jobs consultes
              </p>
            </div>
          </div>

          {/* Row 3: Funnel + Top entreprises */}
          <div className="grid md:grid-cols-2 gap-6 mb-8">
            {/* Funnel de conversion */}
            <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 shadow-lg border border-white/50">
              <h3 className="text-lg font-semibold mb-4 text-gray-900">Funnel de conversion</h3>
              <div className="space-y-3">
                {funnel.map((step, index) => {
                  const percent = Math.round((step.value / funnelMax) * 100)
                  const conversionRate = index > 0 && funnel[index - 1].value > 0
                    ? Math.round((step.value / funnel[index - 1].value) * 100)
                    : null
                  return (
                    <div key={step.label}>
                      <div className="flex justify-between mb-1">
                        <span className="text-sm font-medium text-gray-900">
                          {step.label}
                        </span>
                        <span className="text-sm text-gray-500">
                          {step.value}
                          {conversionRate !== null && (
                            <span className="ml-2 text-xs font-semibold" style={{ color: step.color }}>
                              ({conversionRate}%)
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-4 overflow-hidden">
                        <div
                          className="h-4 rounded-full transition-all duration-500 flex items-center justify-end pr-2"
                          style={{
                            backgroundColor: step.color,
                            width: `${Math.max(percent, 2)}%`,
                          }}
                        >
                          {percent > 15 && (
                            <span className="text-[10px] text-white font-medium">{percent}%</span>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Top entreprises */}
            <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 shadow-lg border border-white/50">
              <h3 className="text-lg font-semibold mb-4 text-gray-900">Top entreprises</h3>
              {stats.topCompanies.length > 0 ? (
                <div className="space-y-3">
                  {stats.topCompanies.map((company, index) => (
                    <div key={company.name} className="flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50 transition-colors">
                      <span
                        className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold text-white flex-shrink-0 shadow-lg ${
                          index === 0 ? 'bg-gradient-to-br from-amber-400 to-orange-500 shadow-amber-500/30' :
                          index === 1 ? 'bg-gradient-to-br from-gray-400 to-gray-500 shadow-gray-500/30' :
                          index === 2 ? 'bg-gradient-to-br from-amber-600 to-amber-700 shadow-amber-600/30' :
                          'bg-gradient-to-br from-indigo-500 to-purple-600 shadow-indigo-500/30'
                        }`}
                      >
                        {index + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate text-gray-900">
                          {company.name}
                        </p>
                      </div>
                      <span className="text-sm font-semibold flex-shrink-0 text-gray-500">
                        {company.count} offre{company.count > 1 ? 's' : ''}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">Aucune donnee disponible</p>
              )}
            </div>
          </div>

          {/* Répartition par statut */}
          <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 mb-6 shadow-lg border border-white/50">
            <h3 className="text-lg font-semibold mb-6 text-gray-900">Repartition par statut</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {Object.entries(stats.statusCounts).map(([status, count]) => (
                <div key={status} className="text-center p-4 rounded-xl transition-all duration-200 hover:-translate-y-0.5" style={{ backgroundColor: `${getStatusColor(status)}15` }}>
                  <p className="text-3xl font-bold" style={{ color: getStatusColor(status) }}>{count}</p>
                  <p className="text-sm font-medium" style={{ color: getStatusColor(status) }}>{getStatusLabel(status)}</p>
                </div>
              ))}
            </div>

            {totalStatusJobs > 0 && (
              <div className="mt-6">
                <div className="flex rounded-full overflow-hidden h-4">
                  {Object.entries(stats.statusCounts).map(([status, count]) => (
                    count > 0 && (
                      <div
                        key={status}
                        style={{
                          backgroundColor: getStatusColor(status),
                          width: `${(count / totalStatusJobs) * 100}%`
                        }}
                        title={`${getStatusLabel(status)}: ${count}`}
                      ></div>
                    )
                  ))}
                </div>
                <div className="flex flex-wrap justify-between mt-2 text-xs gap-1 text-gray-500">
                  {Object.entries(stats.statusCounts).map(([status, count]) => (
                    count > 0 && (
                      <span key={status} className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: getStatusColor(status) }}></span>
                        {getStatusLabel(status)} ({Math.round((count / totalStatusJobs) * 100)}%)
                      </span>
                    )
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* TOP 10 vs Autres */}
          {filterMode === 'all' && (
            <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 mb-6 shadow-lg border border-white/50">
              <h3 className="text-lg font-semibold mb-4 text-gray-900">Repartition TOP 10 / Autres</h3>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm font-medium text-emerald-600">TOP 10</span>
                    <span className="text-sm text-gray-500">{stats.top10Jobs}</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                    <div
                      className="h-3 rounded-full bg-gradient-to-r from-emerald-400 to-teal-500"
                      style={{
                        width: `${stats.totalJobs ? (stats.top10Jobs / stats.totalJobs) * 100 : 0}%`
                      }}
                    ></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm font-medium text-gray-500">Autres</span>
                    <span className="text-sm text-gray-500">{stats.otherJobs}</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                    <div
                      className="h-3 rounded-full bg-gradient-to-r from-gray-300 to-gray-400"
                      style={{
                        width: `${stats.totalJobs ? (stats.otherJobs / stats.totalJobs) * 100 : 0}%`
                      }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Conseils */}
          <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-2xl p-6 border border-emerald-200/50">
            <h3 className="text-lg font-semibold mb-4 text-gray-900">Conseils</h3>
            <ul className="space-y-3 text-sm text-gray-600">
              {stats.totalJobs > 0 && stats.viewedJobs < stats.totalJobs * 0.5 && (
                <li className="flex items-start gap-3 p-3 bg-white/50 rounded-xl">
                  <span className="text-lg">💡</span>
                  <span>Vous n'avez consulte que {viewedPercent}% des jobs. Prenez le temps d'explorer les autres opportunites !</span>
                </li>
              )}
              {stats.statusCounts.a_contacter > 0 && (
                <li className="flex items-start gap-3 p-3 bg-white/50 rounded-xl">
                  <span className="text-lg">📞</span>
                  <span>Vous avez {stats.statusCounts.a_contacter} job(s) &quot;A contacter&quot;. N&apos;attendez pas trop avant de postuler !</span>
                </li>
              )}
              {stats.favoriteJobs === 0 && stats.totalJobs > 0 && (
                <li className="flex items-start gap-3 p-3 bg-white/50 rounded-xl">
                  <span className="text-lg">⭐</span>
                  <span>Mettez vos jobs preferes en favoris pour les retrouver facilement.</span>
                </li>
              )}
              {stats.statusCounts.rdv_pris > 0 && (
                <li className="flex items-start gap-3 p-3 bg-white/50 rounded-xl">
                  <span className="text-lg">🎉</span>
                  <span>Bravo ! Vous avez {stats.statusCounts.rdv_pris} RDV pris. Continuez comme ca !</span>
                </li>
              )}
              {stats.totalJobs > 0 && stats.sourceCounts.linkedin === 0 && stats.sourceCounts.indeed === 0 && (
                <li className="flex items-start gap-3 p-3 bg-white/50 rounded-xl">
                  <span className="text-lg">🔗</span>
                  <span>Vos resultats viennent uniquement d'Adzuna. LinkedIn et Indeed peuvent apporter des offres complementaires.</span>
                </li>
              )}
            </ul>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
