'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import AppLayout from '@/components/AppLayout'

type FavoriteSearch = {
  id: string
  name: string
  created_at: string
  status: string
  recurrence: string | null
  job_title: string | null
  location: string | null
  match_count?: number
}

type FavoriteJob = {
  id: string
  job_title: string
  company_name: string
  location: string
  score: number
  posted_date: string | null
  search_id: string
  search_name?: string
  is_favorite: boolean
  matching_details?: {
    contract_type?: string
    remote_type?: string
    salary_min?: number
    salary_max?: number
  }
}

type SortOption = 'date_desc' | 'date_asc' | 'name_asc' | 'score_desc' | 'company_asc'

function formatRelativeDate(dateStr: string | null): string {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return "Aujourd'hui"
  if (diffDays === 1) return 'Hier'
  if (diffDays < 7) return `Il y a ${diffDays}j`
  if (diffDays < 30) return `Il y a ${Math.floor(diffDays / 7)} sem.`
  return `Il y a ${Math.floor(diffDays / 30)} mois`
}

function formatSalary(min?: number | null, max?: number | null): string | null {
  if (!min && !max) return null
  if (min && max) return `${Math.round(min/1000)}-${Math.round(max/1000)}K`
  if (min) return `${Math.round(min/1000)}K+`
  if (max) return `< ${Math.round(max/1000)}K`
  return null
}

function getScoreColor(score: number): string {
  if (score >= 80) return 'from-emerald-500 to-teal-500'
  if (score >= 60) return 'from-indigo-500 to-purple-500'
  if (score >= 40) return 'from-amber-500 to-orange-500'
  return 'from-gray-400 to-gray-500'
}

