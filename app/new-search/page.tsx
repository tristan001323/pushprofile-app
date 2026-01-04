'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function NewSearchPage() {
  const router = useRouter()
  const [cvText, setCvText] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!cvText.trim()) {
      setError('Veuillez coller votre CV')
      return
    }

    setIsLoading(true)
    setError('')

    try {
      const response = await fetch(process.env.NEXT_PUBLIC_N8N_WEBHOOK_URL!, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cv_text: cvText,
          user_id: 'anonymous',
          filename: 'uploaded_cv.pdf'
        }),
      })

      if (!response.ok) {
        throw new Error('Erreur lors de l\'analyse')
      }

      const data = await response.json()
      
      // Vide le textarea après succès
      setCvText('')
      
      // Redirige vers les recherches
      router.push('/searches')
      
    } catch (err) {
      console.error('Error:', err)
      setError('Erreur lors de l\'analyse. Veuillez réessayer.')
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Nouvelle Recherche</CardTitle>
            <CardDescription>
              Collez votre CV ci-dessous pour trouver des opportunités correspondantes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Textarea
                  value={cvText}
                  onChange={(e) => setCvText(e.target.value)}
                  placeholder="Collez votre CV ici..."
                  className="min-h-[400px] font-mono text-sm"
                  disabled={isLoading}
                />
              </div>

              {error && (
                <div className="text-red-600 text-sm">
                  {error}
                </div>
              )}

              <Button 
                type="submit" 
                disabled={isLoading || !cvText.trim()}
                className="w-full"
              >
                {isLoading ? 'Analyse en cours...' : 'Analyser mon CV'}
              </Button>

              {isLoading && (
                <p className="text-sm text-muted text-center">
                  ⏳ Analyse en cours (30-40 secondes)...
                </p>
              )}
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
