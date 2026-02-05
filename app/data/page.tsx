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
  sourceCounts: { linkedin: number; adzuna: number; indeed: number }
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
      case 'adzuna': return '#FF6B35'
      case 'indeed': return '#6B5CE7'
      default: return '#9CA3AF'
    }
  }

  const getSourceLabel = (source: string) => {
    switch (source) {
      case 'linkedin': return 'LinkedIn'
      case 'adzuna': return 'Adzuna'
      case 'indeed': return 'Indeed'
      default: return source
    }
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: '#6366F1' }}></div>
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
            <div>
              <h1 className="text-2xl md:text-3xl font-bold" style={{ color: '#1D3557' }}>Data & Analytics</h1>
              <p className="mt-1" style={{ color: '#457B9D' }}>Vue d'ensemble de votre activité</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setFilterMode('all')}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  filterMode === 'all' ? 'text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                style={filterMode === 'all' ? { backgroundColor: '#6366F1' } : {}}
              >
                Tous les jobs
              </button>
              <button
                onClick={() => setFilterMode('top10')}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  filterMode === 'top10' ? 'text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                style={filterMode === 'top10' ? { backgroundColor: '#10B981' } : {}}
              >
                TOP 10 uniquement
              </button>
            </div>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
            <Card className="p-4 md:p-6">
              <p className="text-xs md:text-sm font-medium" style={{ color: '#457B9D' }}>Recherches</p>
              <p className="text-2xl md:text-3xl font-bold" style={{ color: '#1D3557' }}>{stats.totalSearches}</p>
            </Card>
            <Card className="p-4 md:p-6">
              <p className="text-xs md:text-sm font-medium" style={{ color: '#457B9D' }}>Jobs trouvés</p>
              <p className="text-2xl md:text-3xl font-bold" style={{ color: '#1D3557' }}>{stats.totalJobs}</p>
            </Card>
            <Card className="p-4 md:p-6">
              <p className="text-xs md:text-sm font-medium" style={{ color: '#457B9D' }}>Jobs consultés</p>
              <p className="text-2xl md:text-3xl font-bold" style={{ color: '#6366F1' }}>{stats.viewedJobs}</p>
            </Card>
            <Card className="p-4 md:p-6">
              <p className="text-xs md:text-sm font-medium" style={{ color: '#457B9D' }}>Favoris</p>
              <p className="text-2xl md:text-3xl font-bold" style={{ color: '#FBBF24' }}>{stats.favoriteJobs}</p>
            </Card>
            <Card className="p-4 md:p-6">
              <p className="text-xs md:text-sm font-medium" style={{ color: '#457B9D' }}>Score moyen TOP 10</p>
              <p className="text-2xl md:text-3xl font-bold" style={{ color: '#10B981' }}>{stats.avgScoreTop10}<span className="text-lg">/100</span></p>
            </Card>
          </div>

          {/* Row 2: Sources + Taux consultation */}
          <div className="grid md:grid-cols-2 gap-6 mb-8">
            {/* Répartition par source */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4" style={{ color: '#1D3557' }}>Répartition par source</h3>
              <div className="space-y-4">
                {(['linkedin', 'adzuna', 'indeed'] as const).map(source => {
                  const count = stats.sourceCounts[source]
                  const percent = stats.totalJobs > 0 ? (count / stats.totalJobs) * 100 : 0
                  return (
                    <div key={source}>
                      <div className="flex justify-between mb-1">
                        <span className="text-sm font-medium" style={{ color: getSourceColor(source) }}>
                          {getSourceLabel(source)}
                        </span>
                        <span className="text-sm" style={{ color: '#457B9D' }}>
                          {count} ({Math.round(percent)}%)
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3">
                        <div
                          className="h-3 rounded-full transition-all duration-500"
                          style={{ backgroundColor: getSourceColor(source), width: `${percent}%` }}
                        ></div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </Card>

            {/* Taux de consultation */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4" style={{ color: '#1D3557' }}>Taux de consultation</h3>
              <div className="flex items-center justify-center h-32">
                <div className="relative w-32 h-32">
                  <svg className="w-32 h-32 transform -rotate-90">
                    <circle cx="64" cy="64" r="56" stroke="#E5E7EB" strokeWidth="12" fill="none" />
                    <circle
                      cx="64" cy="64" r="56"
                      stroke="#6366F1" strokeWidth="12" fill="none"
                      strokeDasharray={`${(viewedPercent / 100) * 351.86} 351.86`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-2xl font-bold" style={{ color: '#1D3557' }}>{viewedPercent}%</span>
                  </div>
                </div>
              </div>
              <p className="text-center text-sm mt-2" style={{ color: '#457B9D' }}>
                {stats.viewedJobs} sur {stats.totalJobs} jobs consultés
              </p>
            </Card>
          </div>

          {/* Row 3: Funnel + Top entreprises */}
          <div className="grid md:grid-cols-2 gap-6 mb-8">
            {/* Funnel de conversion */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4" style={{ color: '#1D3557' }}>Funnel de conversion</h3>
              <div className="space-y-3">
                {funnel.map((step, index) => {
                  const percent = Math.round((step.value / funnelMax) * 100)
                  const conversionRate = index > 0 && funnel[index - 1].value > 0
                    ? Math.round((step.value / funnel[index - 1].value) * 100)
                    : null
                  return (
                    <div key={step.label}>
                      <div className="flex justify-between mb-1">
                        <span className="text-sm font-medium" style={{ color: '#1D3557' }}>
                          {step.label}
                        </span>
                        <span className="text-sm" style={{ color: '#457B9D' }}>
                          {step.value}
                          {conversionRate !== null && (
                            <span className="ml-2 text-xs" style={{ color: step.color }}>
                              ({conversionRate}%)
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-4">
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
            </Card>

            {/* Top entreprises */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4" style={{ color: '#1D3557' }}>Top entreprises</h3>
              {stats.topCompanies.length > 0 ? (
                <div className="space-y-3">
                  {stats.topCompanies.map((company, index) => (
                    <div key={company.name} className="flex items-center gap-3">
                      <span
                        className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                        style={{ backgroundColor: index === 0 ? '#6366F1' : index === 1 ? '#8B5CF6' : '#A5B4FC' }}
                      >
                        {index + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: '#1D3557' }}>
                          {company.name}
                        </p>
                      </div>
                      <span className="text-sm font-semibold flex-shrink-0" style={{ color: '#457B9D' }}>
                        {company.count} offre{company.count > 1 ? 's' : ''}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm" style={{ color: '#457B9D' }}>Aucune donnée disponible</p>
              )}
            </Card>
          </div>

          {/* Répartition par statut */}
          <Card className="p-6 mb-6">
            <h3 className="text-lg font-semibold mb-6" style={{ color: '#1D3557' }}>Répartition par statut</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {Object.entries(stats.statusCounts).map(([status, count]) => (
                <div key={status} className="text-center p-4 rounded-xl" style={{ backgroundColor: `${getStatusColor(status)}15` }}>
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
                <div className="flex flex-wrap justify-between mt-2 text-xs gap-1" style={{ color: '#457B9D' }}>
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
          </Card>

          {/* TOP 10 vs Autres */}
          {filterMode === 'all' && (
            <Card className="p-6 mb-6">
              <h3 className="text-lg font-semibold mb-4" style={{ color: '#1D3557' }}>Répartition TOP 10 / Autres</h3>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm font-medium" style={{ color: '#166534' }}>TOP 10</span>
                    <span className="text-sm" style={{ color: '#457B9D' }}>{stats.top10Jobs}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className="h-3 rounded-full"
                      style={{
                        backgroundColor: '#86EFAC',
                        width: `${stats.totalJobs ? (stats.top10Jobs / stats.totalJobs) * 100 : 0}%`
                      }}
                    ></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm font-medium" style={{ color: '#457B9D' }}>Autres</span>
                    <span className="text-sm" style={{ color: '#457B9D' }}>{stats.otherJobs}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className="h-3 rounded-full"
                      style={{
                        backgroundColor: '#A8DADC',
                        width: `${stats.totalJobs ? (stats.otherJobs / stats.totalJobs) * 100 : 0}%`
                      }}
                    ></div>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Conseils */}
          <Card className="p-6" style={{ backgroundColor: '#F1FAEE' }}>
            <h3 className="text-lg font-semibold mb-2" style={{ color: '#1D3557' }}>Conseils</h3>
            <ul className="space-y-2 text-sm" style={{ color: '#457B9D' }}>
              {stats.totalJobs > 0 && stats.viewedJobs < stats.totalJobs * 0.5 && (
                <li className="flex items-start gap-2">
                  <span>💡</span>
                  <span>Vous n'avez consulté que {viewedPercent}% des jobs. Prenez le temps d'explorer les autres opportunités !</span>
                </li>
              )}
              {stats.statusCounts.a_contacter > 0 && (
                <li className="flex items-start gap-2">
                  <span>📞</span>
                  <span>Vous avez {stats.statusCounts.a_contacter} job(s) &quot;À contacter&quot;. N&apos;attendez pas trop avant de postuler !</span>
                </li>
              )}
              {stats.favoriteJobs === 0 && stats.totalJobs > 0 && (
                <li className="flex items-start gap-2">
                  <span>⭐</span>
                  <span>Mettez vos jobs préférés en favoris pour les retrouver facilement.</span>
                </li>
              )}
              {stats.statusCounts.rdv_pris > 0 && (
                <li className="flex items-start gap-2">
                  <span>🎉</span>
                  <span>Bravo ! Vous avez {stats.statusCounts.rdv_pris} RDV pris. Continuez comme ça !</span>
                </li>
              )}
              {stats.totalJobs > 0 && stats.sourceCounts.linkedin === 0 && stats.sourceCounts.indeed === 0 && (
                <li className="flex items-start gap-2">
                  <span>🔗</span>
                  <span>Vos résultats viennent uniquement d'Adzuna. LinkedIn et Indeed peuvent apporter des offres complémentaires.</span>
                </li>
              )}
            </ul>
          </Card>
        </div>
      </div>
    </AppLayout>
  )
}
