'use client'

import { useState, useEffect, use } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import AppLayout from '@/components/AppLayout'
import JobCard from '@/components/JobCard'
import JobDetailModal from '@/components/JobDetailModal'

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
  source_engine?: 'adzuna' | 'indeed' | 'ats_direct' | null  // Internal tracking for compliance
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
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [filter, setFilter] = useState<string>('all')
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
    if (filter === 'adzuna') return match.source_engine === 'adzuna'
    if (filter === 'indeed') return match.source_engine === 'indeed'
    if (filter === 'ats') return match.source_engine === 'ats_direct'
    return true
  })

  const openModal = async (match: Match) => {
    setSelectedMatch(match)
    setIsModalOpen(true)
    setEnrichedContacts(match.matching_details?.enriched_contacts || [])
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

  const closeModal = () => {
    setIsModalOpen(false)
    setTimeout(() => setSelectedMatch(null), 200)
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

  const handleFavoriteToggle = async () => {
    if (!selectedMatch) return

    const { error } = await supabase
      .from('matches')
      .update({ is_favorite: !selectedMatch.is_favorite })
      .eq('id', selectedMatch.id)

    if (!error) {
      setSelectedMatch({ ...selectedMatch, is_favorite: !selectedMatch.is_favorite })
      setMatches(matches.map(m =>
        m.id === selectedMatch.id ? { ...m, is_favorite: !selectedMatch.is_favorite } : m
      ))
    }
  }

  const handleSearchContacts = async () => {
    if (!selectedMatch) return
    await enrichContacts(selectedMatch.company_name, selectedMatch.id)
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
        <div className="max-w-7xl mx-auto">
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
              {/* Filtres par source - basés sur source_engine */}
              {matches.some(m => m.source_engine === 'ats_direct') && (
                <button
                  onClick={() => setFilter('ats')}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                    filter === 'ats' ? 'text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                  style={filter === 'ats' ? { backgroundColor: '#10B981' } : {}}
                >
                  Offres directes ({matches.filter(m => m.source_engine === 'ats_direct').length})
                </button>
              )}
              {matches.some(m => m.source_engine === 'indeed') && (
                <button
                  onClick={() => setFilter('indeed')}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                    filter === 'indeed' ? 'text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                  style={filter === 'indeed' ? { backgroundColor: '#6B5CE7' } : {}}
                >
                  Indeed ({matches.filter(m => m.source_engine === 'indeed').length})
                </button>
              )}
              {matches.some(m => m.source_engine === 'adzuna') && (
                <button
                  onClick={() => setFilter('adzuna')}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                    filter === 'adzuna' ? 'text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                  style={filter === 'adzuna' ? { backgroundColor: '#6B7280' } : {}}
                >
                  Autres sources ({matches.filter(m => m.source_engine === 'adzuna').length})
                </button>
              )}
            </div>
          </div>

          {/* Grid de cards - 3 cols desktop, 2 tablet, 1 mobile */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredMatches.map((match) => (
              <JobCard
                key={match.id}
                match={match}
                onClick={() => openModal(match)}
              />
            ))}
          </div>

          {/* Empty state */}
          {filteredMatches.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500">Aucun résultat pour ce filtre</p>
            </div>
          )}
        </div>

        {/* Modal de détail */}
        {selectedMatch && (
          <JobDetailModal
            match={selectedMatch}
            isOpen={isModalOpen}
            onClose={closeModal}
            onStatusChange={handleStatusChange}
            onFavoriteToggle={handleFavoriteToggle}
            onSearchContacts={handleSearchContacts}
            contactsLoading={contactsLoading}
            enrichedContacts={enrichedContacts}
          />
        )}
      </div>
    </AppLayout>
  )
}
