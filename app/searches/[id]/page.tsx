'use client'

import { useState, useEffect, use } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

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
  const [filter, setFilter] = useState<'all' | 'top10' | 'others'>('all')

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
      // Trier par score décroissant
      const sorted = data.sort((a: Match, b: Match) => b.score - a.score)
      setMatches(sorted)
    }
    setLoading(false)
  }

  // Filtrer les matches selon le filtre sélectionné
  const filteredMatches = matches.filter(match => {
    if (filter === 'top10') return match.rank <= 10
    if (filter === 'others') return match.rank > 10
    return true
  })

  const openPanel = (match: Match) => {
    setSelectedMatch(match)
    setIsPanelOpen(true)
  }

  const closePanel = () => {
    setIsPanelOpen(false)
    setTimeout(() => setSelectedMatch(null), 300) // Clear after animation
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

  // Extraire les skills/stacks de la description
  const extractSkills = (description: string): string[] => {
    const techKeywords = ['JavaScript', 'TypeScript', 'React', 'Vue', 'Angular', 'Node.js', 'Python', 'Java', 'PHP', 'Ruby', 'Go', 'Rust', 'C++', 'C#', 'SQL', 'PostgreSQL', 'MongoDB', 'Redis', 'Docker', 'Kubernetes', 'AWS', 'GCP', 'Azure', 'Git', 'CI/CD', 'GraphQL', 'REST', 'API', 'Agile', 'Scrum']
    const found: string[] = []
    techKeywords.forEach(keyword => {
      if (description.toLowerCase().includes(keyword.toLowerCase())) {
        found.push(keyword)
      }
    })
    return found.slice(0, 8) // Max 8 skills
  }

  // Extraire la séniorité de la description ou du titre
  const extractSeniority = (title: string, description: string): string => {
    const text = (title + ' ' + description).toLowerCase()
    if (text.includes('senior') || text.includes('lead') || text.includes('principal')) return 'Senior'
    if (text.includes('junior') || text.includes('débutant') || text.includes('entry')) return 'Junior'
    if (text.includes('confirmé') || text.includes('middle') || text.includes('intermédiaire')) return 'Confirmé'
    if (text.includes('expert') || text.includes('staff') || text.includes('architect')) return 'Expert'
    return 'Non spécifié'
  }

  // Extraire le domaine du site entreprise depuis l'URL du job
  const getCompanyWebsite = (jobUrl: string): string | null => {
    try {
      const url = new URL(jobUrl)
      // Ignorer les URLs Adzuna
      if (url.hostname.includes('adzuna')) return null
      // Retourner juste le domaine principal
      return `${url.protocol}//${url.hostname}`
    } catch {
      return null
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#F8F9FA' }}>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: '#A8DADC' }}></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-8" style={{ backgroundColor: '#F8F9FA' }}>
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <Button variant="outline" onClick={() => router.push('/searches')} className="mb-4">
            ← Retour aux recherches
          </Button>
          <h1 className="text-3xl font-bold" style={{ color: '#1D3557' }}>{searchName}</h1>
          <p className="mt-2" style={{ color: '#457B9D' }}>{matches.length} opportunités trouvées</p>

          {/* Filtres */}
          <div className="flex gap-2 mt-4">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                filter === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Tous ({matches.length})
            </button>
            <button
              onClick={() => setFilter('top10')}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                filter === 'top10'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              TOP 10 ({matches.filter(m => m.rank <= 10).length})
            </button>
            <button
              onClick={() => setFilter('others')}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                filter === 'others'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Autres ({matches.filter(m => m.rank > 10).length})
            </button>
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
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-xl font-semibold" style={{ color: '#1D3557' }}>
                      {match.job_title}
                    </h3>
                    {match.rank <= 10 && (
                      <span className="px-2 py-1 rounded text-xs font-semibold" style={{ backgroundColor: '#86EFAC', color: '#166534' }}>
                        TOP 10
                      </span>
                    )}
                  </div>
                  <div className="flex gap-4 text-sm" style={{ color: '#457B9D' }}>
                    <span>🏢 {match.company_name}</span>
                    <span>•</span>
                    <span>📍 {match.location}</span>
                    {match.posted_date && (
                      <>
                        <span>•</span>
                        <span>📅 {new Date(match.posted_date).toLocaleDateString('fr-FR')}</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <div className="text-2xl font-bold" style={{ color: match.score >= 70 ? '#059669' : match.score >= 50 ? '#d97706' : '#6b7280' }}>
                    {match.score_display ? match.score_display.toFixed(1) : (match.score / 10).toFixed(1)}/10
                  </div>
                  <div className="px-3 py-1 rounded-full text-xs" style={{ backgroundColor: match.status === 'nouveau' ? '#dbeafe' : '#d1fae5', color: match.status === 'nouveau' ? '#1e40af' : '#065f46' }}>
                    {match.status === 'nouveau' ? 'Nouveau' : match.status}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Sliding Panel - sans overlay sombre */}
      <div
        className={`fixed top-0 right-0 h-full w-full max-w-lg bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out overflow-y-auto border-l border-gray-200 ${
          isPanelOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {selectedMatch && (
          <div className="p-8">
            {/* Header avec bouton fermer */}
            <div className="flex justify-between items-start mb-6">
              <button
                onClick={closePanel}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <div className="text-right">
                <div className="text-3xl font-bold" style={{ color: selectedMatch.score >= 70 ? '#059669' : selectedMatch.score >= 50 ? '#d97706' : '#6b7280' }}>
                  {selectedMatch.score_display ? selectedMatch.score_display.toFixed(1) : (selectedMatch.score / 10).toFixed(1)}/10
                </div>
                {selectedMatch.rank <= 10 && (
                  <span className="px-3 py-1 rounded text-sm font-semibold" style={{ backgroundColor: '#86EFAC', color: '#166534' }}>
                    TOP 10
                  </span>
                )}
              </div>
            </div>

            {/* Titre du poste */}
            <h2 className="text-2xl font-bold mb-4" style={{ color: '#1D3557' }}>
              {selectedMatch.job_title}
            </h2>

            {/* Infos principales */}
            <div className="grid grid-cols-2 gap-4 mb-6 p-4 rounded-lg" style={{ backgroundColor: '#F8F9FA' }}>
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

            {/* Justification IA */}
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
                style={{ backgroundColor: '#E63946', color: 'white' }}
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

              {/* Avertissement si URL Adzuna */}
              {selectedMatch.job_url.includes('adzuna') && (
                <p className="text-xs text-center" style={{ color: '#d97706' }}>
                  ⚠️ Lien via Adzuna - Lance une nouvelle recherche pour obtenir les liens directs
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
