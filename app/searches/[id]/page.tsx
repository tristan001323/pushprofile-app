'use client'

import { useState, useEffect, use } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import AppLayout from '@/components/AppLayout'

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
  viewed_at: string | null
  is_favorite: boolean
  source: string
  source_engine?: 'adzuna' | 'indeed' | 'ats_direct' | null
  matching_details: {
    contract_type?: string
    remote_type?: string
    salary_min?: number
    salary_max?: number
    full_description?: string
    recruiter_name?: string
    recruiter_url?: string
    poster_name?: string
    poster_url?: string
    experience_level?: string
    sector?: string
    company_rating?: number
    company_industry?: string
    company_size?: string
    is_easy_apply?: boolean
    salary_text?: string
    company_slug?: string
    enriched_contacts?: EnrichedContact[]
    tech_stack?: string[]
  }
}

type EnrichedContact = {
  full_name: string | null
  first_name: string | null
  last_name: string | null
  job_title: string | null
  email: string | null
  email_status: string | null
  phone: string | null
  linkedin_url: string | null
  company_name: string | null
}

type SortField = 'score' | 'rank' | 'company_name' | 'posted_date' | 'job_title'
type SortOrder = 'asc' | 'desc'
type DateFilter = 'all' | 'week' | '2weeks' | 'month' | 'older'

// Processing step indicator component
function StepItem({ label, done, active }: { label: string; done: boolean; active: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm font-medium transition-all ${
          done
            ? 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/30'
            : active
            ? 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white animate-pulse shadow-lg shadow-indigo-500/30'
            : 'bg-gray-100 text-gray-400'
        }`}
      >
        {done ? '✓' : active ? '...' : '○'}
      </div>
      <span
        className={`text-sm ${
          done ? 'text-emerald-600 font-medium' : active ? 'text-indigo-600 font-semibold' : 'text-gray-400'
        }`}
      >
        {label}
      </span>
    </div>
  )
}

// Format relative date
function formatRelativeDate(dateStr: string | null): string {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return "Aujourd'hui"
  if (diffDays === 1) return 'Hier'
  if (diffDays < 7) return `${diffDays}j`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} sem.`
  return `${Math.floor(diffDays / 30)} mois`
}

// Format salary
function formatSalary(min?: number | null, max?: number | null): string | null {
  if (!min && !max) return null
  if (min && max) return `${Math.round(min/1000)}-${Math.round(max/1000)}K`
  if (min) return `${Math.round(min/1000)}K+`
  if (max) return `< ${Math.round(max/1000)}K`
  return null
}

// Format contract type
function formatContractType(type?: string): string {
  if (!type) return 'CDI'
  const t = type.toLowerCase()
  if (t === 'contract' || t === 'cdd' || t === 'c') return 'CDD'
  if (t === 'internship' || t === 'i') return 'Stage'
  if (t === 'freelance') return 'Freelance'
  if (t === 'f' || t === 'full-time' || t === 'permanent') return 'CDI'
  return 'CDI'
}

// Format remote type
function formatRemoteType(type?: string): string {
  if (!type) return 'Sur site'
  const t = type.toLowerCase()
  if (t === 'remote' || t === 'full_remote' || t === 'fully_remote') return 'Remote'
  if (t === 'hybrid') return 'Hybride'
  return 'Sur site'
}

// Get match strength (1-5 dots)
function getMatchStrength(score: number): { dots: number; label: string; color: string } {
  if (score >= 90) return { dots: 5, label: 'Pour vous', color: 'text-indigo-500' }
  if (score >= 75) return { dots: 4, label: 'Très pertinent', color: 'text-indigo-500' }
  if (score >= 60) return { dots: 3, label: 'Pertinent', color: 'text-indigo-400' }
  if (score >= 40) return { dots: 2, label: 'À explorer', color: 'text-gray-400' }
  return { dots: 1, label: '', color: 'text-gray-300' }
}

// Render match strength dots
function MatchDots({ score, showLabel = false }: { score: number; showLabel?: boolean }) {
  const { dots, label, color } = getMatchStrength(score)

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className={`w-2 h-2 rounded-full transition-colors ${
              i <= dots ? color.replace('text-', 'bg-') : 'bg-gray-200'
            }`}
          />
        ))}
      </div>
      {showLabel && label && (
        <span className={`text-sm font-medium ${color}`}>{label}</span>
      )}
    </div>
  )
}


