'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import AppLayout from '@/components/AppLayout'

type Search = {
  id: string
  name: string
  status: string
  created_at: string
  input_type: string
  match_count?: number
}

type Stats = {
  totalSearches: number
  totalMatches: number
  topMatches: number
  contactsEnriched: number
}

type TopMatch = {
  id: string
  job_title: string
  company_name: string
  score: number
  search_id: string
  search_name?: string
}

export default function DashboardPage() {
  const router = useRouter()
  const [userName, setUserName] = useState('')
  const [loading, setLoading] = useState(true)
  const [recentSearches, setRecentSearches] = useState<Search[]>([])
  const [topMatches, setTopMatches] = useState<TopMatch[]>([])
  const [stats, setStats] = useState<Stats>({
    totalSearches: 0,
    totalMatches: 0,
    topMatches: 0,
    contactsEnriched: 0
  })

  useEffect(() => {
    loadDashboardData()
  }, [])

  const loadDashboardData = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      router.push('/login')
      return
    }

    // Get user name from email
    const email = session.user.email || ''
    const name = email.split('@')[0].replace(/[._]/g, ' ')
    setUserName(name.charAt(0).toUpperCase() + name.slice(1))

    // Load recent searches with match counts
    const { data: searches } = await supabase
      .from('searches')
      .select('id, name, status, created_at, input_type')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })
      .limit(5)

    if (searches) {
      // Get match counts for each search
      const searchesWithCounts = await Promise.all(
        searches.map(async (search) => {
          const { count } = await supabase
            .from('matches')
            .select('id', { count: 'exact', head: true })
            .eq('search_id', search.id)
          return { ...search, match_count: count || 0 }
        })
      )
      setRecentSearches(searchesWithCounts)
    }

    // Load stats
    const { count: totalSearches } = await supabase
      .from('searches')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', session.user.id)

    const { count: totalMatches } = await supabase
      .from('matches')
      .select('id', { count: 'exact', head: true })
      .in('search_id', searches?.map(s => s.id) || [])

    const { count: topMatchesCount } = await supabase
      .from('matches')
      .select('id', { count: 'exact', head: true })
      .in('search_id', searches?.map(s => s.id) || [])
      .eq('score_type', 'claude_ai')

    setStats({
      totalSearches: totalSearches || 0,
      totalMatches: totalMatches || 0,
      topMatches: topMatchesCount || 0,
      contactsEnriched: 0 // TODO: implement when contacts table is used
    })

    // Load top matches across all searches
    const { data: matches } = await supabase
      .from('matches')
      .select('id, job_title, company_name, score, search_id')
      .in('search_id', searches?.map(s => s.id) || [])
      .eq('score_type', 'claude_ai')
      .order('score', { ascending: false })
      .limit(5)

    if (matches && searches) {
      const matchesWithSearchNames = matches.map(match => ({
        ...match,
        search_name: searches.find(s => s.id === match.search_id)?.name
      }))
      setTopMatches(matchesWithSearchNames)
    }

    setLoading(false)
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="p-4 md:p-8">
        <div className="max-w-6xl mx-auto">

          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">
              Bonjour, {userName} !
            </h1>
            <p className="text-gray-500 mt-1">
              Voici un apercu de votre activite PushProfile
            </p>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <Card className="p-4 bg-gradient-to-br from-indigo-50 to-white border-0 shadow-sm">
              <div className="text-3xl font-bold text-indigo-600">{stats.totalSearches}</div>
              <div className="text-sm text-gray-500 mt-1">Recherches</div>
            </Card>
            <Card className="p-4 bg-gradient-to-br from-green-50 to-white border-0 shadow-sm">
              <div className="text-3xl font-bold text-green-600">{stats.totalMatches}</div>
              <div className="text-sm text-gray-500 mt-1">Offres trouvees</div>
            </Card>
            <Card className="p-4 bg-gradient-to-br from-amber-50 to-white border-0 shadow-sm">
              <div className="text-3xl font-bold text-amber-600">{stats.topMatches}</div>
              <div className="text-sm text-gray-500 mt-1">TOP Matches IA</div>
            </Card>
            <Card className="p-4 bg-gradient-to-br from-purple-50 to-white border-0 shadow-sm">
              <div className="text-3xl font-bold text-purple-600">{stats.contactsEnriched}</div>
              <div className="text-sm text-gray-500 mt-1">Contacts enrichis</div>
            </Card>
          </div>

          {/* Quick Actions */}
          <div className="grid md:grid-cols-2 gap-4 mb-8">
            {/* New Search Card */}
            <Card className="p-6 border-l-4 border-l-indigo-500 hover:shadow-lg transition-shadow">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center flex-shrink-0">
                  <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 text-lg">Nouvelle recherche</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Lancez une recherche avec un CV ou une URL LinkedIn
                  </p>
                  <Button
                    onClick={() => router.push('/new-search')}
                    className="mt-4 bg-indigo-600 hover:bg-indigo-700"
                  >
                    Lancer une recherche
                  </Button>
                </div>
              </div>
            </Card>

            {/* Company Intelligence Card */}
            <Card className="p-6 border-l-4 border-l-emerald-500 hover:shadow-lg transition-shadow">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
                  <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 text-lg">Company Intelligence</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Analysez une entreprise : stack tech, effectifs, postes ouverts
                  </p>
                  <Button
                    onClick={() => router.push('/company')}
                    variant="outline"
                    className="mt-4 border-emerald-500 text-emerald-600 hover:bg-emerald-50"
                  >
                    Explorer une entreprise
                  </Button>
                </div>
              </div>
            </Card>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Recent Searches */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Recherches recentes</h2>
                <Link href="/searches" className="text-sm text-indigo-600 hover:underline">
                  Voir tout
                </Link>
              </div>

              {recentSearches.length === 0 ? (
                <Card className="p-8 text-center">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <p className="text-gray-500 mb-4">Aucune recherche pour le moment</p>
                  <Button onClick={() => router.push('/new-search')} size="sm">
                    Creer ma premiere recherche
                  </Button>
                </Card>
              ) : (
                <div className="space-y-3">
                  {recentSearches.map((search) => (
                    <Link key={search.id} href={`/searches/${search.id}`}>
                      <Card className="p-4 hover:shadow-md transition-shadow cursor-pointer">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-2 h-2 rounded-full ${
                              search.status === 'completed' ? 'bg-green-500' :
                              search.status === 'processing' ? 'bg-amber-500 animate-pulse' :
                              'bg-gray-300'
                            }`} />
                            <div>
                              <p className="font-medium text-gray-900 line-clamp-1">{search.name}</p>
                              <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                                <span>{new Date(search.created_at).toLocaleDateString('fr-FR')}</span>
                                {search.input_type === 'linkedin' && (
                                  <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">LinkedIn</span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-lg font-semibold text-indigo-600">{search.match_count}</span>
                            <span className="text-xs text-gray-500 block">matchs</span>
                          </div>
                        </div>
                      </Card>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Top Matches */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Meilleurs matchs</h2>
                <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700">Score IA</span>
              </div>

              {topMatches.length === 0 ? (
                <Card className="p-8 text-center">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                    </svg>
                  </div>
                  <p className="text-gray-500">Lancez une recherche pour voir vos meilleurs matchs</p>
                </Card>
              ) : (
                <div className="space-y-3">
                  {topMatches.map((match, index) => (
                    <Link key={match.id} href={`/searches/${match.search_id}`}>
                      <Card className="p-4 hover:shadow-md transition-shadow cursor-pointer">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold ${
                            index === 0 ? 'bg-amber-500' :
                            index === 1 ? 'bg-gray-400' :
                            index === 2 ? 'bg-amber-700' :
                            'bg-indigo-500'
                          }`}>
                            {index + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-900 truncate">{match.job_title}</p>
                            <p className="text-sm text-gray-500 truncate">{match.company_name}</p>
                          </div>
                          <div className="text-right">
                            <span className="text-lg font-bold text-green-600">{match.score}</span>
                            <span className="text-xs text-gray-500">/100</span>
                          </div>
                        </div>
                      </Card>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Suggestions */}
          <div className="mt-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Actions suggerees</h2>
            <div className="grid md:grid-cols-3 gap-4">
              <Card className="p-4 bg-gradient-to-br from-blue-50 to-white border-0">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">💡</span>
                  <div>
                    <p className="font-medium text-gray-900">Enrichir les contacts</p>
                    <p className="text-xs text-gray-500">Obtenez les emails des recruteurs</p>
                  </div>
                </div>
              </Card>
              <Card className="p-4 bg-gradient-to-br from-purple-50 to-white border-0">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🔄</span>
                  <div>
                    <p className="font-medium text-gray-900">Activer la recurrence</p>
                    <p className="text-xs text-gray-500">Recevez les nouvelles offres automatiquement</p>
                  </div>
                </div>
              </Card>
              <Card className="p-4 bg-gradient-to-br from-green-50 to-white border-0">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🏢</span>
                  <div>
                    <p className="font-medium text-gray-900">Analyser une entreprise</p>
                    <p className="text-xs text-gray-500">Stack tech, culture, postes ouverts</p>
                  </div>
                </div>
              </Card>
            </div>
          </div>

        </div>
      </div>
    </AppLayout>
  )
}
