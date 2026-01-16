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

  const handleGoogleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/searches`
      }
    })
    if (error) {
      setError(error.message)
    }
  }

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
            style={{ backgroundColor: '#6366F1', color: 'white' }}
          >
            {loading ? 'Connexion...' : 'Se connecter'}
          </Button>
        </form>

        {/* Séparateur */}
        <div className="flex items-center my-6">
          <div className="flex-1 border-t border-gray-200"></div>
          <span className="px-4 text-sm" style={{ color: '#9CA3AF' }}>ou</span>
          <div className="flex-1 border-t border-gray-200"></div>
        </div>

        {/* Bouton Google */}
        <button
          onClick={handleGoogleLogin}
          className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          <span style={{ color: '#1D3557' }} className="font-medium">Continuer avec Google</span>
        </button>

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