export default function SearchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const router = useRouter()
  const [matches, setMatches] = useState<Match[]>([])
  const [searchName, setSearchName] = useState('')
  const [loading, setLoading] = useState(true)
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null)
  const [filter, setFilter] = useState<string>('all')
  const [dateFilter, setDateFilter] = useState<DateFilter>('all')
  const [sortField, setSortField] = useState<SortField>('rank')
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc')
  const [enrichedContacts, setEnrichedContacts] = useState<EnrichedContact[]>([])
  const [contactsLoading, setContactsLoading] = useState(false)
  const [contactsError, setContactsError] = useState<string | null>(null)
  const [contactsSearched, setContactsSearched] = useState(false)
  const [descriptionExpanded, setDescriptionExpanded] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)

  // Processing state - start with 'loading' to avoid flashing processing screen
  const [searchStatus, setSearchStatus] = useState<'loading' | 'processing' | 'completed' | 'error'>('loading')
  const [processingStep, setProcessingStep] = useState<string | null>(null)
  const [stepLabel, setStepLabel] = useState<string>('')
  const [progress, setProgress] = useState(0)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Poll for status while processing
  useEffect(() => {
    let pollInterval: NodeJS.Timeout | null = null

    const pollStatus = async () => {
      try {
        const response = await fetch(`/api/search-status/${resolvedParams.id}`)
        const data = await response.json()

        if (response.ok) {
          setSearchName(data.name || searchName)
          setSearchStatus(data.status)
          setProcessingStep(data.processing_step)
          setStepLabel(data.step_label || '')
          setProgress(data.progress || 0)
          setErrorMessage(data.error_message)

          if (data.status === 'completed') {
            if (pollInterval) clearInterval(pollInterval)
            loadMatches()
          } else if (data.status === 'error') {
            if (pollInterval) clearInterval(pollInterval)
            setLoading(false)
          }
        }
      } catch (error) {
        console.error('Error polling status:', error)
      }
    }

    pollStatus()
    pollInterval = setInterval(pollStatus, 2000)

    return () => {
      if (pollInterval) clearInterval(pollInterval)
    }
  }, [resolvedParams.id])

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

    if (data) {
      const sorted = data.sort((a: Match, b: Match) => a.rank - b.rank)
      setMatches(sorted)
    }
    setLoading(false)
  }

  // Helper to check date filter
  const matchesDateFilter = (postedDate: string | null): boolean => {
    if (dateFilter === 'all') return true
    if (!postedDate) return dateFilter === 'older' // No date = treat as old

    const date = new Date(postedDate)
    const now = new Date()
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))

    switch (dateFilter) {
      case 'week': return diffDays <= 7
      case '2weeks': return diffDays <= 14
      case 'month': return diffDays <= 30
      case 'older': return diffDays > 30
      default: return true
    }
  }

  // Filter matches
  const filteredMatches = matches.filter(match => {
    // Date filter
    if (!matchesDateFilter(match.posted_date)) return false

    // Category filter
    if (filter === 'top10') return match.rank <= 10
    if (filter === 'others') return match.rank > 10
    if (filter === 'favorites') return match.is_favorite
    if (filter === 'adzuna') return match.source_engine === 'adzuna'
    if (filter === 'indeed') return match.source_engine === 'indeed'
    if (filter === 'ats') return match.source_engine === 'ats_direct'
    return true
  })

  // Sort matches
  const sortedMatches = [...filteredMatches].sort((a, b) => {
    let comparison = 0
    switch (sortField) {
      case 'score':
        comparison = a.score - b.score
        break
      case 'rank':
        comparison = a.rank - b.rank
        break
      case 'company_name':
        comparison = a.company_name.localeCompare(b.company_name)
        break
      case 'posted_date':
        comparison = new Date(a.posted_date || 0).getTime() - new Date(b.posted_date || 0).getTime()
        break
      case 'job_title':
        comparison = a.job_title.localeCompare(b.job_title)
        break
    }
    return sortOrder === 'asc' ? comparison : -comparison
  })

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortOrder(field === 'score' ? 'desc' : 'asc')
    }
  }

  const openPanel = async (match: Match) => {
    setSelectedMatch(match)
    setEnrichedContacts(match.matching_details?.enriched_contacts || [])
    setContactsError(null)
    setContactsSearched(false)
    setDescriptionExpanded(false)

    if (!match.viewed_at) {
      const now = new Date().toISOString()
      const { error } = await supabase
        .from('matches')
        .update({ viewed_at: now })
        .eq('id', match.id)

      if (!error) {
        setMatches(prev => prev.map(m =>
          m.id === match.id ? { ...m, viewed_at: now } : m
        ))
        setSelectedMatch({ ...match, viewed_at: now })
      }
    }
  }

  const closePanel = () => {
    setSelectedMatch(null)
  }

  const handleStatusChange = async (newStatus: string) => {
    if (!selectedMatch) return

    const { error } = await supabase
      .from('matches')
      .update({ status: newStatus })
      .eq('id', selectedMatch.id)

    if (!error) {
      setSelectedMatch({ ...selectedMatch, status: newStatus })
      setMatches(matches.map(m =>
        m.id === selectedMatch.id ? { ...m, status: newStatus } : m
      ))
    }
  }

  const handleFavoriteToggle = async (match?: Match) => {
    const targetMatch = match || selectedMatch
    if (!targetMatch) return

    const { error } = await supabase
      .from('matches')
      .update({ is_favorite: !targetMatch.is_favorite })
      .eq('id', targetMatch.id)

    if (!error) {
      if (selectedMatch && selectedMatch.id === targetMatch.id) {
        setSelectedMatch({ ...selectedMatch, is_favorite: !targetMatch.is_favorite })
      }
      setMatches(matches.map(m =>
        m.id === targetMatch.id ? { ...m, is_favorite: !targetMatch.is_favorite } : m
      ))
    }
  }

  const enrichContacts = async (companyName: string, matchId: string, jobDescription?: string) => {
    console.log('[enrichContacts] Starting for:', companyName, matchId)
    setContactsLoading(true)
    setContactsError(null)
    setEnrichedContacts([])
    setContactsSearched(false)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      console.log('[enrichContacts] Session:', session ? 'found' : 'NOT FOUND')
      if (!session) {
        setContactsError('Vous devez être connecté')
        setContactsLoading(false)
        return
      }

      console.log('[enrichContacts] Calling API...')
      const response = await fetch('/api/enrich-contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_name: companyName,
          match_id: matchId,
          user_id: session.user.id,
          job_description: jobDescription  // Pass job description to extract recruiter names
        })
      })

      console.log('[enrichContacts] API response status:', response.status)
      const data = await response.json()
      console.log('[enrichContacts] API response data:', data)

      if (!response.ok) {
        throw new Error(data.error || 'Erreur lors de la récupération des contacts')
      }

      setEnrichedContacts(data.contacts || [])
      setContactsSearched(true)

      if (selectedMatch && data.contacts?.length > 0) {
        const updatedMatch = {
          ...selectedMatch,
          matching_details: {
            ...selectedMatch.matching_details,
            enriched_contacts: data.contacts
          }
        }
        setSelectedMatch(updatedMatch)
        setMatches(prev => prev.map(m => m.id === matchId ? updatedMatch : m))
      }
    } catch (error) {
      console.error('Error enriching contacts:', error)
      setContactsError(error instanceof Error ? error.message : 'Erreur inconnue')
    } finally {
      setContactsLoading(false)
    }
  }

  // Show processing state
  if (loading && searchStatus === 'processing') {
    return (
      <AppLayout>
        <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-50 via-indigo-50/30 to-purple-50/20">
          <div className="fixed inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-br from-indigo-200/20 to-purple-200/20 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-gradient-to-tr from-blue-200/20 to-cyan-200/20 rounded-full blur-3xl" />
          </div>

          <Card className="max-w-md w-full p-8 bg-white/80 backdrop-blur-xl border border-white/50 shadow-xl relative">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-xl shadow-indigo-500/30 animate-pulse">
                <span className="text-white font-bold text-2xl">P</span>
              </div>
              <h2 className="text-xl font-bold mb-2 text-gray-900">
                {searchName || 'Recherche en cours...'}
              </h2>
              <p className="text-sm mb-6 text-gray-500">
                {stepLabel || 'Initialisation...'}
              </p>

              <div className="w-full bg-gray-100 rounded-full h-3 mb-4 overflow-hidden">
                <div
                  className="h-3 rounded-full transition-all duration-500 bg-gradient-to-r from-indigo-500 to-purple-600"
                  style={{ width: `${progress}%` }}
                />
              </div>

              <p className="text-xs text-gray-400 mb-8">{progress}%</p>

              <div className="space-y-4 text-left">
                <StepItem label="Analyse des critères" done={progress > 10} active={processingStep === 'parsing'} />
                <StepItem label="Recherche LinkedIn, Indeed, Glassdoor, WTTJ" done={progress > 50} active={processingStep === 'scraping'} />
                <StepItem label="Filtrage et déduplication" done={progress > 70} active={processingStep === 'filtering'} />
                <StepItem label="Scoring IA des meilleurs matchs" done={progress > 85} active={processingStep === 'scoring'} />
                <StepItem label="Sauvegarde des résultats" done={progress >= 100} active={processingStep === 'saving'} />
              </div>
            </div>
          </Card>
        </div>
      </AppLayout>
    )
  }

  // Show error state
  if (searchStatus === 'error') {
    return (
      <AppLayout>
        <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-50 via-indigo-50/30 to-purple-50/20">
          <Card className="max-w-md w-full p-8 text-center bg-white/80 backdrop-blur-xl border border-white/50 shadow-xl">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center shadow-xl shadow-red-500/30">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold mb-2 text-gray-900">
              Erreur lors de la recherche
            </h2>
            <p className="text-sm mb-6 text-red-500">
              {errorMessage || 'Une erreur est survenue'}
            </p>
            <Button
              onClick={() => router.push('/new-search')}
              className="h-12 px-6 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-lg shadow-indigo-500/30"
            >
              Nouvelle recherche
            </Button>
          </Card>
        </div>
      </AppLayout>
    )
  }

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

  const isAdzuna = selectedMatch?.source_engine === 'adzuna'

  return (
    <AppLayout>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-purple-50/20">
        {/* Background decorations */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-br from-indigo-200/20 to-purple-200/20 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-gradient-to-tr from-blue-200/20 to-cyan-200/20 rounded-full blur-3xl" />
        </div>

        <div className={`transition-all duration-300 ${selectedMatch ? 'mr-[480px]' : ''}`}>
          <div className="p-4 md:p-8">
            <div className="max-w-full mx-auto relative">
              {/* Header */}
              <div className="mb-6">
                <Button
                  variant="outline"
                  onClick={() => router.push('/searches')}
                  className="mb-4 rounded-xl hover:bg-white/80"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Retour aux recherches
                </Button>

                <div className="flex items-center gap-4 mb-2">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-gray-900">{searchName}</h1>
                    <p className="text-gray-500">{matches.length} opportunités trouvées</p>
                  </div>
                </div>

                {/* Filters */}
                <div className="flex gap-2 mt-4 flex-wrap items-center">
                  {[
                    { key: 'all', label: 'Tous', count: matches.length, color: 'from-indigo-500 to-purple-600' },
                    { key: 'top10', label: 'TOP 10', count: matches.filter(m => m.rank <= 10).length, color: 'from-indigo-500 to-purple-600' },
                    { key: 'others', label: 'Autres', count: matches.filter(m => m.rank > 10).length, color: 'from-indigo-500 to-purple-600' },
                    { key: 'favorites', label: '⭐ Favoris', count: matches.filter(m => m.is_favorite).length, color: 'from-amber-500 to-orange-500' },
                  ].map(f => (
                    <button
                      key={f.key}
                      onClick={() => setFilter(f.key)}
                      className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 ${
                        filter === f.key
                          ? `bg-gradient-to-r ${f.color} text-white shadow-lg`
                          : 'bg-white/80 text-gray-700 hover:bg-white hover:shadow-md'
                      }`}
                    >
                      {f.label} ({f.count})
                    </button>
                  ))}

                  {/* Date Filter Dropdown */}
                  <div className="ml-2 border-l border-gray-200 pl-4">
                    <Select value={dateFilter} onValueChange={(v) => setDateFilter(v as DateFilter)}>
                      <SelectTrigger className="w-[160px] rounded-xl bg-white/80 border-0 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-2">
                          <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <SelectValue placeholder="Date" />
                        </div>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Toutes dates</SelectItem>
                        <SelectItem value="week">- 1 semaine</SelectItem>
                        <SelectItem value="2weeks">- 2 semaines</SelectItem>
                        <SelectItem value="month">- 1 mois</SelectItem>
                        <SelectItem value="older">+ 1 mois</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Source filters */}
                  {matches.some(m => m.source_engine === 'ats_direct') && (
                    <button
                      onClick={() => setFilter('ats')}
                      className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 ${
                        filter === 'ats'
                          ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg'
                          : 'bg-white/80 text-gray-700 hover:bg-white hover:shadow-md'
                      }`}
                    >
                      Offres directes ({matches.filter(m => m.source_engine === 'ats_direct').length})
                    </button>
                  )}
                  {matches.some(m => m.source_engine === 'indeed') && (
                    <button
                      onClick={() => setFilter('indeed')}
                      className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 ${
                        filter === 'indeed'
                          ? 'bg-gradient-to-r from-violet-500 to-purple-500 text-white shadow-lg'
                          : 'bg-white/80 text-gray-700 hover:bg-white hover:shadow-md'
                      }`}
                    >
                      Indeed ({matches.filter(m => m.source_engine === 'indeed').length})
                    </button>
                  )}
                  {matches.some(m => m.source_engine === 'adzuna') && (
                    <button
                      onClick={() => setFilter('adzuna')}
                      className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 ${
                        filter === 'adzuna'
                          ? 'bg-gradient-to-r from-gray-600 to-gray-700 text-white shadow-lg'
                          : 'bg-white/80 text-gray-700 hover:bg-white hover:shadow-md'
                      }`}
                    >
                      Autres ({matches.filter(m => m.source_engine === 'adzuna').length})
                    </button>
                  )}
                </div>
              </div>

              {/* Table */}
              <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl border border-white/50 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left p-4 w-12"></th>
                        <th
                          className="text-left p-4 font-semibold text-gray-600 cursor-pointer hover:text-indigo-600 transition-colors"
                          onClick={() => handleSort('score')}
                        >
                          <div className="flex items-center gap-1">
                            Match
                            {sortField === 'score' && (
                              <svg className={`w-4 h-4 transition-transform ${sortOrder === 'desc' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                              </svg>
                            )}
                          </div>
                        </th>
                        <th
                          className="text-left p-4 font-semibold text-gray-600 cursor-pointer hover:text-indigo-600 transition-colors"
                          onClick={() => handleSort('job_title')}
                        >
                          <div className="flex items-center gap-1">
                            Poste
                            {sortField === 'job_title' && (
                              <svg className={`w-4 h-4 transition-transform ${sortOrder === 'desc' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                              </svg>
                            )}
                          </div>
                        </th>
                        <th
                          className="text-left p-4 font-semibold text-gray-600 cursor-pointer hover:text-indigo-600 transition-colors"
                          onClick={() => handleSort('company_name')}
                        >
                          <div className="flex items-center gap-1">
                            Entreprise
                            {sortField === 'company_name' && (
                              <svg className={`w-4 h-4 transition-transform ${sortOrder === 'desc' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                              </svg>
                            )}
                          </div>
                        </th>
                        <th className="text-left p-4 font-semibold text-gray-600">Lieu</th>
                        <th className="text-left p-4 font-semibold text-gray-600">Contrat</th>
                        <th className="text-left p-4 font-semibold text-gray-600">Remote</th>
                        <th className="text-left p-4 font-semibold text-gray-600">Salaire</th>
                        <th
                          className="text-left p-4 font-semibold text-gray-600 cursor-pointer hover:text-indigo-600 transition-colors"
                          onClick={() => handleSort('posted_date')}
                        >
                          <div className="flex items-center gap-1">
                            Date
                            {sortField === 'posted_date' && (
                              <svg className={`w-4 h-4 transition-transform ${sortOrder === 'desc' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                              </svg>
                            )}
                          </div>
                        </th>
                        <th className="text-left p-4 font-semibold text-gray-600">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedMatches.map((match, index) => {
                        const isSelected = selectedMatch?.id === match.id
                        const isTop10 = match.rank <= 10
                        const salary = formatSalary(match.matching_details?.salary_min, match.matching_details?.salary_max)

                        return (
                          <tr
                            key={match.id}
                            onClick={() => openPanel(match)}
                            className={`border-b border-gray-50 cursor-pointer transition-all duration-200 ${
                              isSelected
                                ? 'bg-indigo-50/80'
                                : index % 2 === 0
                                  ? 'bg-white/50 hover:bg-indigo-50/50'
                                  : 'bg-gray-50/30 hover:bg-indigo-50/50'
                            }`}
                          >
                            {/* Rank / Top badge */}
                            <td className="p-4">
                              {isTop10 ? (
                                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold shadow-lg shadow-indigo-500/30">
                                  {match.rank}
                                </div>
                              ) : (
                                <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 text-xs">
                                  {match.rank}
                                </div>
                              )}
                            </td>

                            {/* Match Strength */}
                            <td className="p-4">
                              <MatchDots score={match.score} />
                            </td>

                            {/* Job title */}
                            <td className="p-4">
                              <div className="font-medium text-gray-900 max-w-[250px] truncate" title={match.job_title}>
                                {match.job_title}
                              </div>
                            </td>

                            {/* Company */}
                            <td className="p-4">
                              <div className="text-gray-700 max-w-[150px] truncate" title={match.company_name}>
                                {match.company_name}
                              </div>
                            </td>

                            {/* Location */}
                            <td className="p-4">
                              <div className="text-gray-500 text-sm max-w-[120px] truncate" title={match.location}>
                                {match.location || '-'}
                              </div>
                            </td>

                            {/* Contract */}
                            <td className="p-4">
                              <span className="px-2 py-1 rounded-lg text-xs font-medium bg-gray-100 text-gray-600">
                                {formatContractType(match.matching_details?.contract_type)}
                              </span>
                            </td>

                            {/* Remote */}
                            <td className="p-4">
                              <span className={`px-2 py-1 rounded-lg text-xs font-medium ${
                                match.matching_details?.remote_type === 'remote'
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : match.matching_details?.remote_type === 'hybrid'
                                    ? 'bg-blue-100 text-blue-700'
                                    : 'bg-gray-100 text-gray-600'
                              }`}>
                                {formatRemoteType(match.matching_details?.remote_type)}
                              </span>
                            </td>

                            {/* Salary */}
                            <td className="p-4">
                              <span className="text-sm text-gray-600">
                                {salary || '-'}
                              </span>
                            </td>

                            {/* Date */}
                            <td className="p-4">
                              <span className="text-sm text-gray-500">
                                {formatRelativeDate(match.posted_date)}
                              </span>
                            </td>

                            {/* Actions */}
                            <td className="p-4">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleFavoriteToggle(match)
                                  }}
                                  className={`p-2 rounded-lg transition-all duration-200 ${
                                    match.is_favorite
                                      ? 'bg-amber-100 text-amber-600 hover:bg-amber-200'
                                      : 'bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-amber-500'
                                  }`}
                                  title={match.is_favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                                >
                                  <svg className="w-4 h-4" fill={match.is_favorite ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                                  </svg>
                                </button>
                                <a
                                  href={`/api/redirect/${match.id}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="p-2 rounded-lg bg-gray-100 text-gray-500 hover:bg-indigo-100 hover:text-indigo-600 transition-all duration-200"
                                  title="Voir l'offre"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                  </svg>
                                </a>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Empty state */}
                {sortedMatches.length === 0 && (
                  <div className="text-center py-16">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                      <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <p className="text-gray-500">Aucun résultat pour ce filtre</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Side Panel */}
        {selectedMatch && (
          <>
            {/* Backdrop for mobile */}
            <div
              className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 lg:hidden"
              onClick={closePanel}
            />

            {/* Panel */}
            <div className="fixed top-0 right-0 w-full lg:w-[480px] h-full bg-white/95 backdrop-blur-xl shadow-2xl z-50 overflow-hidden flex flex-col animate-in slide-in-from-right duration-300">
              {/* Panel Header */}
              <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gradient-to-r from-indigo-500/5 to-purple-500/5">
                <div className="flex items-center gap-2">
                  {selectedMatch.rank <= 10 && (
                    <div className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-sm font-semibold shadow-lg shadow-indigo-500/30">
                      TOP {selectedMatch.rank}
                    </div>
                  )}
                  {selectedMatch.score > 0 && (
                    <div className="px-3 py-1.5 rounded-lg bg-gray-50">
                      <MatchDots score={selectedMatch.score} showLabel={true} />
                    </div>
                  )}
                </div>
                <button
                  onClick={closePanel}
                  className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
                >
                  <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Panel Content - Scrollable */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Title + Company */}
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-1">
                    {selectedMatch.job_title}
                  </h2>
                  <p className="text-lg text-gray-600">
                    @ {selectedMatch.company_name}
                  </p>
                </div>

                {/* Key Info */}
                <div className="flex flex-wrap gap-3">
                  <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 text-sm">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    </svg>
                    {selectedMatch.location || 'Non spécifié'}
                  </span>
                  <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 text-sm">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    {formatContractType(selectedMatch.matching_details?.contract_type)}
                  </span>
                  {selectedMatch.matching_details?.remote_type && (
                    <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm ${
                      selectedMatch.matching_details.remote_type === 'remote'
                        ? 'bg-emerald-100 text-emerald-700'
                        : selectedMatch.matching_details.remote_type === 'hybrid'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-gray-100 text-gray-600'
                    }`}>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                      </svg>
                      {formatRemoteType(selectedMatch.matching_details.remote_type)}
                    </span>
                  )}
                  {formatSalary(selectedMatch.matching_details?.salary_min, selectedMatch.matching_details?.salary_max) && (
                    <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-100 text-emerald-700 text-sm font-medium">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {formatSalary(selectedMatch.matching_details?.salary_min, selectedMatch.matching_details?.salary_max)}
                    </span>
                  )}
                  {selectedMatch.posted_date && (
                    <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 text-sm">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {formatRelativeDate(selectedMatch.posted_date)}
                    </span>
                  )}
                </div>

                {/* Tech Stack - if available */}
                {selectedMatch.matching_details?.tech_stack && selectedMatch.matching_details.tech_stack.length > 0 && (
                  <div className="p-4 rounded-xl bg-gradient-to-r from-violet-50 to-purple-50 border border-violet-200/50">
                    <h3 className="font-semibold text-violet-900 mb-3 flex items-center gap-2">
                      <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/30">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                        </svg>
                      </span>
                      Stack technique
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {selectedMatch.matching_details.tech_stack.map((tech, idx) => (
                        <span key={idx} className="px-3 py-1 rounded-lg bg-white text-violet-700 text-sm font-medium shadow-sm">
                          {tech}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* AI Analysis */}
                {selectedMatch.justification && (
                  <div className="p-4 rounded-xl bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200/50">
                    <h3 className="font-semibold text-indigo-900 mb-2 flex items-center gap-2">
                      <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                      </span>
                      Analyse IA
                    </h3>
                    <p className="text-gray-700 leading-relaxed">
                      {selectedMatch.justification}
                    </p>
                  </div>
                )}

                {/* Full Description - Collapsible */}
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <button
                    onClick={() => setDescriptionExpanded(!descriptionExpanded)}
                    className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                  >
                    <span className="font-semibold text-gray-700 flex items-center gap-2">
                      <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Fiche de poste complète
                    </span>
                    <svg className={`w-5 h-5 text-gray-400 transition-transform ${descriptionExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {descriptionExpanded && (
                    <div className="px-4 pb-4 border-t border-gray-100">
                      <div
                        className="text-sm text-gray-600 leading-relaxed mt-4 whitespace-pre-wrap prose prose-sm"
                        dangerouslySetInnerHTML={{
                          __html: selectedMatch.matching_details?.full_description || 'Pas de description disponible'
                        }}
                      />
                      <div className="mt-4 pt-4 border-t border-gray-100">
                        <a
                          href={`/api/redirect/${selectedMatch.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                          Voir l'offre sur le site
                        </a>
                      </div>
                    </div>
                  )}
                </div>

                {/* Contacts Section */}
                <div className="border border-gray-200 rounded-xl p-4">
                  <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    Contacts
                  </h3>

                  {enrichedContacts.length === 0 ? (
                    <Button
                      onClick={() => enrichContacts(selectedMatch.company_name, selectedMatch.id, selectedMatch.matching_details?.full_description)}
                      disabled={contactsLoading}
                      variant="outline"
                      className="w-full rounded-xl"
                    >
                      {contactsLoading ? (
                        <>
                          <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mr-2" />
                          Recherche en cours...
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                          </svg>
                          Rechercher les contacts de {selectedMatch.company_name}
                        </>
                      )}
                    </Button>
                  ) : (
                    <div className="space-y-3">
                      {enrichedContacts.map((contact, idx) => (
                        <div key={idx} className="p-3 bg-gray-50 rounded-xl">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="font-medium text-gray-900">
                                {contact.full_name || `${contact.first_name} ${contact.last_name}`}
                              </p>
                              <p className="text-sm text-gray-500">{contact.job_title}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              {contact.email && (
                                <a
                                  href={`mailto:${contact.email}`}
                                  className="p-2 rounded-lg bg-white hover:bg-indigo-50 text-indigo-600 transition-colors"
                                  title={contact.email}
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                  </svg>
                                </a>
                              )}
                              {contact.linkedin_url && (
                                <a
                                  href={contact.linkedin_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-2 rounded-lg bg-white hover:bg-blue-50 text-blue-600 transition-colors"
                                  title="LinkedIn"
                                >
                                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                                  </svg>
                                </a>
                              )}
                            </div>
                          </div>
                          {contact.email && (
                            <p className="text-xs text-gray-400 mt-2">{contact.email}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {contactsError && (
                    <p className="text-sm text-red-500 mt-2">{contactsError}</p>
                  )}
                </div>

                {/* Status + Favorite */}
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Statut
                    </label>
                    <Select value={selectedMatch.status} onValueChange={handleStatusChange}>
                      <SelectTrigger className="w-full rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="nouveau">Nouveau</SelectItem>
                        <SelectItem value="a_contacter">À contacter</SelectItem>
                        <SelectItem value="postule">Postulé</SelectItem>
                        <SelectItem value="entretien">Entretien</SelectItem>
                        <SelectItem value="refuse">Refusé</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Button
                    variant={selectedMatch.is_favorite ? 'default' : 'outline'}
                    onClick={() => handleFavoriteToggle()}
                    className={`rounded-xl ${selectedMatch.is_favorite ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-lg shadow-amber-500/30' : ''}`}
                  >
                    <svg className="w-4 h-4 mr-2" fill={selectedMatch.is_favorite ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                    </svg>
                    {selectedMatch.is_favorite ? 'Favori' : 'Ajouter'}
                  </Button>
                </div>

                {/* Source */}
                <div className="flex items-center justify-between pt-4 border-t border-gray-100 text-sm text-gray-400">
                  <span>via {selectedMatch.source}</span>
                  {isAdzuna && (
                    <a
                      href="https://www.adzuna.fr"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-gray-300 hover:text-gray-400"
                    >
                      Jobs by Adzuna
                    </a>
                  )}
                </div>
              </div>

              {/* Panel Footer */}
              <div className="p-4 border-t border-gray-100 bg-gray-50/50">
                <Button
                  onClick={() => setIsModalOpen(true)}
                  variant="outline"
                  className="w-full h-12 rounded-xl border-2 border-indigo-200 hover:border-indigo-400 hover:bg-indigo-50 text-indigo-600 transition-all duration-300"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                  </svg>
                  Agrandir la page
                </Button>
              </div>
            </div>
          </>
        )}

        {/* Fullscreen Modal */}
        {isModalOpen && selectedMatch && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setIsModalOpen(false)}
            />

            {/* Modal Content */}
            <div className="relative w-full max-w-4xl max-h-[90vh] mx-4 bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col">
              {/* Modal Header */}
              <div className="flex items-center justify-between p-6 border-b border-gray-100 bg-gradient-to-r from-indigo-50 to-purple-50">
                <div className="flex items-center gap-4">
                  {selectedMatch.rank <= 10 && (
                    <span className="px-3 py-1 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-sm font-bold shadow-lg">
                      TOP {selectedMatch.rank}
                    </span>
                  )}
                  <div className="px-3 py-1.5 rounded-full bg-white/80">
                    <MatchDots score={selectedMatch.score} showLabel={true} />
                  </div>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 rounded-xl hover:bg-white/80 transition-colors"
                >
                  <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Modal Body - Scrollable */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Job Title & Company */}
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">{selectedMatch.job_title}</h2>
                  <p className="text-lg text-gray-600 mt-1">@ {selectedMatch.company_name}</p>
                </div>

                {/* Quick Info */}
                <div className="flex flex-wrap gap-3">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 text-sm">
                    <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {selectedMatch.location}
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-100 text-indigo-700 text-sm font-medium">
                    {selectedMatch.matching_details?.contract_type || 'CDI'}
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 text-sm">
                    {formatRemoteType(selectedMatch.matching_details?.remote_type)}
                  </span>
                  {formatSalary(selectedMatch.matching_details?.salary_min, selectedMatch.matching_details?.salary_max) && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-100 text-emerald-700 text-sm font-medium">
                      {formatSalary(selectedMatch.matching_details?.salary_min, selectedMatch.matching_details?.salary_max)}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 text-sm">
                    <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {formatRelativeDate(selectedMatch.posted_date)}
                  </span>
                </div>

                {/* AI Analysis */}
                {selectedMatch.justification && (
                  <div className="p-5 rounded-xl bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200/50">
                    <h3 className="font-semibold text-indigo-900 mb-3 flex items-center gap-2">
                      <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                      </span>
                      Analyse IA
                    </h3>
                    <p className="text-gray-700 leading-relaxed">{selectedMatch.justification}</p>
                  </div>
                )}

                {/* Full Job Description */}
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Fiche de poste complète
                  </h3>
                  <div
                    className="text-gray-600 leading-relaxed whitespace-pre-wrap prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{
                      __html: selectedMatch.matching_details?.full_description || 'Pas de description disponible'
                    }}
                  />
                  {/* Small link to view offer */}
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <a
                      href={`/api/redirect/${selectedMatch.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                      Voir l'offre sur le site original
                    </a>
                  </div>
                </div>

                {/* Contacts Section in Modal */}
                <div className="border border-gray-200 rounded-xl p-4">
                  <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    Contacts
                  </h3>

                  {enrichedContacts.length === 0 ? (
                    <Button
                      onClick={() => enrichContacts(selectedMatch.company_name, selectedMatch.id, selectedMatch.matching_details?.full_description)}
                      disabled={contactsLoading}
                      variant="outline"
                      className="w-full rounded-xl"
                    >
                      {contactsLoading ? (
                        <>
                          <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mr-2" />
                          Recherche en cours...
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                          </svg>
                          Rechercher les contacts de {selectedMatch.company_name}
                        </>
                      )}
                    </Button>
                  ) : (
                    <div className="space-y-3">
                      {enrichedContacts.map((contact, idx) => (
                        <div key={idx} className="p-3 bg-gray-50 rounded-xl">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="font-medium text-gray-900">
                                {contact.full_name || `${contact.first_name} ${contact.last_name}`}
                              </p>
                              <p className="text-sm text-gray-500">{contact.job_title}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              {contact.email && (
                                <a
                                  href={`mailto:${contact.email}`}
                                  className="p-2 rounded-lg bg-white hover:bg-indigo-50 text-indigo-600 transition-colors"
                                  title={contact.email}
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                  </svg>
                                </a>
                              )}
                              {contact.linkedin_url && (
                                <a
                                  href={contact.linkedin_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-2 rounded-lg bg-white hover:bg-blue-50 text-blue-600 transition-colors"
                                  title="LinkedIn"
                                >
                                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                                  </svg>
                                </a>
                              )}
                            </div>
                          </div>
                          {contact.email && (
                            <p className="text-xs text-gray-400 mt-2">{contact.email}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {contactsError && (
                    <p className="text-sm text-red-500 mt-2">{contactsError}</p>
                  )}
                </div>

                {/* Source */}
                <div className="flex items-center justify-between pt-4 border-t border-gray-200 text-sm text-gray-400">
                  <span>via {selectedMatch.source}</span>
                  {(selectedMatch.source_engine === 'adzuna' || selectedMatch.source === 'Offre directe') && (
                    <a
                      href="https://www.adzuna.fr"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-gray-300 hover:text-gray-400"
                    >
                      Jobs by Adzuna
                    </a>
                  )}
                </div>
              </div>

              {/* Modal Footer - Just close button */}
              <div className="p-4 border-t border-gray-100 bg-gray-50">
                <Button
                  onClick={() => setIsModalOpen(false)}
                  variant="outline"
                  className="w-full rounded-xl"
                >
                  Fermer
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  )
}
