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

// Processing step indicator component
function StepItem({ label, done, active }: { label: string; done: boolean; active: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium transition-all ${
          done
            ? 'bg-green-500 text-white'
            : active
            ? 'bg-indigo-500 text-white animate-pulse'
            : 'bg-gray-200 text-gray-400'
        }`}
      >
        {done ? '✓' : active ? '...' : '○'}
      </div>
      <span
        className={`text-sm ${
          done ? 'text-green-600' : active ? 'text-indigo-600 font-medium' : 'text-gray-400'
        }`}
      >
        {label}
      </span>
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
  const [isPanelOpen, setIsPanelOpen] = useState(false)
  const [filter, setFilter] = useState<'all' | 'top10' | 'others' | 'favorites' | 'linkedin' | 'adzuna' | 'indeed' | 'glassdoor' | 'wttj'>('all')
  const [enrichedContacts, setEnrichedContacts] = useState<EnrichedContact[]>([])
  const [contactsLoading, setContactsLoading] = useState(false)
  const [contactsError, setContactsError] = useState<string | null>(null)
  const [contactsSearched, setContactsSearched] = useState(false) // Track if we already searched

  // Processing state
  const [searchStatus, setSearchStatus] = useState<'processing' | 'completed' | 'error'>('processing')
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

          // If completed, stop polling and load matches
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

    // Initial check
    pollStatus()

    // Start polling
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
      // Sort by rank (TOP 10 first, then others)
      const sorted = data.sort((a: Match, b: Match) => a.rank - b.rank)
      setMatches(sorted)
    }
    setLoading(false)
  }

  const filteredMatches = matches.filter(match => {
    if (filter === 'top10') return match.rank <= 10
    if (filter === 'others') return match.rank > 10
    if (filter === 'favorites') return match.is_favorite
    if (filter === 'linkedin') return match.source === 'linkedin'
    if (filter === 'adzuna') return match.source === 'adzuna'
    if (filter === 'indeed') return match.source === 'indeed'
    if (filter === 'glassdoor') return match.source === 'glassdoor'
    if (filter === 'wttj') return match.source === 'wttj'
    return true
  })

  const openPanel = async (match: Match) => {
    setSelectedMatch(match)
    setIsPanelOpen(true)
    setEnrichedContacts([])  // Reset contacts when opening new panel
    setContactsError(null)
    setContactsSearched(false)

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
    setIsPanelOpen(false)
    setTimeout(() => setSelectedMatch(null), 300)
  }

  const updateStatus = async (newStatus: string) => {
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

  const toggleFavorite = async (e: React.MouseEvent, matchId: string, currentValue: boolean) => {
    e.stopPropagation()

    const { error } = await supabase
      .from('matches')
      .update({ is_favorite: !currentValue })
      .eq('id', matchId)

    if (!error) {
      setMatches(prev => prev.map(m =>
        m.id === matchId ? { ...m, is_favorite: !currentValue } : m
      ))
      if (selectedMatch?.id === matchId) {
        setSelectedMatch({ ...selectedMatch, is_favorite: !currentValue })
      }
    }
  }

  const extractSkills = (description: string): string[] => {
    const techKeywords = ['JavaScript', 'TypeScript', 'React', 'Vue', 'Angular', 'Node.js', 'Python', 'Java', 'PHP', 'Ruby', 'Go', 'Rust', 'C++', 'C#', 'SQL', 'PostgreSQL', 'MongoDB', 'Redis', 'Docker', 'Kubernetes', 'AWS', 'GCP', 'Azure', 'Git', 'CI/CD', 'GraphQL', 'REST', 'API', 'Agile', 'Scrum']
    const found: string[] = []
    techKeywords.forEach(keyword => {
      if (description.toLowerCase().includes(keyword.toLowerCase())) {
        found.push(keyword)
      }
    })
    return found.slice(0, 8)
  }

  const extractSeniority = (title: string, description: string): string => {
    const text = (title + ' ' + description).toLowerCase()
    if (text.includes('senior') || text.includes('lead') || text.includes('principal')) return 'Senior'
    if (text.includes('junior') || text.includes('débutant') || text.includes('entry')) return 'Junior'
    if (text.includes('confirmé') || text.includes('middle') || text.includes('intermédiaire')) return 'Confirmé'
    if (text.includes('expert') || text.includes('staff') || text.includes('architect')) return 'Expert'
    return 'Non spécifié'
  }

  const getCompanyWebsite = (jobUrl: string): string | null => {
    try {
      const url = new URL(jobUrl)
      if (url.hostname.includes('adzuna')) return null
      return `${url.protocol}//${url.hostname}`
    } catch {
      return null
    }
  }

  const enrichContacts = async (companyName: string, matchId: string) => {
    setContactsLoading(true)
    setContactsError(null)
    setEnrichedContacts([])
    setContactsSearched(false)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setContactsError('Vous devez être connecté')
        return
      }

      const response = await fetch('/api/enrich-contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_name: companyName,
          match_id: matchId,
          user_id: session.user.id
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erreur lors de la récupération des contacts')
      }

      setEnrichedContacts(data.contacts || [])
      setContactsSearched(true) // Mark that we searched

      // Update local match state with enriched contacts
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
        <div className="min-h-screen flex items-center justify-center p-4">
          <Card className="max-w-md w-full p-8">
            <div className="text-center">
              <h2 className="text-xl font-bold mb-2" style={{ color: '#1D3557' }}>
                {searchName || 'Recherche en cours...'}
              </h2>
              <p className="text-sm mb-6" style={{ color: '#457B9D' }}>
                {stepLabel || 'Initialisation...'}
              </p>

              {/* Progress bar */}
              <div className="w-full bg-gray-200 rounded-full h-3 mb-4">
                <div
                  className="h-3 rounded-full transition-all duration-500"
                  style={{ width: `${progress}%`, backgroundColor: '#6366F1' }}
                />
              </div>

              <p className="text-xs" style={{ color: '#9CA3AF' }}>{progress}%</p>

              {/* Processing steps indicator */}
              <div className="mt-8 space-y-3 text-left">
                <StepItem
                  label="Analyse des critères"
                  done={progress > 10}
                  active={processingStep === 'parsing'}
                />
                <StepItem
                  label="Recherche LinkedIn, Indeed, Glassdoor, WTTJ"
                  done={progress > 50}
                  active={processingStep === 'scraping'}
                />
                <StepItem
                  label="Filtrage et déduplication"
                  done={progress > 70}
                  active={processingStep === 'filtering'}
                />
                <StepItem
                  label="Scoring IA des meilleurs matchs"
                  done={progress > 85}
                  active={processingStep === 'scoring'}
                />
                <StepItem
                  label="Sauvegarde des résultats"
                  done={progress >= 100}
                  active={processingStep === 'saving'}
                />
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
        <div className="min-h-screen flex items-center justify-center p-4">
          <Card className="max-w-md w-full p-8 text-center">
            <div className="text-red-500 text-5xl mb-4">⚠️</div>
            <h2 className="text-xl font-bold mb-2" style={{ color: '#1D3557' }}>
              Erreur lors de la recherche
            </h2>
            <p className="text-sm mb-6" style={{ color: '#EF4444' }}>
              {errorMessage || 'Une erreur est survenue'}
            </p>
            <Button onClick={() => router.push('/new-search')}>
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
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: '#6366F1' }}></div>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="p-4 md:p-8">
        <div className="max-w-5xl mx-auto">
          <div className="mb-8">
            <Button variant="outline" onClick={() => router.push('/searches')} className="mb-4">
              ← Retour aux recherches
            </Button>
            <h1 className="text-2xl md:text-3xl font-bold" style={{ color: '#1D3557' }}>{searchName}</h1>
            <p className="mt-2" style={{ color: '#457B9D' }}>{matches.length} opportunités trouvées</p>

            {/* Filtres */}
            <div className="flex gap-2 mt-4 flex-wrap">
              <button
                onClick={() => setFilter('all')}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  filter === 'all' ? 'text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                style={filter === 'all' ? { backgroundColor: '#6366F1' } : {}}
              >
                Tous ({matches.length})
              </button>
              <button
                onClick={() => setFilter('top10')}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  filter === 'top10' ? 'text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                style={filter === 'top10' ? { backgroundColor: '#6366F1' } : {}}
              >
                TOP 10 ({matches.filter(m => m.rank <= 10).length})
              </button>
              <button
                onClick={() => setFilter('others')}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  filter === 'others' ? 'text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                style={filter === 'others' ? { backgroundColor: '#6366F1' } : {}}
              >
                Autres ({matches.filter(m => m.rank > 10).length})
              </button>
              <button
                onClick={() => setFilter('favorites')}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors flex items-center gap-1 ${
                  filter === 'favorites' ? 'text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                style={filter === 'favorites' ? { backgroundColor: '#FBBF24' } : {}}
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                Favoris ({matches.filter(m => m.is_favorite).length})
              </button>
              {matches.some(m => m.source === 'linkedin') && (
                <button
                  onClick={() => setFilter('linkedin')}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                    filter === 'linkedin' ? 'text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                  style={filter === 'linkedin' ? { backgroundColor: '#0A66C2' } : {}}
                >
                  LinkedIn ({matches.filter(m => m.source === 'linkedin').length})
                </button>
              )}
              {matches.some(m => m.source === 'adzuna') && (
                <button
                  onClick={() => setFilter('adzuna')}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                    filter === 'adzuna' ? 'text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                  style={filter === 'adzuna' ? { backgroundColor: '#FF6B35' } : {}}
                >
                  Adzuna ({matches.filter(m => m.source === 'adzuna').length})
                </button>
              )}
              {matches.some(m => m.source === 'indeed') && (
                <button
                  onClick={() => setFilter('indeed')}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                    filter === 'indeed' ? 'text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                  style={filter === 'indeed' ? { backgroundColor: '#6B5CE7' } : {}}
                >
                  Indeed ({matches.filter(m => m.source === 'indeed').length})
                </button>
              )}
              {matches.some(m => m.source === 'glassdoor') && (
                <button
                  onClick={() => setFilter('glassdoor')}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                    filter === 'glassdoor' ? 'text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                  style={filter === 'glassdoor' ? { backgroundColor: '#0CAA41' } : {}}
                >
                  Glassdoor ({matches.filter(m => m.source === 'glassdoor').length})
                </button>
              )}
              {matches.some(m => m.source === 'wttj') && (
                <button
                  onClick={() => setFilter('wttj')}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                    filter === 'wttj' ? 'text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                  style={filter === 'wttj' ? { backgroundColor: '#FFCD00', color: '#1D1D1D' } : {}}
                >
                  WTTJ ({matches.filter(m => m.source === 'wttj').length})
                </button>
              )}
            </div>
          </div>

          <div className="grid gap-4">
            {filteredMatches.map((match) => (
              <Card
                key={match.id}
                className="p-6 hover:shadow-xl transition-shadow cursor-pointer"
                onClick={() => openPanel(match)}
              >
                <div className="flex justify-between items-start">
                  <div className="flex items-start gap-3">
                    {/* Bouton favori */}
                    <button
                      onClick={(e) => toggleFavorite(e, match.id, match.is_favorite)}
                      className="mt-1 p-1 rounded hover:bg-gray-100 transition-colors"
                    >
                      <svg
                        className="w-5 h-5"
                        fill={match.is_favorite ? '#FBBF24' : 'none'}
                        stroke={match.is_favorite ? '#FBBF24' : '#9CA3AF'}
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                        />
                      </svg>
                    </button>
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2 md:gap-3 mb-2">
                        <h3 className="text-lg md:text-xl font-semibold" style={{ color: '#1D3557' }}>
                          {match.job_title}
                        </h3>
                        {match.rank <= 10 && (
                          <span className="px-2 py-1 rounded text-xs font-semibold" style={{ backgroundColor: '#86EFAC', color: '#166534' }}>
                            TOP 10
                          </span>
                        )}
                        {match.source && (
                          <span
                            className="px-2 py-1 rounded text-xs font-medium"
                            style={{
                              backgroundColor: match.source === 'linkedin' ? '#0A66C2' : match.source === 'indeed' ? '#6B5CE7' : match.source === 'glassdoor' ? '#0CAA41' : match.source === 'wttj' ? '#FFCD00' : '#FF6B35',
                              color: match.source === 'wttj' ? '#1D1D1D' : 'white'
                            }}
                          >
                            {match.source === 'linkedin' ? 'LinkedIn' : match.source === 'indeed' ? 'Indeed' : match.source === 'glassdoor' ? 'Glassdoor' : match.source === 'wttj' ? 'WTTJ' : 'Adzuna'}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2 md:gap-4 text-sm" style={{ color: '#457B9D' }}>
                        <span>🏢 {match.company_name}</span>
                        <span className="hidden md:inline">•</span>
                        <span>📍 {match.location}</span>
                        {match.posted_date && (
                          <>
                            <span className="hidden md:inline">•</span>
                            <span>📅 {new Date(match.posted_date).toLocaleDateString('fr-FR')}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <div className="flex items-center gap-2">
                      {match.viewed_at && (
                        <div className="flex items-center gap-1 px-2 py-1 rounded-full text-xs" style={{ backgroundColor: '#f3f4f6', color: '#6b7280' }}>
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                            <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                          </svg>
                          Vu
                        </div>
                      )}
                      <div className="px-3 py-1 rounded-full text-xs" style={{ backgroundColor: match.status === 'nouveau' ? '#dbeafe' : '#d1fae5', color: match.status === 'nouveau' ? '#1e40af' : '#065f46' }}>
                        {match.status === 'nouveau' ? 'Nouveau' : match.status}
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Sliding Panel */}
        <div
          className={`fixed top-0 right-0 h-full w-full max-w-lg bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out overflow-y-auto border-l border-gray-200 ${
            isPanelOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          {selectedMatch && (
            <div className="p-4 md:p-8">
              {/* Header avec bouton fermer et favori */}
              <div className="flex justify-between items-start mb-4">
                <button
                  onClick={closePanel}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => toggleFavorite(e, selectedMatch.id, selectedMatch.is_favorite)}
                    className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                  >
                    <svg
                      className="w-6 h-6"
                      fill={selectedMatch.is_favorite ? '#FBBF24' : 'none'}
                      stroke={selectedMatch.is_favorite ? '#FBBF24' : '#9CA3AF'}
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                      />
                    </svg>
                  </button>
                  {selectedMatch.rank <= 10 && (
                    <span className="px-3 py-1 rounded text-sm font-semibold" style={{ backgroundColor: '#86EFAC', color: '#166534' }}>
                      TOP 10
                    </span>
                  )}
                  {selectedMatch.source && (
                    <span
                      className="px-3 py-1 rounded text-sm font-medium"
                      style={{
                        backgroundColor: selectedMatch.source === 'linkedin' ? '#0A66C2' : selectedMatch.source === 'indeed' ? '#6B5CE7' : selectedMatch.source === 'glassdoor' ? '#0CAA41' : selectedMatch.source === 'wttj' ? '#FFCD00' : '#FF6B35',
                        color: selectedMatch.source === 'wttj' ? '#1D1D1D' : 'white'
                      }}
                    >
                      {selectedMatch.source === 'linkedin' ? 'LinkedIn' : selectedMatch.source === 'indeed' ? 'Indeed' : selectedMatch.source === 'glassdoor' ? 'Glassdoor' : selectedMatch.source === 'wttj' ? 'WTTJ' : 'Adzuna'}
                    </span>
                  )}
                </div>
              </div>

              {/* Indicateur vu avec date/heure */}
              {selectedMatch.viewed_at && (
                <div className="flex items-center gap-2 mb-4 text-xs" style={{ color: '#6b7280' }}>
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                    <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                  </svg>
                  <span>
                    Consulté le {new Date(selectedMatch.viewed_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })} à {new Date(selectedMatch.viewed_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              )}

              {/* Titre du poste */}
              <h2 className="text-2xl font-bold mb-4" style={{ color: '#1D3557' }}>
                {selectedMatch.job_title}
              </h2>

              {/* Infos principales */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 p-4 rounded-lg" style={{ backgroundColor: '#F8F9FA' }}>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#457B9D' }}>Entreprise</p>
                  <p className="font-medium" style={{ color: '#1D3557' }}>{selectedMatch.company_name}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#457B9D' }}>Localisation</p>
                  <p className="font-medium" style={{ color: '#1D3557' }}>{selectedMatch.location}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#457B9D' }}>Date de publication</p>
                  <p className="font-medium" style={{ color: '#1D3557' }}>
                    {selectedMatch.posted_date
                      ? new Date(selectedMatch.posted_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
                      : 'Non spécifiée'
                    }
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#457B9D' }}>Séniorité</p>
                  <p className="font-medium" style={{ color: '#1D3557' }}>
                    {extractSeniority(selectedMatch.job_title, selectedMatch.matching_details?.full_description || '')}
                  </p>
                </div>
                {selectedMatch.matching_details?.contract_type && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#457B9D' }}>Type de contrat</p>
                    <p className="font-medium" style={{ color: '#1D3557' }}>
                      {selectedMatch.matching_details.contract_type === 'permanent' ? 'CDI' : selectedMatch.matching_details.contract_type}
                    </p>
                  </div>
                )}
                {selectedMatch.matching_details?.salary_min && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#457B9D' }}>Salaire</p>
                    <p className="font-medium" style={{ color: '#1D3557' }}>
                      {selectedMatch.matching_details.salary_min.toLocaleString()}€ - {selectedMatch.matching_details.salary_max?.toLocaleString()}€
                    </p>
                  </div>
                )}
              </div>

              {/* Stacks / Technologies */}
              {selectedMatch.matching_details?.full_description && (
                <div className="mb-6">
                  <p className="text-sm font-semibold mb-2" style={{ color: '#1D3557' }}>Technologies demandées</p>
                  <div className="flex flex-wrap gap-2">
                    {extractSkills(selectedMatch.matching_details.full_description).map((skill, index) => (
                      <span
                        key={index}
                        className="px-3 py-1 rounded-full text-sm"
                        style={{ backgroundColor: '#E8F4F8', color: '#1D3557' }}
                      >
                        {skill}
                      </span>
                    ))}
                    {extractSkills(selectedMatch.matching_details.full_description).length === 0 && (
                      <span className="text-sm" style={{ color: '#457B9D' }}>Aucune technologie spécifiée</span>
                    )}
                  </div>
                </div>
              )}

              {/* Justification */}
              {selectedMatch.justification && (
                <div className="mb-6 p-4 rounded-lg" style={{ backgroundColor: '#F1FAEE' }}>
                  <h3 className="font-semibold mb-2" style={{ color: '#1D3557' }}>Analyse de correspondance</h3>
                  <p className="text-sm" style={{ color: '#457B9D' }}>{selectedMatch.justification}</p>
                </div>
              )}

              {/* Statut */}
              <div className="mb-6">
                <label className="block text-sm font-semibold mb-2" style={{ color: '#1D3557' }}>Statut</label>
                <Select value={selectedMatch.status} onValueChange={updateStatus}>
                  <SelectTrigger className="w-full">
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

              {/* Contacts - Only for TOP 10 */}
              {selectedMatch.rank <= 10 && (
                <div className="mb-6 p-4 rounded-lg border-2 border-dashed" style={{ borderColor: '#6366F1', backgroundColor: '#F8F7FF' }}>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold flex items-center gap-2" style={{ color: '#1D3557' }}>
                      <svg className="w-5 h-5" style={{ color: '#6366F1' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                      Décideurs chez {selectedMatch.company_name}
                    </h3>
                    {((selectedMatch.matching_details?.enriched_contacts?.length ?? 0) > 0 || enrichedContacts.length > 0) && (
                      <span className="px-2 py-1 rounded text-xs font-medium" style={{ backgroundColor: '#86EFAC', color: '#166534' }}>
                        {(selectedMatch.matching_details?.enriched_contacts || enrichedContacts).length} contact(s)
                      </span>
                    )}
                  </div>

                  {/* Show enriched contacts if available */}
                  {(selectedMatch.matching_details?.enriched_contacts || enrichedContacts).length > 0 ? (
                    <div className="space-y-3">
                      {(selectedMatch.matching_details?.enriched_contacts || enrichedContacts).slice(0, 5).map((contact, index) => (
                        <div key={index} className="bg-white p-3 rounded-lg shadow-sm">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="font-medium" style={{ color: '#1D3557' }}>{contact.full_name || 'Nom inconnu'}</p>
                              <p className="text-sm" style={{ color: '#457B9D' }}>{contact.job_title || 'Poste non spécifié'}</p>
                            </div>
                            {contact.linkedin_url && (
                              <a
                                href={contact.linkedin_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1 rounded hover:bg-gray-100"
                              >
                                <svg className="w-5 h-5" style={{ color: '#0A66C2' }} fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                                </svg>
                              </a>
                            )}
                          </div>
                          {(contact.email || contact.phone) && (
                            <div className="mt-2 pt-2 border-t border-gray-100 flex flex-wrap gap-3">
                              {contact.email && (
                                <a href={`mailto:${contact.email}`} className="flex items-center gap-1 text-sm hover:underline" style={{ color: '#6366F1' }}>
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                  </svg>
                                  {contact.email}
                                </a>
                              )}
                              {contact.phone && (
                                <a href={`tel:${contact.phone}`} className="flex items-center gap-1 text-sm hover:underline" style={{ color: '#6366F1' }}>
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                  </svg>
                                  {contact.phone}
                                </a>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <>
                      {contactsError && (
                        <p className="text-sm text-red-600 mb-3">{contactsError}</p>
                      )}

                      {/* Show "no contacts found" if we searched but found nothing */}
                      {contactsSearched && !contactsLoading && enrichedContacts.length === 0 ? (
                        <div className="text-center py-4">
                          <svg className="w-12 h-12 mx-auto mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                          </svg>
                          <p className="text-sm text-gray-500 mb-1">Aucun décideur trouvé</p>
                          <p className="text-xs text-gray-400">
                            Cette entreprise n'a pas de contacts publics dans notre base
                          </p>
                        </div>
                      ) : (
                        <Button
                          onClick={() => enrichContacts(selectedMatch.company_name, selectedMatch.id)}
                          disabled={contactsLoading}
                          className="w-full"
                          style={{ backgroundColor: '#6366F1', color: 'white' }}
                        >
                          {contactsLoading ? (
                            <>
                              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              Recherche des contacts...
                            </>
                          ) : (
                            <>
                              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                              </svg>
                              Débloquer les contacts
                            </>
                          )}
                        </Button>
                      )}
                      <p className="text-xs text-center mt-2" style={{ color: '#457B9D' }}>
                        Trouvez les emails et téléphones des décideurs
                      </p>
                    </>
                  )}
                </div>
              )}

              {/* Liens */}
              <div className="space-y-3">
                <Button
                  onClick={() => window.open(selectedMatch.job_url, '_blank')}
                  className="w-full"
                  style={{ backgroundColor: '#6366F1', color: 'white' }}
                >
                  Voir l'offre complète →
                </Button>

                {/* Only show recruiter button if URL is a valid LinkedIn profile */}
                {selectedMatch.matching_details?.recruiter_url &&
                 selectedMatch.matching_details.recruiter_url.includes('linkedin.com/in/') && (
                  <Button
                    onClick={() => window.open(selectedMatch.matching_details.recruiter_url!, '_blank')}
                    className="w-full"
                    style={{ backgroundColor: '#0A66C2', color: 'white' }}
                  >
                    <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                    </svg>
                    Contacter {selectedMatch.matching_details.recruiter_name || 'le recruteur'}
                  </Button>
                )}

                {getCompanyWebsite(selectedMatch.job_url) && (
                  <Button
                    variant="outline"
                    onClick={() => window.open(getCompanyWebsite(selectedMatch.job_url)!, '_blank')}
                    className="w-full"
                  >
                    🏢 Voir le site de {selectedMatch.company_name}
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  )
}
