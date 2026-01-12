'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import Link from 'next/link'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [resetMode, setResetMode] = useState(false)
  const [resetSent, setResetSent] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push('/searches')
    }
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })

    if (error) {
      setError(error.message)
    } else {
      setResetSent(true)
    }
    setLoading(false)
  }

  if (resetMode) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: '#F8F9FA' }}>
        <Card className="w-full max-w-md p-8 shadow-lg">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold" style={{ color: '#1D3557' }}>PushProfile</h1>
            <p className="text-sm mt-2" style={{ color: '#457B9D' }}>Réinitialiser votre mot de passe</p>
          </div>

          {resetSent ? (
            <div className="text-center space-y-4">
              <div className="p-4 rounded-md" style={{ backgroundColor: '#d4edda', color: '#155724' }}>
                Un email de réinitialisation a été envoyé à <strong>{email}</strong>
              </div>
              <p className="text-sm" style={{ color: '#457B9D' }}>
                Vérifiez votre boîte mail et cliquez sur le lien pour réinitialiser votre mot de passe.
              </p>
              <Button
                onClick={() => { setResetMode(false); setResetSent(false); }}
                variant="outline"
                className="w-full"
              >
                Retour à la connexion
              </Button>
            </div>
          ) : (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="votre@email.com"
                  className="mt-1"
                  autoComplete="email"
                />
              </div>

              {error && (
                <div className="p-3 rounded-md text-sm" style={{ backgroundColor: '#fee', color: '#c00' }}>
                  {error}
                </div>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="w-full"
                style={{ backgroundColor: '#E63946', color: 'white' }}
              >
                {loading ? 'Envoi...' : 'Envoyer le lien de réinitialisation'}
              </Button>

              <Button
                type="button"
                onClick={() => setResetMode(false)}
                variant="outline"
                className="w-full"
              >
                Retour à la connexion
              </Button>
            </form>
          )}
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: '#F8F9FA' }}>
      <Card className="w-full max-w-md p-8 shadow-lg">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold" style={{ color: '#1D3557' }}>PushProfile</h1>
          <p className="text-sm mt-2" style={{ color: '#457B9D' }}>Connectez-vous à votre compte</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="votre@email.com"
              className="mt-1"
              autoComplete="email"
            />
          </div>

          <div>
            <Label htmlFor="password">Mot de passe</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              className="mt-1"
              autoComplete="current-password"
            />
          </div>

          <div className="text-right">
            <button
              type="button"
              onClick={() => setResetMode(true)}
              className="text-sm hover:underline"
              style={{ color: '#457B9D' }}
            >
              Mot de passe oublié ?
            </button>
          </div>

          {error && (
            <div className="p-3 rounded-md text-sm" style={{ backgroundColor: '#fee', color: '#c00' }}>
              {error}
            </div>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="w-full"
            style={{ backgroundColor: '#E63946', color: 'white' }}
          >
            {loading ? 'Connexion...' : 'Se connecter'}
          </Button>
        </form>

        <div className="text-center mt-6">
          <p className="text-sm" style={{ color: '#457B9D' }}>
            Pas encore de compte ?{' '}
            <Link href="/signup" className="font-semibold hover:underline" style={{ color: '#A8DADC' }}>
              S'inscrire
            </Link>
          </p>
        </div>
      </Card>
    </div>
  )
}
