'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import Link from 'next/link'

type Search = {
  id: string
  name: string
  search_type: string
  created_at: string
  status: string
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

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
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
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold" style={{ color: '#1D3557' }}>Mes recherches</h1>
            <p className="mt-2" style={{ color: '#457B9D' }}>Historique de vos analyses CV</p>
          </div>
          <div className="flex gap-4">
            <Button
              onClick={() => router.push('/new-search')}
              style={{ backgroundColor: '#E63946', color: 'white' }}
            >
              + Nouvelle recherche
            </Button>
            <Button variant="outline" onClick={handleLogout}>
              Déconnexion
            </Button>
          </div>
        </div>

        {searches.length === 0 ? (
          <Card className="p-12 text-center shadow-lg">
            <p className="text-lg mb-4" style={{ color: '#457B9D' }}>Aucune recherche pour le moment</p>
            <Button
              onClick={() => router.push('/new-search')}
              style={{ backgroundColor: '#A8DADC', color: 'white' }}
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
  )
}
