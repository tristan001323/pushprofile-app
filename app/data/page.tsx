'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Card } from '@/components/ui/card'
import AppLayout from '@/components/AppLayout'

type Stats = {
  totalSearches: number
  totalJobs: number
  top10Jobs: number
  otherJobs: number
  viewedJobs: number
  favoriteJobs: number
  favoriteSearches: number
  statusCounts: {
    nouveau: number
    a_contacter: number
    rdv_pris: number
    refuse: number
  }
}

export default function DataPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadStats()
  }, [])

  const loadStats = async () => {
    // Charger les recherches
    const { data: searches } = await supabase
      .from('searches')
      .select('id, is_favorite')

    // Charger les matches
    const { data: matches } = await supabase
      .from('matches')
      .select('id, rank, status, viewed_at, is_favorite')

    if (searches && matches) {
      const statusCounts = {
        nouveau: matches.filter(m => m.status === 'nouveau').length,
        a_contacter: matches.filter(m => m.status === 'a_contacter').length,
        rdv_pris: matches.filter(m => m.status === 'rdv_pris').length,
        refuse: matches.filter(m => m.status === 'refuse').length,
      }

      setStats({
        totalSearches: searches.length,
        totalJobs: matches.length,
        top10Jobs: matches.filter(m => m.rank <= 10).length,
        otherJobs: matches.filter(m => m.rank > 10).length,
        viewedJobs: matches.filter(m => m.viewed_at).length,
        favoriteJobs: matches.filter(m => m.is_favorite).length,
        favoriteSearches: searches.filter(s => s.is_favorite).length,
        statusCounts,
      })
    }
    setLoading(false)
  }

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

  if (loading) {
    return (
      <AppLayout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: '#6366F1' }}></div>
        </div>
      </AppLayout>
    )
  }

  const totalStatusJobs = stats ? Object.values(stats.statusCounts).reduce((a, b) => a + b, 0) : 0

  return (
    <AppLayout>
      <div className="p-8">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold" style={{ color: '#1D3557' }}>Data & Analytics</h1>
            <p className="mt-2" style={{ color: '#457B9D' }}>Vue d'ensemble de votre activité</p>
          </div>

          {/* Stats principales */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <Card className="p-6">
              <p className="text-sm font-medium" style={{ color: '#457B9D' }}>Recherches</p>
              <p className="text-3xl font-bold" style={{ color: '#1D3557' }}>{stats?.totalSearches || 0}</p>
            </Card>
            <Card className="p-6">
              <p className="text-sm font-medium" style={{ color: '#457B9D' }}>Jobs trouvés</p>
              <p className="text-3xl font-bold" style={{ color: '#1D3557' }}>{stats?.totalJobs || 0}</p>
            </Card>
            <Card className="p-6">
              <p className="text-sm font-medium" style={{ color: '#457B9D' }}>Jobs consultés</p>
              <p className="text-3xl font-bold" style={{ color: '#1D3557' }}>{stats?.viewedJobs || 0}</p>
            </Card>
            <Card className="p-6">
              <p className="text-sm font-medium" style={{ color: '#457B9D' }}>Favoris</p>
              <p className="text-3xl font-bold" style={{ color: '#FBBF24' }}>{stats?.favoriteJobs || 0}</p>
            </Card>
          </div>

          {/* TOP 10 vs Autres */}
          <div className="grid md:grid-cols-2 gap-6 mb-8">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4" style={{ color: '#1D3557' }}>Répartition des jobs</h3>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm font-medium" style={{ color: '#166534' }}>TOP 10</span>
                    <span className="text-sm" style={{ color: '#457B9D' }}>{stats?.top10Jobs || 0}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className="h-3 rounded-full"
                      style={{
                        backgroundColor: '#86EFAC',
                        width: `${stats?.totalJobs ? (stats.top10Jobs / stats.totalJobs) * 100 : 0}%`
                      }}
                    ></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm font-medium" style={{ color: '#457B9D' }}>Autres</span>
                    <span className="text-sm" style={{ color: '#457B9D' }}>{stats?.otherJobs || 0}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className="h-3 rounded-full"
                      style={{
                        backgroundColor: '#A8DADC',
                        width: `${stats?.totalJobs ? (stats.otherJobs / stats.totalJobs) * 100 : 0}%`
                      }}
                    ></div>
                  </div>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4" style={{ color: '#1D3557' }}>Taux de consultation</h3>
              <div className="flex items-center justify-center h-32">
                <div className="relative w-32 h-32">
                  <svg className="w-32 h-32 transform -rotate-90">
                    <circle
                      cx="64"
                      cy="64"
                      r="56"
                      stroke="#E5E7EB"
                      strokeWidth="12"
                      fill="none"
                    />
                    <circle
                      cx="64"
                      cy="64"
                      r="56"
                      stroke="#6366F1"
                      strokeWidth="12"
                      fill="none"
                      strokeDasharray={`${stats?.totalJobs ? (stats.viewedJobs / stats.totalJobs) * 351.86 : 0} 351.86`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-2xl font-bold" style={{ color: '#1D3557' }}>
                      {stats?.totalJobs ? Math.round((stats.viewedJobs / stats.totalJobs) * 100) : 0}%
                    </span>
                  </div>
                </div>
              </div>
              <p className="text-center text-sm mt-2" style={{ color: '#457B9D' }}>
                {stats?.viewedJobs || 0} sur {stats?.totalJobs || 0} jobs consultés
              </p>
            </Card>
          </div>

          {/* Statuts */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-6" style={{ color: '#1D3557' }}>Répartition par statut</h3>
            <div className="grid md:grid-cols-4 gap-4 mb-6">
              {stats && Object.entries(stats.statusCounts).map(([status, count]) => (
                <div key={status} className="text-center p-4 rounded-xl" style={{ backgroundColor: `${getStatusColor(status)}15` }}>
                  <p className="text-3xl font-bold" style={{ color: getStatusColor(status) }}>{count}</p>
                  <p className="text-sm font-medium" style={{ color: getStatusColor(status) }}>{getStatusLabel(status)}</p>
                </div>
              ))}
            </div>

            {/* Barre de progression des statuts */}
            {totalStatusJobs > 0 && (
              <div className="mt-6">
                <div className="flex rounded-full overflow-hidden h-4">
                  {stats && Object.entries(stats.statusCounts).map(([status, count]) => (
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
                <div className="flex justify-between mt-2 text-xs" style={{ color: '#457B9D' }}>
                  {stats && Object.entries(stats.statusCounts).map(([status, count]) => (
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

          {/* Conseils */}
          <Card className="p-6 mt-6" style={{ backgroundColor: '#F1FAEE' }}>
            <h3 className="text-lg font-semibold mb-2" style={{ color: '#1D3557' }}>Conseils</h3>
            <ul className="space-y-2 text-sm" style={{ color: '#457B9D' }}>
              {stats && stats.viewedJobs < stats.totalJobs * 0.5 && (
                <li className="flex items-start gap-2">
                  <span>💡</span>
                  <span>Vous n'avez consulté que {Math.round((stats.viewedJobs / stats.totalJobs) * 100)}% des jobs. Prenez le temps d'explorer les autres opportunités !</span>
                </li>
              )}
              {stats && stats.statusCounts.a_contacter > 0 && (
                <li className="flex items-start gap-2">
                  <span>📞</span>
                  <span>Vous avez {stats.statusCounts.a_contacter} job(s) "À contacter". N'attendez pas trop avant de postuler !</span>
                </li>
              )}
              {stats && stats.favoriteJobs === 0 && (
                <li className="flex items-start gap-2">
                  <span>⭐</span>
                  <span>Mettez vos jobs préférés en favoris pour les retrouver facilement.</span>
                </li>
              )}
              {stats && stats.totalSearches > 0 && stats.statusCounts.rdv_pris > 0 && (
                <li className="flex items-start gap-2">
                  <span>🎉</span>
                  <span>Bravo ! Vous avez {stats.statusCounts.rdv_pris} RDV pris. Continuez comme ça !</span>
                </li>
              )}
            </ul>
          </Card>
        </div>
      </div>
    </AppLayout>
  )
}
