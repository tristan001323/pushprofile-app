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
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-xl shadow-indigo-500/30 animate-pulse">
                <span className="text-white font-bold text-2xl">P</span>
              </div>
              <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 animate-ping" />
            </div>
          </div>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="p-4 md:p-8">
        <div className="max-w-5xl mx-auto">
          <div className="mb-8">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Recherches recurrentes</h1>
                <p className="text-gray-500">Gerez vos recherches automatiques</p>
              </div>
            </div>
          </div>

          {searches.length === 0 ? (
            <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-12 text-center shadow-xl border border-white/50">
              <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center">
                <svg className="w-10 h-10 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2 text-gray-900">Aucune recherche recurrente</h3>
              <p className="mb-6 text-gray-500">
                Creez une nouvelle recherche et activez la recurrence pour recevoir automatiquement de nouvelles offres.
              </p>
              <Link href="/new-search">
                <Button className="h-12 px-6 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-lg shadow-indigo-500/30 transition-all duration-300">
                  Creer une recherche
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Stats */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-4 text-center shadow-lg border border-white/50 hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5">
                  <p className="text-2xl font-bold text-gray-900">{searches.length}</p>
                  <p className="text-sm text-gray-500">Total recurrences</p>
                </div>
                <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-4 text-center shadow-lg border border-white/50 hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5">
                  <p className="text-2xl font-bold bg-gradient-to-r from-emerald-500 to-teal-500 bg-clip-text text-transparent">
                    {searches.filter(s => s.is_recurrence_active).length}
                  </p>
                  <p className="text-sm text-gray-500">Actives</p>
                </div>
                <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-4 text-center shadow-lg border border-white/50 hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5">
                  <p className="text-2xl font-bold text-amber-500">
                    {searches.filter(s => !s.is_recurrence_active).length}
                  </p>
                  <p className="text-sm text-gray-500">En pause</p>
                </div>
                <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-4 text-center shadow-lg border border-white/50 hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5">
                  <p className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                    {searches.filter(s => s.next_run_at && new Date(s.next_run_at) <= new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)).length}
                  </p>
                  <p className="text-sm text-gray-500">Prochaines 48h</p>
                </div>
              </div>

              {/* Liste des recherches récurrentes */}
              {searches.map((search) => (
                <div key={search.id} className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 shadow-lg border border-white/50 hover:shadow-xl transition-all duration-300">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3 md:gap-4">
                      <div
                        className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-lg ${
                          search.is_recurrence_active
                            ? 'bg-gradient-to-br from-emerald-500 to-teal-600 shadow-emerald-500/30'
                            : 'bg-gradient-to-br from-gray-300 to-gray-400 shadow-gray-500/20'
                        }`}
                      >
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                      </div>
                      <div>
                        <Link href={`/searches/${search.id}`}>
                          <h3 className="text-lg font-semibold text-gray-900 hover:text-indigo-600 transition-colors">
                            {search.name}
                          </h3>
                        </Link>
                        <div className="flex flex-wrap items-center gap-2 md:gap-4 mt-1 text-sm text-gray-500">
                          <span className="flex items-center gap-1.5 px-2 py-0.5 bg-gray-100 rounded-lg">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            {getRecurrenceLabel(search.recurrence)}
                          </span>
                          <span className="text-gray-300">|</span>
                          <span>Prochaine : {formatDate(search.next_run_at)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {/* Toggle actif/inactif */}
                      <button
                        onClick={() => toggleRecurrence(search.id, search.is_recurrence_active)}
                        className={`relative w-14 h-7 rounded-full transition-all duration-300 ${
                          search.is_recurrence_active
                            ? 'bg-gradient-to-r from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/30'
                            : 'bg-gray-200'
                        }`}
                      >
                        <div
                          className="absolute top-0.5 w-6 h-6 bg-white rounded-full shadow-md transition-transform duration-300"
                          style={{ transform: search.is_recurrence_active ? 'translateX(30px)' : 'translateX(2px)' }}
                        />
                      </button>

                      {/* Bouton supprimer */}
                      <button
                        onClick={() => deleteRecurrence(search.id)}
                        className="p-2.5 rounded-xl hover:bg-red-50 transition-all duration-200 group"
                        title="Supprimer la récurrence"
                      >
                        <svg className="w-5 h-5 text-gray-400 group-hover:text-red-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Historique */}
                  {search.last_run_at && (
                    <div className="mt-4 pt-4 border-t border-gray-100">
                      <p className="text-sm text-gray-500">
                        Derniere execution : {formatDate(search.last_run_at)}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  )
}
