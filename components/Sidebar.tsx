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

type SidebarProps = {
  isOpen?: boolean
  onClose?: () => void
}

const navItems = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
    activeColor: 'from-indigo-500 to-purple-500',
  },
  {
    href: '/searches',
    label: 'Mes recherches',
    matchPrefix: true,
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    ),
    activeColor: 'from-blue-500 to-cyan-500',
  },
  {
    href: '/contacts',
    label: 'Mes Contacts',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
    activeColor: 'from-emerald-500 to-teal-500',
  },
  {
    href: '/company',
    label: 'Company Intel',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
    activeColor: 'from-amber-500 to-orange-500',
  },
  {
    href: '/data',
    label: 'Data & Analytics',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    activeColor: 'from-pink-500 to-rose-500',
  },
  {
    href: '/recurrence',
    label: 'Recurrence',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
    ),
    activeColor: 'from-violet-500 to-purple-500',
  },
]

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [favoriteSearches, setFavoriteSearches] = useState<FavoriteSearch[]>([])
  const [favoriteJobs, setFavoriteJobs] = useState<FavoriteJob[]>([])
  const [showFavorites, setShowFavorites] = useState(true)

  useEffect(() => {
    loadFavorites()
  }, [])

  const loadFavorites = async () => {
    const { data: searches } = await supabase
      .from('searches')
      .select('id, name')
      .eq('is_favorite', true)
      .order('created_at', { ascending: false })

    if (searches) setFavoriteSearches(searches)

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

  const handleLinkClick = () => {
    if (onClose) onClose()
  }

  const isActive = (item: typeof navItems[0]) => {
    if (item.matchPrefix) {
      return pathname === item.href || pathname?.startsWith(item.href + '/')
    }
    return pathname === item.href
  }

  return (
    <>
      {/* Backdrop mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed left-0 top-0 h-full w-72 bg-gradient-to-b from-slate-900 via-slate-900 to-indigo-950 flex flex-col z-50 transition-transform duration-300 shadow-2xl ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } md:translate-x-0`}
      >
        {/* Logo */}
        <div className="p-6 border-b border-white/10">
          <Link href="/dashboard" className="flex items-center gap-2" onClick={handleLinkClick}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <span className="text-white font-bold text-lg">P</span>
            </div>
            <span className="text-xl font-bold text-white">
              Push<span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">Profile</span>
            </span>
          </Link>
        </div>

        {/* Navigation principale */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Nouvelle recherche */}
          <Link href="/new-search" onClick={handleLinkClick}>
            <button className="w-full flex items-center justify-center gap-3 px-4 py-3.5 rounded-xl bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-600 text-white font-semibold mb-6 transition-all duration-300 hover:shadow-lg hover:shadow-indigo-500/40 hover:-translate-y-0.5 group">
              <div className="w-6 h-6 rounded-lg bg-white/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                </svg>
              </div>
              Nouvelle recherche
            </button>
          </Link>

          {/* Navigation items */}
          <div className="space-y-1">
            {navItems.map((item) => {
              const active = isActive(item)
              return (
                <Link key={item.href} href={item.href} onClick={handleLinkClick}>
                  <div
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-all duration-200 group ${
                      active
                        ? 'bg-white/10 shadow-lg'
                        : 'hover:bg-white/5'
                    }`}
                  >
                    <div className={`p-2 rounded-lg transition-all duration-200 ${
                      active
                        ? `bg-gradient-to-r ${item.activeColor} shadow-lg`
                        : 'bg-white/5 group-hover:bg-white/10'
                    }`}>
                      <span className={active ? 'text-white' : 'text-gray-400 group-hover:text-white'}>
                        {item.icon}
                      </span>
                    </div>
                    <span className={`font-medium transition-colors ${
                      active ? 'text-white' : 'text-gray-400 group-hover:text-white'
                    }`}>
                      {item.label}
                    </span>
                    {active && (
                      <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                    )}
                  </div>
                </Link>
              )
            })}
          </div>

          {/* Section Favoris */}
          <div className="mt-8">
            <button
              onClick={() => setShowFavorites(!showFavorites)}
              className="flex items-center justify-between w-full px-4 py-2 text-xs font-bold uppercase tracking-widest text-gray-500 hover:text-gray-400 transition-colors"
            >
              <span>Favoris</span>
              <svg
                className={`w-4 h-4 transition-transform duration-200 ${showFavorites ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showFavorites && (
              <div className="mt-3 space-y-1">
                {/* Recherches favorites */}
                {favoriteSearches.length > 0 && (
                  <div className="mb-4">
                    <p className="px-4 py-1.5 text-xs font-medium text-gray-600 uppercase tracking-wider">Recherches</p>
                    {favoriteSearches.map((search) => (
                      <Link key={search.id} href={`/searches/${search.id}`} onClick={handleLinkClick}>
                        <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg hover:bg-white/5 cursor-pointer group transition-colors">
                          <div className="w-6 h-6 rounded-md bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-sm">
                            <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                          </div>
                          <span className="text-sm text-gray-400 group-hover:text-white truncate transition-colors">{search.name}</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}

                {/* Jobs favoris */}
                {favoriteJobs.length > 0 && (
                  <div>
                    <p className="px-4 py-1.5 text-xs font-medium text-gray-600 uppercase tracking-wider">Jobs</p>
                    {favoriteJobs.map((job) => (
                      <Link key={job.id} href={`/searches/${job.search_id}`} onClick={handleLinkClick}>
                        <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg hover:bg-white/5 cursor-pointer group transition-colors">
                          <div className="w-6 h-6 rounded-md bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-sm">
                            <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                          </div>
                          <div className="truncate">
                            <p className="text-sm text-gray-400 group-hover:text-white truncate transition-colors">{job.job_title}</p>
                            <p className="text-xs text-gray-600 truncate">{job.company_name}</p>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}

                {favoriteSearches.length === 0 && favoriteJobs.length === 0 && (
                  <div className="px-4 py-6 text-center">
                    <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-white/5 flex items-center justify-center">
                      <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                      </svg>
                    </div>
                    <p className="text-sm text-gray-600">Aucun favori</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Deconnexion en bas */}
        <div className="p-4 border-t border-white/10">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 transition-all duration-200 group"
          >
            <div className="p-2 rounded-lg bg-white/5 group-hover:bg-red-500/20 transition-colors">
              <svg className="w-5 h-5 group-hover:text-red-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </div>
            <span className="font-medium">Deconnexion</span>
          </button>
        </div>
      </div>
    </>
  )
}
