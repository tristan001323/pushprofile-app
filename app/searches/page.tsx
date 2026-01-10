'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
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
          <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: '#6366F1' }}></div>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="p-8">
        <div className="max-w-5xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold" style={{ color: '#1D3557' }}>Mes recherches</h1>
            <p className="mt-2" style={{ color: '#457B9D' }}>Historique de vos analyses CV</p>
          </div>

          {searches.length === 0 ? (
            <Card className="p-12 text-center shadow-lg">
              <p className="text-lg mb-4" style={{ color: '#457B9D' }}>Aucune recherche pour le moment</p>
              <Button
                onClick={() => router.push('/new-search')}
                style={{ backgroundColor: '#6366F1', color: 'white' }}
              >
                Créer ma première recherche
              </Button>
            </Card>
          ) : (
            <div className="grid gap-4">
              {searches.map((search) => (
                <Link key={search.id} href={`/searches/${search.id}`}>
                  <Card className="p-6 hover:shadow-xl transition-shadow cursor-pointer">
                    <div className="flex justify-between items-start">
                      <div className="flex items-start gap-3">
                        {/* Bouton favori */}
                        <button
                          onClick={(e) => toggleFavorite(e, search.id, search.is_favorite)}
                          className="mt-1 p-1 rounded hover:bg-gray-100 transition-colors"
                        >
                          <svg
                            className="w-5 h-5"
                            fill={search.is_favorite ? '#FBBF24' : 'none'}
                            stroke={search.is_favorite ? '#FBBF24' : '#9CA3AF'}
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
                        <div>
                          <h3 className="text-xl font-semibold" style={{ color: '#1D3557' }}>
                            {search.name}
                          </h3>
                          <div className="flex gap-4 mt-2 text-sm" style={{ color: '#457B9D' }}>
                            <span>Type: {search.search_type === 'cv' ? 'CV' : 'Standard'}</span>
                            <span>•</span>
                            <span>{new Date(search.created_at).toLocaleDateString('fr-FR')}</span>
                          </div>
                        </div>
                      </div>
                      <div
                        className="px-3 py-1 rounded-full text-sm"
                        style={{
                          backgroundColor: search.status === 'completed' ? '#d1f4dd' : '#fef3c7',
                          color: search.status === 'completed' ? '#047857' : '#92400e',
                        }}
                      >
                        {search.status === 'completed' ? 'Terminé' : 'En cours'}
                      </div>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  )
}
