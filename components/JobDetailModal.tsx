'use client'

import { useState, useEffect } from 'react'
import { X, Star, ChevronDown, ChevronUp, ExternalLink, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

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

type Match = {
  id: string
  job_title: string
  company_name: string
  location: string
  job_url: string
  score: number
  justification: string
  status: string
  rank: number
  posted_date: string
  is_favorite: boolean
  source: string
  source_engine?: 'adzuna' | 'indeed' | 'ats_direct' | null
  matching_details: {
    contract_type?: string
    remote_type?: string
    salary_min?: number
    salary_max?: number
    full_description?: string
    experience_level?: string
    enriched_contacts?: EnrichedContact[]
  }
}

interface JobDetailModalProps {
  match: Match
  isOpen: boolean
  onClose: () => void
  onStatusChange: (status: string) => void
  onFavoriteToggle: () => void
  onSearchContacts: () => void
  contactsLoading: boolean
  enrichedContacts: EnrichedContact[]
}

// Format relative date
function formatRelativeDate(dateStr: string | null): string {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return "Aujourd'hui"
  if (diffDays === 1) return 'Hier'
  if (diffDays < 7) return `Il y a ${diffDays} jours`
  if (diffDays < 30) return `Il y a ${Math.floor(diffDays / 7)} semaines`
  return `Il y a ${Math.floor(diffDays / 30)} mois`
}

// Get score style
function getScoreStyle(score: number): { bg: string; text: string; label: string } {
  if (score >= 90) return { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Excellent match' }
  if (score >= 75) return { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Bon match' }
  if (score >= 60) return { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Match partiel' }
  return { bg: 'bg-gray-100', text: 'text-gray-500', label: 'Faible correspondance' }
}

// Format salary
function formatSalary(min?: number | null, max?: number | null): string | null {
  if (!min && !max) return null
  if (min && max) return `${Math.round(min/1000)}K - ${Math.round(max/1000)}K €`
  if (min) return `À partir de ${Math.round(min/1000)}K €`
  if (max) return `Jusqu'à ${Math.round(max/1000)}K €`
  return null
}

// Format contract type
function formatContractType(type?: string): string {
  if (!type) return 'CDI'
  if (type === 'contract' || type === 'cdd') return 'CDD'
  if (type === 'internship') return 'Stage'
  if (type === 'freelance') return 'Freelance'
  return 'CDI'
}

export default function JobDetailModal({
  match,
  isOpen,
  onClose,
  onStatusChange,
  onFavoriteToggle,
  onSearchContacts,
  contactsLoading,
  enrichedContacts
}: JobDetailModalProps) {
  const [descriptionExpanded, setDescriptionExpanded] = useState(false)
  const scoreStyle = getScoreStyle(match.score)
  const salary = formatSalary(match.matching_details?.salary_min, match.matching_details?.salary_max)
  const isTop10 = match.rank <= 10
  const isAdzuna = match.source_engine === 'adzuna'

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-start justify-between p-6 border-b border-gray-100">
            <div className="flex items-center gap-3">
              {/* PP Badge for Top 10 */}
              {isTop10 && (
                <div className="flex items-center gap-1.5 bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-sm font-semibold">
                  <Star className="w-4 h-4 fill-current" />
                  <span>TOP {match.rank}</span>
                </div>
              )}

              {/* Score Badge */}
              {match.score > 0 && (
                <div className={`${scoreStyle.bg} ${scoreStyle.text} px-3 py-1.5 rounded-lg text-sm font-semibold`}>
                  {match.score}% · {scoreStyle.label}
                </div>
              )}
            </div>

            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* Content - Scrollable */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Title + Company */}
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-1">
                {match.job_title}
              </h2>
              <p className="text-lg text-gray-600">
                @ {match.company_name}
              </p>
            </div>

            {/* Key Info Row */}
            <div className="flex flex-wrap gap-4 text-sm text-gray-600">
              <span className="flex items-center gap-1.5">
                <span>📍</span> {match.location || 'Non spécifié'}
              </span>
              <span className="flex items-center gap-1.5">
                <span>💼</span> {formatContractType(match.matching_details?.contract_type)}
              </span>
              {salary && (
                <span className="flex items-center gap-1.5">
                  <span>💰</span> {salary}
                </span>
              )}
              {match.posted_date && (
                <span className="flex items-center gap-1.5">
                  <span>🕐</span> Publié {formatRelativeDate(match.posted_date)}
                </span>
              )}
              {match.matching_details?.remote_type === 'remote' && (
                <span className="flex items-center gap-1.5">
                  <span>🏠</span> Remote
                </span>
              )}
            </div>

            {/* AI Analysis - Always visible, prominent */}
            {match.justification && (
              <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
                <h3 className="font-semibold text-indigo-900 mb-2 flex items-center gap-2">
                  💡 Analyse de correspondance
                </h3>
                <p className="text-gray-700 leading-relaxed">
                  {match.justification}
                </p>
              </div>
            )}

            {/* Job Description - Collapsed by default */}
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <button
                onClick={() => setDescriptionExpanded(!descriptionExpanded)}
                className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
              >
                <span className="font-semibold text-gray-700 flex items-center gap-2">
                  📋 Voir la fiche de poste complète
                </span>
                {descriptionExpanded ? (
                  <ChevronUp className="w-5 h-5 text-gray-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-400" />
                )}
              </button>

              {descriptionExpanded && (
                <div className="px-4 pb-4 border-t border-gray-100">
                  <div
                    className="text-sm text-gray-600 leading-relaxed max-h-[400px] overflow-y-auto mt-4 whitespace-pre-wrap"
                    dangerouslySetInnerHTML={{
                      __html: match.matching_details?.full_description || 'Pas de description disponible'
                    }}
                  />

                  {/* Discreet link to external job */}
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <a
                      href={`/api/redirect/${match.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 underline"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Voir l'offre sur le site
                    </a>
                  </div>
                </div>
              )}
            </div>

            {/* Contacts Section */}
            <div className="border border-gray-200 rounded-xl p-4">
              <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                👥 Contacts
              </h3>

              {enrichedContacts.length === 0 ? (
                <Button
                  onClick={onSearchContacts}
                  disabled={contactsLoading}
                  variant="outline"
                  className="w-full"
                >
                  {contactsLoading ? (
                    <>
                      <span className="animate-spin mr-2">⏳</span>
                      Recherche en cours...
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4 mr-2" />
                      Rechercher les contacts de {match.company_name}
                    </>
                  )}
                </Button>
              ) : (
                <div className="space-y-3">
                  {enrichedContacts.map((contact, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
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
                            className="text-sm text-indigo-600 hover:underline"
                          >
                            {contact.email}
                          </a>
                        )}
                        {contact.linkedin_url && (
                          <a
                            href={contact.linkedin_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-700"
                          >
                            LinkedIn
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Status + Favorite */}
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  📌 Statut
                </label>
                <Select value={match.status} onValueChange={onStatusChange}>
                  <SelectTrigger className="w-full">
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
                variant={match.is_favorite ? 'default' : 'outline'}
                onClick={onFavoriteToggle}
                className={match.is_favorite ? 'bg-yellow-500 hover:bg-yellow-600' : ''}
              >
                ⭐ {match.is_favorite ? 'Favori' : 'Ajouter aux favoris'}
              </Button>
            </div>

            {/* Footer: Source + Adzuna Badge */}
            <div className="flex items-center justify-end gap-4 pt-4 border-t border-gray-100">
              <span className="text-xs text-gray-400">
                via {match.source}
              </span>

              {isAdzuna && (
                <a
                  href="https://www.adzuna.fr"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] text-gray-300 hover:text-gray-400"
                  style={{ minWidth: '116px', minHeight: '23px' }}
                >
                  Jobs by Adzuna
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
