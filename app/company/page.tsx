'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import AppLayout from '@/components/AppLayout'

type CompanyProfile = {
  id: string
  slug: string
  name: string
  wttj_url: string | null
  linkedin_url: string | null
  website: string | null
  logo?: string | null
  description: string | null
  size: string | null
  employee_count: number | null
  average_age: number | null
  creation_year: number | null
  parity_men: number | null
  parity_women: number | null
  offices: Array<{ address: string; city: string; country_code: string }>
  headquarters_city: string | null
  headquarters_country: string | null
  sectors: Array<{ name: string; parent_name: string }>
  tech_stack: string[]
  social_networks: {
    facebook?: string
    instagram?: string
    linkedin?: string
    twitter?: string
    youtube?: string
  }
  jobs_count: number
  jobs: Array<{
    // WTTJ format
    slug?: string
    name?: string
    // Job board format
    title?: string
    url?: string
    location?: string
    source?: string
    // Common
    contract_type?: string
    remote?: string
    published_at?: string
    posted_date?: string
    salary_min?: number
    salary_max?: number
  }>
  scraped_at: string
  // LinkedIn specific
  source?: string
  company_type?: string | null
  follower_count?: number | null
  specialities?: string[]
  funding_rounds?: number | null
}

export default function CompanyIntelligencePage() {
  const [searchUrl, setSearchUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [company, setCompany] = useState<CompanyProfile | null>(null)

  const searchCompanyByName = async (name: string) => {
    setSearchUrl(name)
    setLoading(true)
    setError(null)
    setCompany(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setError('Vous devez être connecté')
        setLoading(false)
        return
      }

      const response = await fetch('/api/company-intelligence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_name: name,
          user_id: session.user.id
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Entreprise non trouvée')
      }

      setCompany(data.company)
    } catch (err) {
      console.error('Error fetching company:', err)
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setLoading(false)
    }
  }

  const searchCompany = async () => {
    if (!searchUrl.trim()) {
      setError('Veuillez entrer une URL ou un nom d\'entreprise')
      return
    }

    setLoading(true)
    setError(null)
    setCompany(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setError('Vous devez être connecté')
        setLoading(false)
        return
      }

      const isUrl = searchUrl.includes('http') || searchUrl.includes('welcometothejungle') || searchUrl.includes('linkedin')

      const response = await fetch('/api/company-intelligence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(isUrl ? { company_url: searchUrl } : { company_name: searchUrl }),
          user_id: session.user.id
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Entreprise non trouvée')
      }

      setCompany(data.company)
    } catch (err) {
      console.error('Error fetching company:', err)
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AppLayout>
      <div className="p-4 md:p-8">
        <div className="max-w-5xl mx-auto">

          {/* Hero Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold" style={{ color: '#1D3557' }}>
                  Company Intelligence
                </h1>
                <p className="text-sm" style={{ color: '#457B9D' }}>
                  Analyse approfondie d'entreprise en temps reel
                </p>
              </div>
            </div>
          </div>

          {/* Search Card */}
          <Card className="p-6 mb-6 border-t-4 border-t-emerald-500">
            <div className="mb-4">
              <h2 className="font-semibold text-gray-900 mb-1">Rechercher une entreprise</h2>
              <p className="text-sm text-gray-500">
                Entrez l'URL Welcome to the Jungle ou le nom de l'entreprise
              </p>
            </div>
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <Input
                  placeholder="Ex: https://www.welcometothejungle.com/fr/companies/doctolib ou Doctolib"
                  value={searchUrl}
                  onChange={(e) => setSearchUrl(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && searchCompany()}
                  className="w-full"
                />
              </div>
              <Button
                onClick={searchCompany}
                disabled={loading}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Analyse en cours...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    Analyser
                  </>
                )}
              </Button>
            </div>
            {error && (
              <p className="mt-3 text-sm text-red-600">{error}</p>
            )}
          </Card>

          {/* Feature Grid - Only show when no company */}
          {!company && !loading && (
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Que contient un rapport Company Intelligence ?</h2>
              <div className="grid md:grid-cols-3 gap-4">
                <Card className="p-5 border-0 bg-gradient-to-br from-blue-50 to-white">
                  <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center mb-3">
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-1">Donnees RH</h3>
                  <p className="text-sm text-gray-500">Effectifs, age moyen, parite H/F, date de creation</p>
                </Card>

                <Card className="p-5 border-0 bg-gradient-to-br from-purple-50 to-white">
                  <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center mb-3">
                    <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                    </svg>
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-1">Stack Technique</h3>
                  <p className="text-sm text-gray-500">Technologies, langages, frameworks utilises par l'equipe tech</p>
                </Card>

                <Card className="p-5 border-0 bg-gradient-to-br from-amber-50 to-white">
                  <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center mb-3">
                    <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-1">Postes Ouverts</h3>
                  <p className="text-sm text-gray-500">Liste des offres actives avec type de contrat et remote</p>
                </Card>

                <Card className="p-5 border-0 bg-gradient-to-br from-green-50 to-white">
                  <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center mb-3">
                    <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-1">Bureaux</h3>
                  <p className="text-sm text-gray-500">Localisation du siege et des bureaux secondaires</p>
                </Card>

                <Card className="p-5 border-0 bg-gradient-to-br from-rose-50 to-white">
                  <div className="w-10 h-10 rounded-lg bg-rose-100 flex items-center justify-center mb-3">
                    <svg className="w-5 h-5 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                    </svg>
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-1">Secteur d'activite</h3>
                  <p className="text-sm text-gray-500">Industrie, domaine d'expertise et positionnement</p>
                </Card>

                <Card className="p-5 border-0 bg-gradient-to-br from-cyan-50 to-white">
                  <div className="w-10 h-10 rounded-lg bg-cyan-100 flex items-center justify-center mb-3">
                    <svg className="w-5 h-5 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-1">Liens & Reseaux</h3>
                  <p className="text-sm text-gray-500">Site web, LinkedIn, Twitter, et autres reseaux sociaux</p>
                </Card>
              </div>

              {/* Use Cases */}
              <div className="mt-8 p-6 rounded-xl bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-100">
                <h3 className="font-semibold text-gray-900 mb-4">Cas d'usage</h3>
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">🎯</span>
                    <div>
                      <p className="font-medium text-gray-900">Recruteurs / ESN</p>
                      <p className="text-sm text-gray-500">Preparez vos pitchs commerciaux avec des donnees precises sur les besoins tech</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">💼</span>
                    <div>
                      <p className="font-medium text-gray-900">Candidats</p>
                      <p className="text-sm text-gray-500">Evaluez la culture d'entreprise et le stack technique avant de postuler</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">📊</span>
                    <div>
                      <p className="font-medium text-gray-900">Business Dev</p>
                      <p className="text-sm text-gray-500">Identifiez les entreprises en croissance qui recrutent dans votre domaine</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Example companies */}
              <div className="mt-6">
                <p className="text-sm text-gray-500 mb-3">Essayez avec ces entreprises :</p>
                <div className="flex flex-wrap gap-2">
                  {['Doctolib', 'Alan', 'Qonto', 'Payfit', 'Swile', 'Back Market'].map((name) => (
                    <button
                      key={name}
                      onClick={() => searchCompanyByName(name)}
                      className="px-3 py-1.5 rounded-full text-sm bg-white border border-gray-200 hover:border-emerald-500 hover:text-emerald-600 transition-colors"
                    >
                      {name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Company Profile */}
          {company && (
            <div className="space-y-6">
              {/* Header Card */}
              <Card className="p-6">
                <div className="flex flex-col md:flex-row gap-6">
                  {/* Logo */}
                  {company.logo && (
                    <div className="flex-shrink-0">
                      <img
                        src={company.logo}
                        alt={`${company.name} logo`}
                        className="w-20 h-20 rounded-xl object-contain bg-gray-50 border"
                      />
                    </div>
                  )}
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h2 className="text-2xl font-bold" style={{ color: '#1D3557' }}>{company.name}</h2>
                      {company.source === 'linkedin' && (
                        <span className="px-2 py-0.5 rounded text-xs font-medium" style={{ backgroundColor: '#E8F4FF', color: '#0A66C2' }}>
                          LinkedIn
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2 mb-4">
                      {company.size && (
                        <span className="px-3 py-1 rounded-full text-sm" style={{ backgroundColor: '#E8F4F8', color: '#1D3557' }}>
                          {company.size} employes
                        </span>
                      )}
                      {company.follower_count && (
                        <span className="px-3 py-1 rounded-full text-sm" style={{ backgroundColor: '#E8F4FF', color: '#0A66C2' }}>
                          {company.follower_count.toLocaleString()} followers
                        </span>
                      )}
                      {company.headquarters_city && (
                        <span className="px-3 py-1 rounded-full text-sm" style={{ backgroundColor: '#E8F4F8', color: '#1D3557' }}>
                          {company.headquarters_city}, {company.headquarters_country}
                        </span>
                      )}
                      {company.creation_year && (
                        <span className="px-3 py-1 rounded-full text-sm" style={{ backgroundColor: '#E8F4F8', color: '#1D3557' }}>
                          Fondee en {company.creation_year}
                        </span>
                      )}
                      {company.company_type && (
                        <span className="px-3 py-1 rounded-full text-sm" style={{ backgroundColor: '#F3F4F6', color: '#374151' }}>
                          {company.company_type}
                        </span>
                      )}
                    </div>

                    {/* Specialities (LinkedIn) */}
                    {company.specialities && company.specialities.length > 0 && (
                      <p className="text-sm text-gray-600 italic mb-3">
                        {company.specialities.join(' • ')}
                      </p>
                    )}

                    {/* Sectors */}
                    {company.sectors && company.sectors.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-4">
                        {company.sectors.map((sector, i) => (
                          <span key={i} className="px-2 py-1 rounded text-xs font-medium" style={{ backgroundColor: '#6366F1', color: 'white' }}>
                            {sector.name}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Links */}
                    <div className="flex flex-wrap gap-3">
                      {company.website && (
                        <a href={company.website} target="_blank" rel="noopener noreferrer" className="text-sm flex items-center gap-1 hover:underline" style={{ color: '#6366F1' }}>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                          </svg>
                          Site web
                        </a>
                      )}
                      {company.linkedin_url && (
                        <a href={company.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-sm flex items-center gap-1 hover:underline" style={{ color: '#0A66C2' }}>
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                          </svg>
                          LinkedIn
                        </a>
                      )}
                      {company.wttj_url && (
                        <a href={company.wttj_url} target="_blank" rel="noopener noreferrer" className="text-sm flex items-center gap-1 hover:underline" style={{ color: '#FFCD00' }}>
                          WTTJ
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-4 md:w-64">
                    {company.employee_count && (
                      <div className="text-center p-3 rounded-lg" style={{ backgroundColor: '#F8F9FA' }}>
                        <p className="text-2xl font-bold" style={{ color: '#1D3557' }}>{company.employee_count}</p>
                        <p className="text-xs" style={{ color: '#457B9D' }}>Employés</p>
                      </div>
                    )}
                    {company.average_age && (
                      <div className="text-center p-3 rounded-lg" style={{ backgroundColor: '#F8F9FA' }}>
                        <p className="text-2xl font-bold" style={{ color: '#1D3557' }}>{company.average_age}</p>
                        <p className="text-xs" style={{ color: '#457B9D' }}>Âge moyen</p>
                      </div>
                    )}
                    {company.jobs_count > 0 && (
                      <div className="text-center p-3 rounded-lg" style={{ backgroundColor: '#F8F9FA' }}>
                        <p className="text-2xl font-bold" style={{ color: '#6366F1' }}>{company.jobs_count}</p>
                        <p className="text-xs" style={{ color: '#457B9D' }}>Postes ouverts</p>
                      </div>
                    )}
                    {company.parity_women !== null && company.parity_men !== null && (
                      <div className="text-center p-3 rounded-lg" style={{ backgroundColor: '#F8F9FA' }}>
                        <p className="text-2xl font-bold" style={{ color: '#1D3557' }}>{company.parity_women}%</p>
                        <p className="text-xs" style={{ color: '#457B9D' }}>Femmes</p>
                      </div>
                    )}
                  </div>
                </div>
              </Card>

              {/* Description */}
              {company.description && (
                <Card className="p-6">
                  <h3 className="font-semibold mb-3" style={{ color: '#1D3557' }}>À propos</h3>
                  <p className="text-sm whitespace-pre-line" style={{ color: '#457B9D' }}>{company.description}</p>
                </Card>
              )}

              {/* Tech Stack */}
              {company.tech_stack && company.tech_stack.length > 0 && (
                <Card className="p-6">
                  <h3 className="font-semibold mb-3" style={{ color: '#1D3557' }}>Stack Technique</h3>
                  <div className="flex flex-wrap gap-2">
                    {company.tech_stack.map((tech, i) => (
                      <span key={i} className="px-3 py-1 rounded-full text-sm" style={{ backgroundColor: '#E8F4F8', color: '#1D3557' }}>
                        {tech}
                      </span>
                    ))}
                  </div>
                </Card>
              )}

              {/* Offices */}
              {company.offices && company.offices.length > 0 && (
                <Card className="p-6">
                  <h3 className="font-semibold mb-3" style={{ color: '#1D3557' }}>Bureaux ({company.offices.length})</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {company.offices.map((office, i) => (
                      <div key={i} className="p-3 rounded-lg" style={{ backgroundColor: '#F8F9FA' }}>
                        <p className="font-medium" style={{ color: '#1D3557' }}>{office.city}, {office.country_code}</p>
                        {office.address && <p className="text-sm" style={{ color: '#457B9D' }}>{office.address}</p>}
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* Jobs */}
              {company.jobs && company.jobs.length > 0 && (
                <Card className="p-6">
                  <h3 className="font-semibold mb-4" style={{ color: '#1D3557' }}>
                    Postes ouverts ({company.jobs_count})
                  </h3>
                  <div className="space-y-3">
                    {company.jobs.map((job, i) => {
                      // Handle both WTTJ and job board formats
                      const jobTitle = job.name || job.title || 'Poste non specifie'
                      const jobUrl = job.url || (job.slug ? `https://www.welcometothejungle.com/fr/companies/${company.slug}/jobs/${job.slug}` : '#')
                      const contractType = job.contract_type === 'permanent' ? 'CDI'
                        : job.contract_type === 'fixed_term' ? 'CDD'
                        : job.contract_type || null

                      return (
                        <div key={i} className="flex justify-between items-start p-3 rounded-lg hover:bg-gray-50 transition-colors border border-gray-100">
                          <div className="flex-1">
                            <p className="font-medium" style={{ color: '#1D3557' }}>{jobTitle}</p>
                            <div className="flex flex-wrap gap-2 mt-2">
                              {contractType && (
                                <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: '#E8F4F8', color: '#1D3557' }}>
                                  {contractType}
                                </span>
                              )}
                              {job.location && (
                                <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: '#F3F4F6', color: '#374151' }}>
                                  {job.location}
                                </span>
                              )}
                              {job.remote && (
                                <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: '#86EFAC', color: '#166534' }}>
                                  {job.remote}
                                </span>
                              )}
                              {job.source && (
                                <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: '#FEF3C7', color: '#92400E' }}>
                                  {job.source}
                                </span>
                              )}
                              {(job.salary_min || job.salary_max) && (
                                <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: '#DBEAFE', color: '#1E40AF' }}>
                                  {job.salary_min && job.salary_max
                                    ? `${job.salary_min.toLocaleString()} - ${job.salary_max.toLocaleString()} EUR`
                                    : job.salary_min
                                      ? `${job.salary_min.toLocaleString()}+ EUR`
                                      : `< ${job.salary_max?.toLocaleString()} EUR`
                                  }
                                </span>
                              )}
                            </div>
                          </div>
                          <a
                            href={jobUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm px-3 py-1 rounded hover:bg-gray-100 whitespace-nowrap ml-3"
                            style={{ color: '#6366F1' }}
                          >
                            Voir →
                          </a>
                        </div>
                      )
                    })}
                  </div>
                </Card>
              )}

              {/* Metadata */}
              <p className="text-xs text-center" style={{ color: '#9CA3AF' }}>
                Dernière mise à jour : {new Date(company.scraped_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  )
}
