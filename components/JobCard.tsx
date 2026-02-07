'use client'

import { Star } from 'lucide-react'

type Match = {
  id: string
  job_title: string
  company_name: string
  location: string
  score: number
  justification: string
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
  }
}

interface JobCardProps {
  match: Match
  onClick: () => void
}

// Format relative date
function formatRelativeDate(dateStr: string | null): string {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return "Aujourd'hui"
  if (diffDays === 1) return 'Hier'
  if (diffDays < 7) return `Il y a ${diffDays}j`
  if (diffDays < 30) return `Il y a ${Math.floor(diffDays / 7)} sem.`
  return `Il y a ${Math.floor(diffDays / 30)} mois`
}

// Get score color and label
function getScoreStyle(score: number): { bg: string; text: string; label: string } {
  if (score >= 90) return { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Excellent' }
  if (score >= 75) return { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Bon match' }
  if (score >= 60) return { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Partiel' }
  return { bg: 'bg-gray-100', text: 'text-gray-500', label: 'Faible' }
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
  if (type === 'contract' || type === 'cdd') return 'CDD'
  if (type === 'internship') return 'Stage'
  if (type === 'freelance') return 'Freelance'
  return 'CDI'
}

export default function JobCard({ match, onClick }: JobCardProps) {
  const scoreStyle = getScoreStyle(match.score)
  const salary = formatSalary(match.matching_details?.salary_min, match.matching_details?.salary_max)
  const isTop10 = match.rank <= 10
  const isAdzuna = match.source_engine === 'adzuna'

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-xl border border-gray-200 p-5 cursor-pointer transition-all duration-200 hover:shadow-lg hover:border-indigo-200 hover:-translate-y-0.5 relative"
    >
      {/* Header: PP Badge + Score */}
      <div className="flex items-start justify-between mb-3">
        {/* PP Badge for Top 10 */}
        {isTop10 && (
          <div className="flex items-center gap-1.5 bg-indigo-600 text-white px-2 py-1 rounded-lg text-xs font-semibold">
            <Star className="w-3 h-3 fill-current" />
            <span>TOP {match.rank}</span>
          </div>
        )}
        {!isTop10 && <div />}

        {/* Score Badge */}
        {match.score > 0 && (
          <div className={`${scoreStyle.bg} ${scoreStyle.text} px-2.5 py-1 rounded-lg text-sm font-semibold`}>
            {match.score}%
          </div>
        )}
      </div>

      {/* Title + Company */}
      <h3 className="font-semibold text-gray-900 text-base mb-1 line-clamp-2">
        {match.job_title}
      </h3>
      <p className="text-gray-600 text-sm mb-3">
        @ {match.company_name}
      </p>

      {/* Key Info */}
      <div className="flex flex-wrap gap-x-3 gap-y-1.5 text-xs text-gray-500 mb-3">
        <span className="flex items-center gap-1">
          <span>📍</span> {match.location || 'Non spécifié'}
        </span>
        <span className="flex items-center gap-1">
          <span>💼</span> {formatContractType(match.matching_details?.contract_type)}
        </span>
        {salary && (
          <span className="flex items-center gap-1">
            <span>💰</span> {salary}
          </span>
        )}
        {match.posted_date && (
          <span className="flex items-center gap-1">
            <span>🕐</span> {formatRelativeDate(match.posted_date)}
          </span>
        )}
      </div>

      {/* Justification (truncated) */}
      {match.justification && isTop10 && (
        <p className="text-xs text-gray-500 line-clamp-2 mb-3 italic">
          💡 "{match.justification}"
        </p>
      )}

      {/* Footer: Source + Adzuna Badge */}
      <div className="flex items-center justify-between mt-auto pt-2 border-t border-gray-100">
        {/* Favorite indicator */}
        {match.is_favorite && (
          <span className="text-yellow-500 text-sm">⭐</span>
        )}
        {!match.is_favorite && <div />}

        <div className="flex flex-col items-end gap-1">
          {/* Source micro text */}
          <span className="text-[10px] text-gray-400">
            via {match.source}
          </span>

          {/* Adzuna compliance badge - only if source_engine is adzuna */}
          {isAdzuna && (
            <a
              href="https://www.adzuna.fr"
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-[10px] text-gray-300 hover:text-gray-400"
              style={{ minWidth: '116px', minHeight: '23px' }}
            >
              Jobs by Adzuna
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
