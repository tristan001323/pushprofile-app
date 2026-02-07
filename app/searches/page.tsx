'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import AppLayout from '@/components/AppLayout'

type Search = {
  id: string
  name: string
  search_type: string
  created_at: string
  status: string
  is_favorite: boolean
}

export default function SearchesPage() {
  const router = useRouter()
  const [searches, setSearches] = useState<Search[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadSearches()
  }, [])

  const loadSearches = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      router.push('/login')
      return
    }

    const { data, error } = await supabase
      .from('searches')
      .select('*')
      .order('created_at', { ascending: false })

    if (data) setSearches(data)
    setLoading(false)
  }

  const toggleFavorite = async (e: React.MouseEvent, searchId: string, currentValue: boolean) => {
    e.preventDefault()
    e.stopPropagation()

    const { error } = await supabase
      .from('searches')
      .update({ is_favorite: !currentValue })
      .eq('id', searchId)

    if (!error) {
      setSearches(prev => prev.map(s =>
        s.id === searchId ? { ...s, is_favorite: !currentValue } : s
      ))
    }
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
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Mes recherches</h1>
                <p className="text-gray-500">Historique de vos analyses CV</p>
              </div>
            </div>
          </div>

          {searches.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center shadow-lg border border-gray-100/50">
              <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-gray-100 to-gray-50 flex items-center justify-center">
                <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <p className="text-lg text-gray-500 mb-4">Aucune recherche pour le moment</p>
              <Button
                onClick={() => router.push('/new-search')}
                className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 shadow-lg shadow-indigo-500/30"
              >
                Creer ma premiere recherche
              </Button>
            </div>
          ) : (
            <div className="grid gap-4">
              {searches.map((search) => (
                <Link key={search.id} href={`/searches/${search.id}`}>
                  <div className="bg-white rounded-2xl p-6 shadow-md hover:shadow-xl transition-all duration-300 cursor-pointer border border-gray-100/50 hover:-translate-y-0.5 group">
                    <div className="flex justify-between items-start">
                      <div className="flex items-start gap-4">
                        {/* Bouton favori */}
                        <button
                          onClick={(e) => toggleFavorite(e, search.id, search.is_favorite)}
                          className="mt-1 p-2 rounded-xl hover:bg-gray-100 transition-all duration-200 hover:scale-110"
                        >
                          <svg
                            className="w-5 h-5"
                            fill={search.is_favorite ? 'url(#star-gradient)' : 'none'}
                            stroke={search.is_favorite ? 'url(#star-gradient)' : '#9CA3AF'}
                            viewBox="0 0 24 24"
                          >
                            <defs>
                              <linearGradient id="star-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stopColor="#F59E0B" />
                                <stop offset="100%" stopColor="#EF4444" />
                              </linearGradient>
                            </defs>
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                            />
                          </svg>
                        </button>
                        <div>
                          <h3 className="text-xl font-bold text-gray-900 group-hover:text-indigo-600 transition-colors">
                            {search.name}
                          </h3>
                          <div className="flex items-center gap-3 mt-2 text-sm text-gray-500">
                            <span className="flex items-center gap-1.5">
                              <div className="w-2 h-2 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500" />
                              {search.search_type === 'cv' ? 'CV' : search.search_type === 'linkedin' ? 'LinkedIn' : 'Standard'}
                            </span>
                            <span className="text-gray-300">|</span>
                            <span>{new Date(search.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                          </div>
                        </div>
                      </div>
                      <div
                        className={`px-4 py-1.5 rounded-full text-sm font-medium ${
                          search.status === 'completed'
                            ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/30'
                            : 'bg-gradient-to-r from-amber-400 to-orange-500 text-white shadow-lg shadow-amber-500/30 animate-pulse'
                        }`}
                      >
                        {search.status === 'completed' ? 'Termine' : 'En cours'}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {/* Floating action button */}
          {searches.length > 0 && (
            <div className="fixed bottom-8 right-8 md:right-12">
              <Button
                onClick={() => router.push('/new-search')}
                className="w-14 h-14 rounded-2xl bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-600 hover:from-indigo-600 hover:via-purple-600 hover:to-indigo-700 shadow-xl shadow-indigo-500/40 hover:shadow-2xl hover:shadow-indigo-500/50 transition-all duration-300 hover:-translate-y-1"
              >
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                </svg>
              </Button>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  )
}
