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
    slug: string
    name: string
    contract_type: string
    remote?: string
    published_at?: string
  }>
  scraped_at: string
}

export default function CompanyIntelligencePage() {
  const [searchUrl, setSearchUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [company, setCompany] = useState<CompanyProfile | null>(null)

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
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl md:text-3xl font-bold" style={{ color: '#1D3557' }}>
              Company Intelligence
            </h1>
            <p className="mt-2" style={{ color: '#457B9D' }}>
              Analysez une entreprise en profondeur : taille, stack technique, culture, postes ouverts...
            </p>
          </div>

          {/* Search */}
          <Card className="p-6 mb-8">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <Input
                  placeholder="URL WTTJ (ex: https://www.welcometothejungle.com/fr/companies/doctolib) ou nom d'entreprise"
                  value={searchUrl}
                  onChange={(e) => setSearchUrl(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && searchCompany()}
                  className="w-full"
                />
              </div>
              <Button
                onClick={searchCompany}
                disabled={loading}
                style={{ backgroundColor: '#6366F1', color: 'white' }}
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

          {/* Company Profile */}
          {company && (
            <div className="space-y-6">
              {/* Header Card */}
              <Card className="p-6">
                <div className="flex flex-col md:flex-row gap-6">
                  <div className="flex-1">
                    <h2 className="text-2xl font-bold mb-2" style={{ color: '#1D3557' }}>{company.name}</h2>
                    <div className="flex flex-wrap gap-2 mb-4">
                      {company.size && (
                        <span className="px-3 py-1 rounded-full text-sm" style={{ backgroundColor: '#E8F4F8', color: '#1D3557' }}>
                          {company.size}
                        </span>
                      )}
                      {company.headquarters_city && (
                        <span className="px-3 py-1 rounded-full text-sm" style={{ backgroundColor: '#E8F4F8', color: '#1D3557' }}>
                          {company.headquarters_city}, {company.headquarters_country}
                        </span>
                      )}
                      {company.creation_year && (
                        <span className="px-3 py-1 rounded-full text-sm" style={{ backgroundColor: '#E8F4F8', color: '#1D3557' }}>
                          Fondée en {company.creation_year}
                        </span>
                      )}
                    </div>

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
                  <h3 className="font-semibold mb-3" style={{ color: '#1D3557' }}>Postes ouverts ({company.jobs_count})</h3>
                  <div className="space-y-3">
                    {company.jobs.slice(0, 10).map((job, i) => (
                      <div key={i} className="flex justify-between items-center p-3 rounded-lg hover:bg-gray-50 transition-colors">
                        <div>
                          <p className="font-medium" style={{ color: '#1D3557' }}>{job.name}</p>
                          <div className="flex gap-2 mt-1">
                            <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: '#E8F4F8', color: '#1D3557' }}>
                              {job.contract_type === 'permanent' ? 'CDI' : job.contract_type === 'fixed_term' ? 'CDD' : job.contract_type}
                            </span>
                            {job.remote && (
                              <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: '#86EFAC', color: '#166534' }}>
                                {job.remote}
                              </span>
                            )}
                          </div>
                        </div>
                        <a
                          href={`https://www.welcometothejungle.com/fr/companies/${company.slug}/jobs/${job.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm px-3 py-1 rounded hover:bg-gray-100"
                          style={{ color: '#6366F1' }}
                        >
                          Voir →
                        </a>
                      </div>
                    ))}
                    {company.jobs_count > 10 && (
                      <a
                        href={company.wttj_url || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block text-center text-sm py-2 hover:underline"
                        style={{ color: '#6366F1' }}
                      >
                        Voir les {company.jobs_count - 10} autres postes →
                      </a>
                    )}
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
