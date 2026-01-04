'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'

export default function NewSearchPage() {
  const router = useRouter()
  const [cvText, setCvText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.push('/login')
      }
    })
  }, [router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Non authentifié')

      const webhookUrl = process.env.NEXT_PUBLIC_N8N_WEBHOOK_URL!
      
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cv_text: cvText,
          user_id: user.id,
          filename: 'cv_colle.txt',
        }),
      })

      if (!response.ok) throw new Error('Erreur lors de l\'analyse')

      const result = await response.json()
      router.push(`/searches/${result.search_id}`)
    } catch (err: any) {
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen p-8" style={{ backgroundColor: '#F8F9FA' }}>
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold" style={{ color: '#1D3557' }}>Nouvelle recherche</h1>
          <p className="mt-2" style={{ color: '#457B9D' }}>Collez votre CV ci-dessous pour trouver des opportunités</p>
        </div>

        <Card className="p-6 shadow-lg">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <Label htmlFor="cv">Contenu du CV</Label>
              <Textarea
                id="cv"
                value={cvText}
                onChange={(e) => setCvText(e.target.value)}
                placeholder="Collez le contenu de votre CV ici..."
                className="mt-2 min-h-[400px]"
                required
              />
            </div>

            {error && (
              <div className="p-3 rounded-md text-sm" style={{ backgroundColor: '#fee', color: '#c00' }}>
                {error}
              </div>
            )}

            <div className="flex gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push('/searches')}
                disabled={loading}
              >
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={loading || !cvText.trim()}
                className="flex-1"
                style={{ backgroundColor: '#E63946', color: 'white' }}
              >
                {loading ? 'Analyse en cours...' : 'Analyser le CV'}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  )
}
