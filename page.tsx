'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function HomePage() {
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.push('/searches')
      } else {
        router.push('/login')
      }
    })
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#F8F9FA' }}>
      <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: '#A8DADC' }}></div>
    </div>
  )
}
