'use client'

import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import Link from 'next/link'
import AppLayout from '@/components/AppLayout'

type Search = {
  id: string
  name: string
  search_type: string
  created_at: string
  status: string
  is_favorite: boolean
  job_title: string | null
  location: string | null
  recurrence: string | null
  match_count?: number
  top_score?: number
}

type FilterType = 'all' | 'completed' | 'processing' | 'favorites' | 'recurrent'
type SortType = 'date_desc' | 'date_asc' | 'name_asc' | 'matches_desc'

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return "Aujourd'hui"
  if (diffDays === 1) return 'Hier'
  if (diffDays < 7) return `Il y a ${diffDays}j`
  if (diffDays < 30) return `Il y a ${Math.floor(diffDays / 7)} sem.`
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

export default function SearchesPage() {
  const router = useRouter()
  const [searches, setSearches] = useState<Search[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filter, setFilter] = useState<FilterType>('all')
  const [sort, setSort] = useState<SortType>('date_desc')

  useEffect(() => {
    loadSearches()
  }, [])

  const loadSearches = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      router.push('/login')
      return
    }

    const { data } = await supabase
      .from('searches')
      .select('id, name, search_type, created_at, status, is_favorite, job_title, location, recurrence')
      .order('created_at', { ascending: false })

    if (data) {
      // Get match counts and top scores for each search
      const searchesWithStats = await Promise.all(
        data.map(async (search) => {
          const { count } = await supabase
            .from('matches')
            .select('*', { count: 'exact', head: true })
            .eq('search_id', search.id)

          const { data: topMatch } = await supabase
            .from('matches')
            .select('score')
            .eq('search_id', search.id)
            .order('score', { ascending: false })
            .limit(1)
            .single()

          return {
            ...search,
            match_count: count || 0,
            top_score: topMatch?.score || 0
          }
        })
      )
      setSearches(searchesWithStats)
    }
    setLoading(false)
  }

  const toggleFavorite = async (e: React.MouseEvent, searchId: string, currentValue: boolean) => {
    e.preventDefault()
    e.stopPropagation()

    const { error } = await supabase
      .from('searches')
      .update({ is_favorite: !currentValue })
      .eq('id', searchId)

    if (!error) {
      setSearches(prev => prev.map(s =>
        s.id === searchId ? { ...s, is_favorite: !currentValue } : s
      ))
    }
  }

  const deleteSearch = async (e: React.MouseEvent, searchId: string) => {
    e.preventDefault()
    e.stopPropagation()

    if (!confirm('Supprimer cette recherche et tous ses resultats ?')) return

    // Delete matches first
    await supabase.from('matches').delete().eq('search_id', searchId)
    // Delete search
    const { error } = await supabase.from('searches').delete().eq('id', searchId)

    if (!error) {
      setSearches(prev => prev.filter(s => s.id !== searchId))
    }
  }

  // Filter and sort
  const filteredSearches = useMemo(() => {
    let result = searches

    // Text search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      result = result.filter(s =>
        s.name.toLowerCase().includes(query) ||
        s.job_title?.toLowerCase().includes(query) ||
        s.location?.toLowerCase().includes(query)
      )
    }

    // Category filter
    switch (filter) {
      case 'completed':
        result = result.filter(s => s.status === 'completed')
        break
      case 'processing':
        result = result.filter(s => s.status === 'processing')
        break
      case 'favorites':
        result = result.filter(s => s.is_favorite)
        break
      case 'recurrent':
        result = result.filter(s => s.recurrence && s.recurrence !== 'none')
        break
    }

    // Sort
    switch (sort) {
      case 'date_desc':
        result = [...result].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        break
      case 'date_asc':
        result = [...result].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
        break
      case 'name_asc':
        result = [...result].sort((a, b) => a.name.localeCompare(b.name))
        break
      case 'matches_desc':
        result = [...result].sort((a, b) => (b.match_count || 0) - (a.match_count || 0))
        break
    }

    return result
  }, [searches, searchQuery, filter, sort])

  // Stats
  const stats = useMemo(() => ({
    total: searches.length,
    completed: searches.filter(s => s.status === 'completed').length,
    processing: searches.filter(s => s.status === 'processing').length,
    favorites: searches.filter(s => s.is_favorite).length,
    recurrent: searches.filter(s => s.recurrence && s.recurrence !== 'none').length,
    totalMatches: searches.reduce((sum, s) => sum + (s.match_count || 0), 0)
  }), [searches])

  if (loading) {
    return (
      <AppLayout>
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
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-purple-50/20">
        {/* Background decorations */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-br from-blue-200/20 to-cyan-200/20 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-gradient-to-tr from-indigo-200/20 to-purple-200/20 rounded-full blur-3xl" />
        </div>

        <div className="p-4 md:p-8 relative">
          <div className="max-w-6xl mx-auto">
            {/* Header */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center shadow-xl shadow-blue-500/30">
                    <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <div>
                    <h1 className="text-3xl font-bold text-gray-900">Mes recherches</h1>
                    <p className="text-gray-500">{stats.totalMatches} opportunites trouvees au total</p>
                  </div>
                </div>
                <Button
                  onClick={() => router.push('/new-search')}
                  className="h-12 px-6 rounded-xl bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-600 hover:from-indigo-600 hover:via-purple-600 hover:to-indigo-700 shadow-lg shadow-indigo-500/30 text-white font-semibold"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                  </svg>
                  Nouvelle recherche
                </Button>
              </div>

              {/* Search bar */}
              <div className="relative mb-4">
                <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <Input
                  type="text"
                  placeholder="Rechercher par nom, poste ou localisation..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-12 h-12 rounded-xl bg-white/80 backdrop-blur-sm border-0 shadow-lg focus:ring-2 focus:ring-indigo-500/50"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-gray-100 transition-colors"
                  >
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>

              {/* Filters */}
              <div className="flex flex-wrap items-center gap-3">
                {[
                  { key: 'all', label: 'Toutes', count: stats.total, color: 'from-indigo-500 to-purple-600' },
                  { key: 'completed', label: 'Terminees', count: stats.completed, color: 'from-emerald-500 to-teal-500' },
                  { key: 'processing', label: 'En cours', count: stats.processing, color: 'from-amber-500 to-orange-500' },
                  { key: 'favorites', label: 'Favoris', count: stats.favorites, color: 'from-amber-400 to-orange-500' },
                  { key: 'recurrent', label: 'Recurrentes', count: stats.recurrent, color: 'from-violet-500 to-purple-500' },
                ].map(f => (
                  <button
                    key={f.key}
                    onClick={() => setFilter(f.key as FilterType)}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 ${
                      filter === f.key
                        ? `bg-gradient-to-r ${f.color} text-white shadow-lg`
                        : 'bg-white/80 text-gray-700 hover:bg-white hover:shadow-md'
                    }`}
                  >
                    {f.label} ({f.count})
                  </button>
                ))}

                {/* Sort dropdown */}
                <div className="ml-auto">
                  <Select value={sort} onValueChange={(v) => setSort(v as SortType)}>
                    <SelectTrigger className="w-[180px] rounded-xl bg-white/80 border-0 shadow-sm">
                      <SelectValue placeholder="Trier par" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="date_desc">Plus recentes</SelectItem>
                      <SelectItem value="date_asc">Plus anciennes</SelectItem>
                      <SelectItem value="name_asc">Nom A-Z</SelectItem>
                      <SelectItem value="matches_desc">Plus de resultats</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Results */}
            {searches.length === 0 ? (
              <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-12 text-center shadow-xl border border-white/50">
                <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-gray-100 to-gray-50 flex items-center justify-center">
                  <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-700 mb-2">Aucune recherche pour le moment</h3>
                <p className="text-gray-500 mb-6">Lancez votre premiere recherche pour trouver les meilleures opportunites</p>
                <Button
                  onClick={() => router.push('/new-search')}
                  className="h-12 px-6 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 shadow-lg shadow-indigo-500/30"
                >
                  Creer ma premiere recherche
                </Button>
              </div>
            ) : filteredSearches.length === 0 ? (
              <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-12 text-center shadow-xl border border-white/50">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gray-100 flex items-center justify-center">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-gray-500">Aucun resultat pour "{searchQuery}"</p>
                <button
                  onClick={() => { setSearchQuery(''); setFilter('all'); }}
                  className="mt-4 text-indigo-600 hover:text-indigo-700 font-medium"
                >
                  Effacer les filtres
                </button>
              </div>
            ) : (
              <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl border border-white/50 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50/50">
                        <th className="text-left p-4 w-12"></th>
                        <th className="text-left p-4 font-semibold text-gray-600">Recherche</th>
                        <th className="text-left p-4 font-semibold text-gray-600">Criteres</th>
                        <th className="text-left p-4 font-semibold text-gray-600 text-center">Resultats</th>
                        <th className="text-left p-4 font-semibold text-gray-600 text-center">Top score</th>
                        <th className="text-left p-4 font-semibold text-gray-600">Date</th>
                        <th className="text-left p-4 font-semibold text-gray-600">Statut</th>
                        <th className="text-left p-4 font-semibold text-gray-600 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSearches.map((search, index) => (
                        <tr
                          key={search.id}
                          onClick={() => router.push(`/searches/${search.id}`)}
                          className={`border-b border-gray-50 cursor-pointer transition-all duration-200 ${
                            index % 2 === 0
                              ? 'bg-white/50 hover:bg-indigo-50/50'
                              : 'bg-gray-50/30 hover:bg-indigo-50/50'
                          }`}
                        >
                          {/* Favorite */}
                          <td className="p-4">
                            <button
                              onClick={(e) => toggleFavorite(e, search.id, search.is_favorite)}
                              className={`p-2 rounded-lg transition-all duration-200 ${
                                search.is_favorite
                                  ? 'bg-amber-100 text-amber-500 hover:bg-amber-200'
                                  : 'bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-amber-500'
                              }`}
                            >
                              <svg className="w-4 h-4" fill={search.is_favorite ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                              </svg>
                            </button>
                          </td>

                          {/* Name */}
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0 ${
                                search.search_type === 'linkedin'
                                  ? 'bg-[#0A66C2] shadow-blue-500/20'
                                  : search.search_type === 'cv'
                                    ? 'bg-gradient-to-br from-emerald-500 to-teal-600 shadow-emerald-500/20'
                                    : 'bg-gradient-to-br from-indigo-500 to-purple-600 shadow-indigo-500/20'
                              }`}>
                                {search.search_type === 'linkedin' ? (
                                  <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                                  </svg>
                                ) : search.search_type === 'cv' ? (
                                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                  </svg>
                                ) : (
                                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                  </svg>
                                )}
                              </div>
                              <div>
                                <p className="font-semibold text-gray-900 hover:text-indigo-600 transition-colors">
                                  {search.name}
                                </p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className={`text-xs ${
                                    search.search_type === 'linkedin' ? 'text-[#0A66C2]' :
                                    search.search_type === 'cv' ? 'text-emerald-600' : 'text-indigo-600'
                                  }`}>
                                    {search.search_type === 'linkedin' ? 'LinkedIn' : search.search_type === 'cv' ? 'CV' : 'Standard'}
                                  </span>
                                  {search.recurrence && search.recurrence !== 'none' && (
                                    <>
                                      <span className="text-gray-300">•</span>
                                      <span className="inline-flex items-center gap-1 text-xs text-violet-600">
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                        </svg>
                                        Recurrente
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Criteria */}
                          <td className="p-4">
                            <div className="flex flex-wrap gap-1.5">
                              {search.job_title && (
                                <span className="px-2 py-1 rounded-lg bg-indigo-100 text-indigo-700 text-xs font-medium">
                                  {search.job_title}
                                </span>
                              )}
                              {search.location && (
                                <span className="px-2 py-1 rounded-lg bg-gray-100 text-gray-600 text-xs">
                                  {search.location}
                                </span>
                              )}
                              {!search.job_title && !search.location && (
                                <span className="text-xs text-gray-400">CV / LinkedIn</span>
                              )}
                            </div>
                          </td>

                          {/* Match count */}
                          <td className="p-4 text-center">
                            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-100 text-blue-700 font-semibold">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                              </svg>
                              {search.match_count || 0}
                            </div>
                          </td>

                          {/* Top score */}
                          <td className="p-4 text-center">
                            {search.top_score && search.top_score > 0 ? (
                              <div className={`inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-semibold text-white bg-gradient-to-r ${
                                search.top_score >= 80 ? 'from-emerald-500 to-teal-500' :
                                search.top_score >= 60 ? 'from-indigo-500 to-purple-500' :
                                'from-amber-500 to-orange-500'
                              }`}>
                                {search.top_score}%
                              </div>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>

                          {/* Date */}
                          <td className="p-4">
                            <span className="text-sm text-gray-500">
                              {formatRelativeDate(search.created_at)}
                            </span>
                          </td>

                          {/* Status */}
                          <td className="p-4">
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold ${
                              search.status === 'completed'
                                ? 'bg-emerald-100 text-emerald-700'
                                : search.status === 'error'
                                  ? 'bg-red-100 text-red-700'
                                  : 'bg-amber-100 text-amber-700'
                            }`}>
                              {search.status === 'completed' ? (
                                <>
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                  Terminee
                                </>
                              ) : search.status === 'error' ? (
                                <>
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                  Erreur
                                </>
                              ) : (
                                <>
                                  <div className="w-3 h-3 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" />
                                  En cours
                                </>
                              )}
                            </span>
                          </td>

                          {/* Actions */}
                          <td className="p-4">
                            <div className="flex items-center justify-center gap-2">
                              <Link
                                href={`/searches/${search.id}`}
                                onClick={(e) => e.stopPropagation()}
                                className="p-2 rounded-lg bg-indigo-100 text-indigo-600 hover:bg-indigo-200 transition-colors"
                                title="Voir les resultats"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                              </Link>
                              <button
                                onClick={(e) => deleteSearch(e, search.id)}
                                className="p-2 rounded-lg bg-gray-100 text-gray-500 hover:bg-red-100 hover:text-red-600 transition-colors"
                                title="Supprimer"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Quick stats */}
            {searches.length > 0 && (
              <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white/60 backdrop-blur-sm rounded-xl p-4 border border-white/50">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
                      <p className="text-xs text-gray-500">Recherches</p>
                    </div>
                  </div>
                </div>
                <div className="bg-white/60 backdrop-blur-sm rounded-xl p-4 border border-white/50">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-gray-900">{stats.totalMatches}</p>
                      <p className="text-xs text-gray-500">Opportunites</p>
                    </div>
                  </div>
                </div>
                <div className="bg-white/60 backdrop-blur-sm rounded-xl p-4 border border-white/50">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-gray-900">{stats.completed}</p>
                      <p className="text-xs text-gray-500">Terminees</p>
                    </div>
                  </div>
                </div>
                <div className="bg-white/60 backdrop-blur-sm rounded-xl p-4 border border-white/50">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-gray-900">{stats.favorites}</p>
                      <p className="text-xs text-gray-500">Favoris</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
