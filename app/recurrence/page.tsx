'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import AppLayout from '@/components/AppLayout'
import Link from 'next/link'

type RecurringSearch = {
  id: string
  name: string
  recurrence: '2days' | '4days' | 'weekly' | 'biweekly' | 'monthly'
  is_recurrence_active: boolean
  next_run_at: string | null
  created_at: string
  last_run_at: string | null
}

export default function RecurrencePage() {
  const [searches, setSearches] = useState<RecurringSearch[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadRecurringSearches()
  }, [])

  const loadRecurringSearches = async () => {
    const { data, error } = await supabase
      .from('searches')
      .select('id, name, recurrence, is_recurrence_active, next_run_at, created_at, last_run_at')
      .not('recurrence', 'is', null)
      .order('created_at', { ascending: false })

    if (data) {
      setSearches(data as RecurringSearch[])
    }
    setLoading(false)
  }

  const toggleRecurrence = async (searchId: string, currentValue: boolean) => {
    const { error } = await supabase
      .from('searches')
      .update({ is_recurrence_active: !currentValue })
      .eq('id', searchId)

    if (!error) {
      setSearches(prev => prev.map(s =>
        s.id === searchId ? { ...s, is_recurrence_active: !currentValue } : s
      ))
    }
  }

  const deleteRecurrence = async (searchId: string) => {
    const { error } = await supabase
      .from('searches')
      .update({ recurrence: null, is_recurrence_active: false, next_run_at: null })
      .eq('id', searchId)

    if (!error) {
      setSearches(prev => prev.filter(s => s.id !== searchId))
    }
  }

  const getRecurrenceLabel = (recurrence: string) => {
    switch (recurrence) {
      case '2days': return 'Tous les 2 jours'
      case '4days': return 'Tous les 4 jours'
      case 'weekly': return 'Hebdomadaire'
      case 'biweekly': return 'Bi-mensuel'
      case 'monthly': return 'Mensuel'
      default: return recurrence
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    })
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
            <h1 className="text-3xl font-bold" style={{ color: '#1D3557' }}>Recherches récurrentes</h1>
            <p className="mt-2" style={{ color: '#457B9D' }}>Gérez vos recherches automatiques</p>
          </div>

          {searches.length === 0 ? (
            <Card className="p-12 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ backgroundColor: '#A8DADC' }}>
                <span className="text-3xl">🔄</span>
              </div>
              <h3 className="text-xl font-semibold mb-2" style={{ color: '#1D3557' }}>Aucune recherche récurrente</h3>
              <p className="mb-6" style={{ color: '#457B9D' }}>
                Créez une nouvelle recherche et activez la récurrence pour recevoir automatiquement de nouvelles offres.
              </p>
              <Link href="/new-search">
                <Button style={{ backgroundColor: '#6366F1', color: 'white' }}>
                  Créer une recherche
                </Button>
              </Link>
            </Card>
          ) : (
            <div className="space-y-4">
              {/* Stats */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <Card className="p-4 text-center">
                  <p className="text-2xl font-bold" style={{ color: '#1D3557' }}>{searches.length}</p>
                  <p className="text-sm" style={{ color: '#457B9D' }}>Total récurrences</p>
                </Card>
                <Card className="p-4 text-center">
                  <p className="text-2xl font-bold" style={{ color: '#059669' }}>
                    {searches.filter(s => s.is_recurrence_active).length}
                  </p>
                  <p className="text-sm" style={{ color: '#457B9D' }}>Actives</p>
                </Card>
                <Card className="p-4 text-center">
                  <p className="text-2xl font-bold" style={{ color: '#DC2626' }}>
                    {searches.filter(s => !s.is_recurrence_active).length}
                  </p>
                  <p className="text-sm" style={{ color: '#457B9D' }}>En pause</p>
                </Card>
                <Card className="p-4 text-center">
                  <p className="text-2xl font-bold" style={{ color: '#1D3557' }}>
                    {searches.filter(s => s.next_run_at && new Date(s.next_run_at) <= new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)).length}
                  </p>
                  <p className="text-sm" style={{ color: '#457B9D' }}>Prochaines 48h</p>
                </Card>
              </div>

              {/* Liste des recherches récurrentes */}
              {searches.map((search) => (
                <Card key={search.id} className="p-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3 md:gap-4">
                      <div
                        className="w-12 h-12 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: search.is_recurrence_active ? '#D1FAE5' : '#F3F4F6' }}
                      >
                        <span className="text-xl">{search.is_recurrence_active ? '🔄' : '⏸️'}</span>
                      </div>
                      <div>
                        <Link href={`/searches/${search.id}`}>
                          <h3 className="text-lg font-semibold hover:underline" style={{ color: '#1D3557' }}>
                            {search.name}
                          </h3>
                        </Link>
                        <div className="flex flex-wrap items-center gap-2 md:gap-4 mt-1 text-sm" style={{ color: '#457B9D' }}>
                          <span className="flex items-center gap-1">
                            <span>🔁</span>
                            {getRecurrenceLabel(search.recurrence)}
                          </span>
                          <span>•</span>
                          <span>Prochaine : {formatDate(search.next_run_at)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {/* Toggle actif/inactif */}
                      <button
                        onClick={() => toggleRecurrence(search.id, search.is_recurrence_active)}
                        className="relative w-14 h-7 rounded-full transition-colors"
                        style={{ backgroundColor: search.is_recurrence_active ? '#6366F1' : '#E5E7EB' }}
                      >
                        <div
                          className="absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform"
                          style={{ transform: search.is_recurrence_active ? 'translateX(30px)' : 'translateX(2px)' }}
                        />
                      </button>

                      {/* Bouton supprimer */}
                      <button
                        onClick={() => deleteRecurrence(search.id)}
                        className="p-2 rounded-lg hover:bg-red-50 transition-colors"
                        title="Supprimer la récurrence"
                      >
                        <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Historique */}
                  {search.last_run_at && (
                    <div className="mt-4 pt-4 border-t border-gray-100">
                      <p className="text-sm" style={{ color: '#457B9D' }}>
                        Dernière exécution : {formatDate(search.last_run_at)}
                      </p>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  )
}