export default function FavoritesPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'searches' | 'jobs'>('searches')
  const [favoriteSearches, setFavoriteSearches] = useState<FavoriteSearch[]>([])
  const [favoriteJobs, setFavoriteJobs] = useState<FavoriteJob[]>([])
  const [loading, setLoading] = useState(true)
  const [searchSort, setSearchSort] = useState<SortOption>('date_desc')
  const [jobSort, setJobSort] = useState<SortOption>('score_desc')
  const [rerunningId, setRerunningId] = useState<string | null>(null)

  useEffect(() => {
    loadFavorites()
  }, [])

  const loadFavorites = async () => {
    setLoading(true)
    try {
      // Load favorite searches with match count
      const { data: searches } = await supabase
        .from('searches')
        .select('id, name, created_at, status, recurrence, job_title, location')
        .eq('is_favorite', true)
        .order('created_at', { ascending: false })

      if (searches) {
        // Get match counts for each search
        const searchesWithCounts = await Promise.all(
          searches.map(async (search) => {
            const { count } = await supabase
              .from('matches')
              .select('*', { count: 'exact', head: true })
              .eq('search_id', search.id)
            return { ...search, match_count: count || 0 }
          })
        )
        setFavoriteSearches(searchesWithCounts)
      }

      // Load favorite jobs with search names
      const { data: jobs } = await supabase
        .from('matches')
        .select('id, job_title, company_name, location, score, posted_date, search_id, is_favorite, matching_details')
        .eq('is_favorite', true)
        .order('score', { ascending: false })

      if (jobs) {
        // Get search names
        const searchIds = [...new Set(jobs.map(j => j.search_id))]
        const { data: searchNames } = await supabase
          .from('searches')
          .select('id, name')
          .in('id', searchIds)

        const searchNameMap = new Map(searchNames?.map(s => [s.id, s.name]) || [])
        const jobsWithSearchNames = jobs.map(job => ({
          ...job,
          search_name: searchNameMap.get(job.search_id) || 'Recherche inconnue'
        }))
        setFavoriteJobs(jobsWithSearchNames)
      }
    } catch (error) {
      console.error('Error loading favorites:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleRemoveFavoriteSearch = async (id: string) => {
    const { error } = await supabase
      .from('searches')
      .update({ is_favorite: false })
      .eq('id', id)

    if (!error) {
      setFavoriteSearches(prev => prev.filter(s => s.id !== id))
    }
  }

  const handleRemoveFavoriteJob = async (id: string) => {
    const { error } = await supabase
      .from('matches')
      .update({ is_favorite: false })
      .eq('id', id)

    if (!error) {
      setFavoriteJobs(prev => prev.filter(j => j.id !== id))
    }
  }

  const handleRerunSearch = async (searchId: string) => {
    setRerunningId(searchId)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
        return
      }

      // Get original search data
      const { data: search } = await supabase
        .from('searches')
        .select('*')
        .eq('id', searchId)
        .single()

      if (!search) {
        throw new Error('Recherche non trouvee')
      }

      // Create a new search with same parameters
      const response = await fetch('/api/analyze-cv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${search.name} (relance)`,
          search_type: 'both',
          user_id: session.user.id,
          exclude_agencies: search.exclude_agencies ?? true,
          job_title: search.job_title,
          location: search.location,
          brief: search.brief,
          seniority: search.seniority,
          contract_type: search.contract_type,
          remote_preference: search.remote_preference,
          recurrence: 'none',
          cv_text: search.cv_text,
        })
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Erreur')

      router.push(`/searches/${data.search_id}`)
    } catch (error) {
      console.error('Error rerunning search:', error)
    } finally {
      setRerunningId(null)
    }
  }

  // Sort functions
  const sortedSearches = [...favoriteSearches].sort((a, b) => {
    switch (searchSort) {
      case 'date_desc': return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      case 'date_asc': return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      case 'name_asc': return a.name.localeCompare(b.name)
      default: return 0
    }
  })

  const sortedJobs = [...favoriteJobs].sort((a, b) => {
    switch (jobSort) {
      case 'score_desc': return b.score - a.score
      case 'date_desc': return new Date(b.posted_date || 0).getTime() - new Date(a.posted_date || 0).getTime()
      case 'date_asc': return new Date(a.posted_date || 0).getTime() - new Date(b.posted_date || 0).getTime()
      case 'company_asc': return a.company_name.localeCompare(b.company_name)
      default: return 0
    }
  })

  if (loading) {
    return (
      <AppLayout>
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-indigo-50/30 to-purple-50/20">
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-xl shadow-amber-500/30 animate-pulse">
              <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            </div>
            <p className="text-gray-500">Chargement des favoris...</p>
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
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-br from-amber-200/20 to-orange-200/20 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-gradient-to-tr from-indigo-200/20 to-purple-200/20 rounded-full blur-3xl" />
        </div>

        <div className="p-4 md:p-8 relative">
          <div className="max-w-6xl mx-auto">
            {/* Header */}
            <div className="mb-8">
              <div className="flex items-center gap-4 mb-2">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-xl shadow-amber-500/30">
                  <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">Mes Favoris</h1>
                  <p className="text-gray-500">
                    {favoriteSearches.length} recherche{favoriteSearches.length > 1 ? 's' : ''} et {favoriteJobs.length} offre{favoriteJobs.length > 1 ? 's' : ''} en favori
                  </p>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-6">
              <button
                onClick={() => setActiveTab('searches')}
                className={`flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold transition-all duration-300 ${
                  activeTab === 'searches'
                    ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-white shadow-lg shadow-amber-500/30'
                    : 'bg-white/80 text-gray-700 hover:bg-white hover:shadow-md'
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                Recherches ({favoriteSearches.length})
              </button>
              <button
                onClick={() => setActiveTab('jobs')}
                className={`flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold transition-all duration-300 ${
                  activeTab === 'jobs'
                    ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-white shadow-lg shadow-amber-500/30'
                    : 'bg-white/80 text-gray-700 hover:bg-white hover:shadow-md'
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                Offres ({favoriteJobs.length})
              </button>
            </div>

            {/* Content */}
            {activeTab === 'searches' ? (
              <div className="space-y-4">
                {/* Sort dropdown */}
                <div className="flex justify-end">
                  <Select value={searchSort} onValueChange={(v) => setSearchSort(v as SortOption)}>
                    <SelectTrigger className="w-[180px] rounded-xl bg-white/80 border-0 shadow-sm">
                      <SelectValue placeholder="Trier par" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="date_desc">Plus recentes</SelectItem>
                      <SelectItem value="date_asc">Plus anciennes</SelectItem>
                      <SelectItem value="name_asc">Nom A-Z</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Search cards */}
                {sortedSearches.length === 0 ? (
                  <Card className="p-12 bg-white/80 backdrop-blur-xl border-0 shadow-lg text-center">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gray-100 flex items-center justify-center">
                      <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-700 mb-2">Aucune recherche favorite</h3>
                    <p className="text-gray-500 mb-4">Ajoutez des recherches a vos favoris pour les retrouver ici</p>
                    <Button onClick={() => router.push('/searches')} className="rounded-xl">
                      Voir mes recherches
                    </Button>
                  </Card>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    {sortedSearches.map((search) => (
                      <Card
                        key={search.id}
                        className="p-5 bg-white/80 backdrop-blur-xl border-0 shadow-lg hover:shadow-xl transition-all duration-300 group"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <Link href={`/searches/${search.id}`} className="block">
                              <h3 className="font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors">
                                {search.name}
                              </h3>
                            </Link>
                            <p className="text-sm text-gray-500 mt-1">
                              {search.job_title && <span>{search.job_title}</span>}
                              {search.job_title && search.location && <span> - </span>}
                              {search.location && <span>{search.location}</span>}
                              {!search.job_title && !search.location && 'Recherche personnalisee'}
                            </p>
                          </div>
                          <button
                            onClick={() => handleRemoveFavoriteSearch(search.id)}
                            className="p-2 rounded-lg bg-amber-100 text-amber-600 hover:bg-amber-200 transition-colors"
                            title="Retirer des favoris"
                          >
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                          </button>
                        </div>

                        <div className="flex items-center gap-3 text-sm text-gray-500 mb-4">
                          <span className="flex items-center gap-1">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                            </svg>
                            {search.match_count} resultats
                          </span>
                          <span className="flex items-center gap-1">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {formatRelativeDate(search.created_at)}
                          </span>
                          {search.recurrence && search.recurrence !== 'none' && (
                            <span className="flex items-center gap-1 text-indigo-600">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                              </svg>
                              Recurrente
                            </span>
                          )}
                        </div>

                        <div className="flex gap-2">
                          <Link href={`/searches/${search.id}`} className="flex-1">
                            <Button variant="outline" className="w-full rounded-xl">
                              Voir les resultats
                            </Button>
                          </Link>
                          <Button
                            onClick={() => handleRerunSearch(search.id)}
                            disabled={rerunningId === search.id}
                            className="rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 shadow-lg shadow-indigo-500/30"
                          >
                            {rerunningId === search.id ? (
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                              </svg>
                            )}
                          </Button>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {/* Sort dropdown */}
                <div className="flex justify-end">
                  <Select value={jobSort} onValueChange={(v) => setJobSort(v as SortOption)}>
                    <SelectTrigger className="w-[180px] rounded-xl bg-white/80 border-0 shadow-sm">
                      <SelectValue placeholder="Trier par" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="score_desc">Meilleur score</SelectItem>
                      <SelectItem value="date_desc">Plus recentes</SelectItem>
                      <SelectItem value="date_asc">Plus anciennes</SelectItem>
                      <SelectItem value="company_asc">Entreprise A-Z</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Job cards */}
                {sortedJobs.length === 0 ? (
                  <Card className="p-12 bg-white/80 backdrop-blur-xl border-0 shadow-lg text-center">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gray-100 flex items-center justify-center">
                      <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-700 mb-2">Aucune offre favorite</h3>
                    <p className="text-gray-500 mb-4">Ajoutez des offres a vos favoris pour les retrouver ici</p>
                    <Button onClick={() => router.push('/searches')} className="rounded-xl">
                      Voir mes recherches
                    </Button>
                  </Card>
                ) : (
                  <div className="grid gap-4">
                    {sortedJobs.map((job) => (
                      <Card
                        key={job.id}
                        className="p-5 bg-white/80 backdrop-blur-xl border-0 shadow-lg hover:shadow-xl transition-all duration-300"
                      >
                        <div className="flex items-start gap-4">
                          {/* Score */}
                          <div className={`flex-shrink-0 w-14 h-14 rounded-xl bg-gradient-to-br ${getScoreColor(job.score)} flex items-center justify-center text-white font-bold shadow-lg`}>
                            {job.score}%
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                <Link href={`/searches/${job.search_id}`}>
                                  <h3 className="font-semibold text-gray-900 hover:text-indigo-600 transition-colors truncate">
                                    {job.job_title}
                                  </h3>
                                </Link>
                                <p className="text-gray-600">@ {job.company_name}</p>
                              </div>
                              <button
                                onClick={() => handleRemoveFavoriteJob(job.id)}
                                className="flex-shrink-0 p-2 rounded-lg bg-amber-100 text-amber-600 hover:bg-amber-200 transition-colors"
                                title="Retirer des favoris"
                              >
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                </svg>
                              </button>
                            </div>

                            {/* Tags */}
                            <div className="flex flex-wrap items-center gap-2 mt-3">
                              {job.location && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gray-100 text-gray-600 text-xs">
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                  </svg>
                                  {job.location}
                                </span>
                              )}
                              {job.matching_details?.contract_type && (
                                <span className="px-2.5 py-1 rounded-lg bg-indigo-100 text-indigo-700 text-xs font-medium">
                                  {job.matching_details.contract_type === 'F' ? 'CDI' : job.matching_details.contract_type === 'C' ? 'CDD' : job.matching_details.contract_type === 'I' ? 'Stage' : job.matching_details.contract_type}
                                </span>
                              )}
                              {job.matching_details?.remote_type && (
                                <span className={`px-2.5 py-1 rounded-lg text-xs font-medium ${
                                  job.matching_details.remote_type === 'remote'
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : job.matching_details.remote_type === 'hybrid'
                                      ? 'bg-blue-100 text-blue-700'
                                      : 'bg-gray-100 text-gray-600'
                                }`}>
                                  {job.matching_details.remote_type === 'remote' ? 'Remote' : job.matching_details.remote_type === 'hybrid' ? 'Hybride' : 'Sur site'}
                                </span>
                              )}
                              {formatSalary(job.matching_details?.salary_min, job.matching_details?.salary_max) && (
                                <span className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-700 text-xs font-medium">
                                  {formatSalary(job.matching_details?.salary_min, job.matching_details?.salary_max)}
                                </span>
                              )}
                              <span className="px-2.5 py-1 rounded-lg bg-gray-100 text-gray-500 text-xs">
                                {formatRelativeDate(job.posted_date)}
                              </span>
                            </div>

                            {/* Search reference */}
                            <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
                              <Link
                                href={`/searches/${job.search_id}`}
                                className="text-sm text-gray-500 hover:text-indigo-600 transition-colors flex items-center gap-1"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                                {job.search_name}
                              </Link>
                              <a
                                href={`/api/redirect/${job.id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                              >
                                Voir l'offre
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                              </a>
                            </div>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
