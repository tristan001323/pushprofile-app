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
  }
}

export default function SearchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const router = useRouter()
  const [matches, setMatches] = useState<Match[]>([])
  const [searchName, setSearchName] = useState('')
  const [loading, setLoading] = useState(true)
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null)
  const [isPanelOpen, setIsPanelOpen] = useState(false)
  const [filter, setFilter] = useState<'all' | 'top10' | 'others' | 'favorites' | 'linkedin' | 'adzuna' | 'indeed'>('all')

  useEffect(() => {
    loadMatches()
  }, [])

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
      const sorted = data.sort((a: Match, b: Match) => b.score - a.score)
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
    return true
  })

  const openPanel = async (match: Match) => {
    setSelectedMatch(match)
    setIsPanelOpen(true)

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
                              backgroundColor: match.source === 'linkedin' ? '#0A66C2' : match.source === 'indeed' ? '#6B5CE7' : '#FF6B35',
                              color: 'white'
                            }}
                          >
                            {match.source === 'linkedin' ? 'LinkedIn' : match.source === 'indeed' ? 'Indeed' : 'Adzuna'}
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
                        backgroundColor: selectedMatch.source === 'linkedin' ? '#0A66C2' : selectedMatch.source === 'indeed' ? '#6B5CE7' : '#FF6B35',
                        color: 'white'
                      }}
                    >
                      {selectedMatch.source === 'linkedin' ? 'LinkedIn' : selectedMatch.source === 'indeed' ? 'Indeed' : 'Adzuna'}
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

              {/* Liens */}
              <div className="space-y-3">
                <Button
                  onClick={() => window.open(selectedMatch.job_url, '_blank')}
                  className="w-full"
                  style={{ backgroundColor: '#6366F1', color: 'white' }}
                >
                  Voir l'offre complète →
                </Button>

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
