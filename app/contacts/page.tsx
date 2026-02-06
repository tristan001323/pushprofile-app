'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import AppLayout from '@/components/AppLayout'
import { supabase } from '@/lib/supabase'

interface Contact {
  id: string
  full_name: string | null
  first_name: string | null
  last_name: string | null
  job_title: string | null
  email: string | null
  phone: string | null
  linkedin_url: string | null
  company_name: string | null
  company_domain: string | null
  enriched_at: string
  source: string | null
}

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterCompany, setFilterCompany] = useState('')

  useEffect(() => {
    fetchContacts()
  }, [])

  const fetchContacts = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const { data, error } = await supabase
        .from('contacts_cache')
        .select('*')
        .eq('user_id', session.user.id)
        .order('enriched_at', { ascending: false })

      if (error) {
        console.error('Error fetching contacts:', error)
        return
      }

      setContacts(data || [])
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  // Get unique companies for filter
  const companies = [...new Set(contacts.map(c => c.company_name).filter(Boolean))]

  // Filter contacts
  const filteredContacts = contacts.filter(contact => {
    const matchesSearch = searchTerm === '' ||
      (contact.full_name?.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (contact.email?.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (contact.job_title?.toLowerCase().includes(searchTerm.toLowerCase()))

    const matchesCompany = filterCompany === '' ||
      contact.company_name?.toLowerCase() === filterCompany.toLowerCase()

    return matchesSearch && matchesCompany
  })

  // Stats
  const stats = {
    total: contacts.length,
    withEmail: contacts.filter(c => c.email).length,
    withPhone: contacts.filter(c => c.phone).length,
    companies: companies.length
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  const exportToCSV = () => {
    const headers = ['Nom', 'Poste', 'Email', 'Telephone', 'LinkedIn', 'Entreprise', 'Domaine', 'Date']
    const rows = filteredContacts.map(c => [
      c.full_name || '',
      c.job_title || '',
      c.email || '',
      c.phone || '',
      c.linkedin_url || '',
      c.company_name || '',
      c.company_domain || '',
      c.enriched_at ? new Date(c.enriched_at).toLocaleDateString('fr-FR') : ''
    ])

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `contacts_pushprofile_${new Date().toISOString().split('T')[0]}.csv`
    link.click()
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="p-8 flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-t-transparent rounded-full animate-spin mx-auto mb-4" style={{ borderColor: '#6366F1', borderTopColor: 'transparent' }} />
            <p style={{ color: '#457B9D' }}>Chargement des contacts...</p>
          </div>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="p-4 md:p-8">
        <div className="max-w-7xl mx-auto">

          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-bold" style={{ color: '#1D3557' }}>Mes Contacts</h1>
              <p className="mt-1" style={{ color: '#457B9D' }}>
                Tous les decideurs que vous avez debloques
              </p>
            </div>
            {contacts.length > 0 && (
              <Button
                onClick={exportToCSV}
                variant="outline"
                className="border-indigo-200 text-indigo-600 hover:bg-indigo-50"
              >
                Exporter en CSV
              </Button>
            )}
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <Card className="p-4 text-center">
              <p className="text-3xl font-bold text-indigo-600">{stats.total}</p>
              <p className="text-sm text-muted">Contacts totaux</p>
            </Card>
            <Card className="p-4 text-center">
              <p className="text-3xl font-bold text-green-600">{stats.withEmail}</p>
              <p className="text-sm text-muted">Avec email</p>
            </Card>
            <Card className="p-4 text-center">
              <p className="text-3xl font-bold text-blue-600">{stats.withPhone}</p>
              <p className="text-sm text-muted">Avec telephone</p>
            </Card>
            <Card className="p-4 text-center">
              <p className="text-3xl font-bold text-purple-600">{stats.companies}</p>
              <p className="text-sm text-muted">Entreprises</p>
            </Card>
          </div>

          {contacts.length === 0 ? (
            /* Empty State */
            <Card className="p-12 text-center">
              <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6" style={{ backgroundColor: '#E0E7FF' }}>
                <svg className="w-10 h-10" style={{ color: '#6366F1' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold mb-2" style={{ color: '#1D3557' }}>Aucun contact pour le moment</h2>
              <p className="mb-6 max-w-md mx-auto" style={{ color: '#457B9D' }}>
                Debloquez des contacts depuis vos resultats de recherche pour les retrouver ici.
              </p>
              <Button
                onClick={() => window.location.href = '/searches'}
                style={{ backgroundColor: '#6366F1', color: 'white' }}
              >
                Voir mes recherches
              </Button>
            </Card>
          ) : (
            <>
              {/* Search & Filter */}
              <div className="flex flex-col md:flex-row gap-4 mb-6">
                <div className="flex-1">
                  <Input
                    placeholder="Rechercher par nom, email, poste..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full"
                  />
                </div>
                <select
                  value={filterCompany}
                  onChange={(e) => setFilterCompany(e.target.value)}
                  className="px-4 py-2 border rounded-lg bg-white"
                >
                  <option value="">Toutes les entreprises</option>
                  {companies.map(company => (
                    <option key={company} value={company || ''}>
                      {company}
                    </option>
                  ))}
                </select>
              </div>

              {/* Contacts Table */}
              <Card className="overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                          Contact
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                          Entreprise
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                          Email
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                          Telephone
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredContacts.map((contact) => (
                        <tr key={contact.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-semibold">
                                {(contact.first_name?.[0] || contact.full_name?.[0] || '?').toUpperCase()}
                              </div>
                              <div>
                                <p className="font-medium text-gray-900">
                                  {contact.full_name || 'Nom inconnu'}
                                </p>
                                <p className="text-sm text-gray-500">
                                  {contact.job_title || 'Poste non renseigne'}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <p className="font-medium text-gray-900 capitalize">
                              {contact.company_name || '-'}
                            </p>
                            <p className="text-xs text-gray-500">
                              {contact.company_domain || ''}
                            </p>
                          </td>
                          <td className="px-4 py-4">
                            {contact.email ? (
                              <button
                                onClick={() => copyToClipboard(contact.email!)}
                                className="flex items-center gap-2 text-sm text-gray-700 hover:text-indigo-600 transition-colors group"
                                title="Cliquer pour copier"
                              >
                                <span className="max-w-[180px] truncate">{contact.email}</span>
                                <svg className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                              </button>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-4 py-4">
                            {contact.phone ? (
                              <button
                                onClick={() => copyToClipboard(contact.phone!)}
                                className="flex items-center gap-2 text-sm text-gray-700 hover:text-indigo-600 transition-colors group"
                                title="Cliquer pour copier"
                              >
                                <span>{contact.phone}</span>
                                <svg className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                              </button>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-2">
                              {contact.linkedin_url && (
                                <a
                                  href={contact.linkedin_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-2 rounded-lg hover:bg-blue-50 text-[#0A66C2] transition-colors"
                                  title="Voir sur LinkedIn"
                                >
                                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                                  </svg>
                                </a>
                              )}
                              {contact.email && (
                                <a
                                  href={`mailto:${contact.email}`}
                                  className="p-2 rounded-lg hover:bg-green-50 text-green-600 transition-colors"
                                  title="Envoyer un email"
                                >
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                  </svg>
                                </a>
                              )}
                              {contact.phone && (
                                <a
                                  href={`tel:${contact.phone}`}
                                  className="p-2 rounded-lg hover:bg-purple-50 text-purple-600 transition-colors"
                                  title="Appeler"
                                >
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                  </svg>
                                </a>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {filteredContacts.length === 0 && contacts.length > 0 && (
                  <div className="p-8 text-center" style={{ color: '#457B9D' }}>
                    Aucun contact ne correspond a votre recherche
                  </div>
                )}
              </Card>

              {/* Results count */}
              <p className="text-sm mt-4 text-center" style={{ color: '#457B9D' }}>
                {filteredContacts.length} contact{filteredContacts.length > 1 ? 's' : ''} affiche{filteredContacts.length > 1 ? 's' : ''}
                {filterCompany || searchTerm ? ` sur ${contacts.length} au total` : ''}
              </p>
            </>
          )}
        </div>
      </div>
    </AppLayout>
  )
}
