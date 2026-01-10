'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

type FavoriteSearch = {
  id: string
  name: string
}

type FavoriteJob = {
  id: string
  job_title: string
  company_name: string
  search_id: string
}

export default function Sidebar() {
  const router = useRouter()
  const pathname = usePathname()
  const [favoriteSearches, setFavoriteSearches] = useState<FavoriteSearch[]>([])
  const [favoriteJobs, setFavoriteJobs] = useState<FavoriteJob[]>([])
  const [isExpanded, setIsExpanded] = useState(true)
  const [showFavorites, setShowFavorites] = useState(true)

  useEffect(() => {
    loadFavorites()
  }, [])

  const loadFavorites = async () => {
    // Charger recherches favorites
    const { data: searches } = await supabase
      .from('searches')
      .select('id, name')
      .eq('is_favorite', true)
      .order('created_at', { ascending: false })

    if (searches) setFavoriteSearches(searches)

    // Charger jobs favoris
    const { data: jobs } = await supabase
      .from('matches')
      .select('id, job_title, company_name, search_id')
      .eq('is_favorite', true)
      .order('created_at', { ascending: false })
      .limit(10)

    if (jobs) setFavoriteJobs(jobs)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="fixed left-0 top-0 h-full w-64 bg-white border-r border-gray-200 flex flex-col z-40">
      {/* Logo */}
      <div className="p-6 border-b border-gray-100">
        <Link href="/searches" className="text-xl font-bold" style={{ color: '#1D3557' }}>
          Push<span style={{ color: '#6366F1' }}>Profile</span>
        </Link>
      </div>

      {/* Navigation principale */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Nouvelle recherche */}
        <Link href="/new-search">
          <button
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-white font-medium mb-6 transition-all hover:opacity-90"
            style={{ backgroundColor: '#6366F1' }}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nouvelle recherche
          </button>
        </Link>

        {/* Mes recherches */}
        <Link href="/searches">
          <div
            className={`flex items-center gap-3 px-4 py-3 rounded-xl mb-2 cursor-pointer transition-colors ${
              pathname === '/searches' ? 'bg-gray-100' : 'hover:bg-gray-50'
            }`}
          >
            <svg className="w-5 h-5" style={{ color: '#457B9D' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <span style={{ color: '#1D3557' }}>Mes recherches</span>
          </div>
        </Link>

        {/* Data / Analytics */}
        <Link href="/data">
          <div
            className={`flex items-center gap-3 px-4 py-3 rounded-xl mb-2 cursor-pointer transition-colors ${
              pathname === '/data' ? 'bg-gray-100' : 'hover:bg-gray-50'
            }`}
          >
            <svg className="w-5 h-5" style={{ color: '#457B9D' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <span style={{ color: '#1D3557' }}>Data</span>
          </div>
        </Link>

        {/* Récurrence */}
        <Link href="/recurrence">
          <div
            className={`flex items-center gap-3 px-4 py-3 rounded-xl mb-2 cursor-pointer transition-colors ${
              pathname === '/recurrence' ? 'bg-gray-100' : 'hover:bg-gray-50'
            }`}
          >
            <svg className="w-5 h-5" style={{ color: '#457B9D' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span style={{ color: '#1D3557' }}>Récurrence</span>
          </div>
        </Link>

        {/* Section Favoris */}
        <div className="mt-6">
          <button
            onClick={() => setShowFavorites(!showFavorites)}
            className="flex items-center justify-between w-full px-4 py-2 text-sm font-semibold uppercase tracking-wider"
            style={{ color: '#457B9D' }}
          >
            <span>Favoris</span>
            <svg
              className={`w-4 h-4 transition-transform ${showFavorites ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showFavorites && (
            <div className="mt-2 space-y-1">
              {/* Recherches favorites */}
              {favoriteSearches.length > 0 && (
                <div className="mb-3">
                  <p className="px-4 py-1 text-xs font-medium" style={{ color: '#9CA3AF' }}>Recherches</p>
                  {favoriteSearches.map((search) => (
                    <Link key={search.id} href={`/searches/${search.id}`}>
                      <div className="flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                        <svg className="w-4 h-4 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                        <span className="text-sm truncate" style={{ color: '#1D3557' }}>{search.name}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}

              {/* Jobs favoris */}
              {favoriteJobs.length > 0 && (
                <div>
                  <p className="px-4 py-1 text-xs font-medium" style={{ color: '#9CA3AF' }}>Jobs</p>
                  {favoriteJobs.map((job) => (
                    <Link key={job.id} href={`/searches/${job.search_id}`}>
                      <div className="flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                        <svg className="w-4 h-4 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                        <div className="truncate">
                          <p className="text-sm truncate" style={{ color: '#1D3557' }}>{job.job_title}</p>
                          <p className="text-xs truncate" style={{ color: '#9CA3AF' }}>{job.company_name}</p>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}

              {favoriteSearches.length === 0 && favoriteJobs.length === 0 && (
                <p className="px-4 py-2 text-sm" style={{ color: '#9CA3AF' }}>Aucun favori</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Déconnexion en bas */}
      <div className="p-4 border-t border-gray-100">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-600 hover:bg-gray-50 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Déconnexion
        </button>
      </div>
    </div>
  )
}
