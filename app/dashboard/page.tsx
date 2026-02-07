'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
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

  const statCards = [
    { label: 'Recherches', value: stats.totalSearches, gradient: 'from-indigo-500 to-purple-500', shadow: 'shadow-indigo-500/20' },
    { label: 'Offres trouvees', value: stats.totalMatches, gradient: 'from-emerald-500 to-teal-500', shadow: 'shadow-emerald-500/20' },
    { label: 'TOP Matches IA', value: stats.topMatches, gradient: 'from-amber-500 to-orange-500', shadow: 'shadow-amber-500/20' },
    { label: 'Contacts enrichis', value: stats.contactsEnriched, gradient: 'from-pink-500 to-rose-500', shadow: 'shadow-pink-500/20' },
  ]

  return (
    <AppLayout>
      <div className="p-4 md:p-8">
        <div className="max-w-6xl mx-auto">

          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                <span className="text-white font-bold text-xl">{userName.charAt(0).toUpperCase()}</span>
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
                  Bonjour, {userName} !
                </h1>
                <p className="text-gray-500">
                  Voici un apercu de votre activite PushProfile
                </p>
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {statCards.map((stat, index) => (
              <div
                key={index}
                className={`relative overflow-hidden bg-white rounded-2xl p-5 shadow-lg ${stat.shadow} border border-gray-100/50 group hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5`}
              >
                <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-br ${stat.gradient} opacity-5 rounded-full -translate-y-8 translate-x-8 group-hover:opacity-10 transition-opacity`} />
                <div className={`inline-flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br ${stat.gradient} shadow-lg mb-3`}>
                  <span className="text-white font-bold text-sm">{stat.value}</span>
                </div>
                <div className={`text-3xl font-bold bg-gradient-to-r ${stat.gradient} bg-clip-text text-transparent`}>
                  {stat.value}
                </div>
                <div className="text-sm text-gray-500 mt-1 font-medium">{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Quick Actions */}
          <div className="grid md:grid-cols-2 gap-4 mb-8">
            {/* New Search Card */}
            <div className="relative overflow-hidden bg-white rounded-2xl p-6 shadow-lg shadow-indigo-500/10 border border-gray-100/50 group hover:shadow-xl transition-all duration-300">
              <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-indigo-500 to-purple-500 opacity-5 rounded-full -translate-y-16 translate-x-16" />
              <div className="absolute top-0 left-0 h-full w-1 bg-gradient-to-b from-indigo-500 to-purple-500 rounded-l-2xl" />
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-indigo-500/30 group-hover:scale-105 transition-transform">
                  <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-gray-900 text-lg">Nouvelle recherche</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Lancez une recherche avec un CV ou une URL LinkedIn
                  </p>
                  <Button
                    onClick={() => router.push('/new-search')}
                    className="mt-4 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 shadow-lg shadow-indigo-500/30 border-0"
                  >
                    Lancer une recherche
                  </Button>
                </div>
              </div>
            </div>

            {/* Company Intelligence Card */}
            <div className="relative overflow-hidden bg-white rounded-2xl p-6 shadow-lg shadow-emerald-500/10 border border-gray-100/50 group hover:shadow-xl transition-all duration-300">
              <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-emerald-500 to-teal-500 opacity-5 rounded-full -translate-y-16 translate-x-16" />
              <div className="absolute top-0 left-0 h-full w-1 bg-gradient-to-b from-emerald-500 to-teal-500 rounded-l-2xl" />
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-emerald-500/30 group-hover:scale-105 transition-transform">
                  <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-gray-900 text-lg">Company Intelligence</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Analysez une entreprise : stack tech, effectifs, postes ouverts
                  </p>
                  <Button
                    onClick={() => router.push('/company')}
                    variant="outline"
                    className="mt-4 border-emerald-500 text-emerald-600 hover:bg-emerald-50 hover:border-emerald-600"
                  >
                    Explorer une entreprise
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Recent Searches */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-900">Recherches recentes</h2>
                <Link href="/searches" className="text-sm font-medium text-indigo-600 hover:text-indigo-700 transition-colors">
                  Voir tout
                </Link>
              </div>

              {recentSearches.length === 0 ? (
                <div className="bg-white rounded-2xl p-8 text-center shadow-lg border border-gray-100/50">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-gray-100 to-gray-50 flex items-center justify-center">
                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <p className="text-gray-500 mb-4">Aucune recherche pour le moment</p>
                  <Button onClick={() => router.push('/new-search')} size="sm" className="bg-gradient-to-r from-indigo-500 to-purple-600">
                    Creer ma premiere recherche
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentSearches.map((search) => (
                    <Link key={search.id} href={`/searches/${search.id}`}>
                      <div className="bg-white rounded-2xl p-4 shadow-md hover:shadow-lg transition-all duration-300 cursor-pointer border border-gray-100/50 hover:-translate-y-0.5 group">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-3 h-3 rounded-full ${
                              search.status === 'completed' ? 'bg-gradient-to-r from-emerald-400 to-teal-500 shadow-lg shadow-emerald-500/30' :
                              search.status === 'processing' ? 'bg-gradient-to-r from-amber-400 to-orange-500 animate-pulse shadow-lg shadow-amber-500/30' :
                              'bg-gray-300'
                            }`} />
                            <div>
                              <p className="font-semibold text-gray-900 line-clamp-1 group-hover:text-indigo-600 transition-colors">{search.name}</p>
                              <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                                <span>{new Date(search.created_at).toLocaleDateString('fr-FR')}</span>
                                {search.input_type === 'linkedin' && (
                                  <span className="px-2 py-0.5 rounded-full bg-[#0A66C2]/10 text-[#0A66C2] font-medium">LinkedIn</span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-2xl font-bold bg-gradient-to-r from-indigo-500 to-purple-500 bg-clip-text text-transparent">{search.match_count}</span>
                            <span className="text-xs text-gray-500 block">matchs</span>
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Top Matches */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-900">Meilleurs matchs</h2>
                <span className="text-xs px-3 py-1.5 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold shadow-lg shadow-emerald-500/30">
                  Score IA
                </span>
              </div>

              {topMatches.length === 0 ? (
                <div className="bg-white rounded-2xl p-8 text-center shadow-lg border border-gray-100/50">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-gray-100 to-gray-50 flex items-center justify-center">
                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                    </svg>
                  </div>
                  <p className="text-gray-500">Lancez une recherche pour voir vos meilleurs matchs</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {topMatches.map((match, index) => (
                    <Link key={match.id} href={`/searches/${match.search_id}`}>
                      <div className="bg-white rounded-2xl p-4 shadow-md hover:shadow-lg transition-all duration-300 cursor-pointer border border-gray-100/50 hover:-translate-y-0.5 group">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-bold shadow-lg ${
                            index === 0 ? 'bg-gradient-to-br from-amber-400 to-orange-500 shadow-amber-500/30' :
                            index === 1 ? 'bg-gradient-to-br from-gray-300 to-gray-400 shadow-gray-400/30' :
                            index === 2 ? 'bg-gradient-to-br from-amber-600 to-amber-700 shadow-amber-600/30' :
                            'bg-gradient-to-br from-indigo-500 to-purple-500 shadow-indigo-500/30'
                          }`}>
                            {index + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-gray-900 truncate group-hover:text-indigo-600 transition-colors">{match.job_title}</p>
                            <p className="text-sm text-gray-500 truncate">{match.company_name}</p>
                          </div>
                          <div className="text-right">
                            <span className="text-2xl font-bold bg-gradient-to-r from-emerald-500 to-teal-500 bg-clip-text text-transparent">{match.score}</span>
                            <span className="text-xs text-gray-500">/100</span>
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Suggestions */}
          <div className="mt-8">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Actions suggerees</h2>
            <div className="grid md:grid-cols-3 gap-4">
              <Link href="/contacts">
                <div className="bg-white rounded-2xl p-5 shadow-md hover:shadow-lg transition-all duration-300 border border-gray-100/50 hover:-translate-y-0.5 cursor-pointer group">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/30 group-hover:scale-105 transition-transform">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">Enrichir les contacts</p>
                      <p className="text-xs text-gray-500">Obtenez les emails des recruteurs</p>
                    </div>
                  </div>
                </div>
              </Link>
              <Link href="/recurrence">
                <div className="bg-white rounded-2xl p-5 shadow-md hover:shadow-lg transition-all duration-300 border border-gray-100/50 hover:-translate-y-0.5 cursor-pointer group">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center shadow-lg shadow-violet-500/30 group-hover:scale-105 transition-transform">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 group-hover:text-violet-600 transition-colors">Activer la recurrence</p>
                      <p className="text-xs text-gray-500">Recevez les nouvelles offres automatiquement</p>
                    </div>
                  </div>
                </div>
              </Link>
              <Link href="/company">
                <div className="bg-white rounded-2xl p-5 shadow-md hover:shadow-lg transition-all duration-300 border border-gray-100/50 hover:-translate-y-0.5 cursor-pointer group">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/30 group-hover:scale-105 transition-transform">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 group-hover:text-emerald-600 transition-colors">Analyser une entreprise</p>
                      <p className="text-xs text-gray-500">Stack tech, culture, postes ouverts</p>
                    </div>
                  </div>
                </div>
              </Link>
            </div>
          </div>

        </div>
      </div>
    </AppLayout>
  )
}
