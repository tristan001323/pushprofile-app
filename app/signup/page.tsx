'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import Link from 'next/link'

type OnboardingData = {
  companyType: string
  teamSize: string
  role: string
  recruitmentVolume: string
  useCase: string
  source: string
  urgency: string
  contractTypes: string
  mainGoal: string
}

export default function SignupPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [location, setLocation] = useState('')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Onboarding data
  const [onboarding, setOnboarding] = useState<OnboardingData>({
    companyType: '',
    teamSize: '',
    role: '',
    recruitmentVolume: '',
    useCase: '',
    source: '',
    urgency: '',
    contractTypes: '',
    mainGoal: '',
  })

  const isJobSeeker = onboarding.companyType === 'job_seeker'
  const isFreelance = onboarding.companyType === 'freelance'

  // Calcul du nombre total d'étapes selon le profil
  const getTotalSteps = () => {
    if (isJobSeeker) return 6 // Type, Source, Urgency, Contracts, Goal, Signup
    if (isFreelance) return 8 // Type, Role, Volume, UseCase, Source, Urgency, Contracts, Goal, Signup
    return 10 // All questions + Signup
  }

  const updateOnboarding = (key: keyof OnboardingData, value: string) => {
    setOnboarding(prev => ({ ...prev, [key]: value }))
  }

  const nextStep = () => {
    // Logic pour sauter les étapes non pertinentes
    let next = step + 1

    if (step === 1) {
      // Après le type
      if (isJobSeeker) {
        next = 6 // Sauter vers "Comment nous avez-vous connu"
      } else if (isFreelance) {
        next = 3 // Sauter "Taille d'équipe"
      }
    }

    setStep(next)
  }

  const prevStep = () => {
    let prev = step - 1

    if (step === 6 && isJobSeeker) {
      prev = 1 // Retour au type
    } else if (step === 3 && isFreelance) {
      prev = 1 // Retour au type
    }

    setStep(prev)
  }

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data, error: signupError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          onboarding: onboarding
        }
      }
    })

    if (signupError) {
      setError(signupError.message)
      setLoading(false)
    } else {
      // Sauvegarder les données d'onboarding dans une table séparée
      if (data.user) {
        await supabase.from('user_profiles').upsert({
          user_id: data.user.id,
          full_name: fullName,
          company_name: companyName || null,
          location: location,
          phone: phone || null,
          company_type: onboarding.companyType,
          team_size: onboarding.teamSize,
          role: onboarding.role,
          recruitment_volume: onboarding.recruitmentVolume,
          use_case: onboarding.useCase,
          source: onboarding.source,
          urgency: onboarding.urgency,
          contract_types: onboarding.contractTypes,
          main_goal: onboarding.mainGoal,
        })
      }
      router.push('/searches')
    }
  }

  const renderOption = (
    key: keyof OnboardingData,
    value: string,
    label: string,
    emoji?: string
  ) => (
    <button
      type="button"
      onClick={() => {
        updateOnboarding(key, value)
      }}
      className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
        onboarding[key] === value
          ? 'border-indigo-500 bg-indigo-50'
          : 'border-gray-200 hover:border-gray-300'
      }`}
    >
      <span className="flex items-center gap-3">
        {emoji && <span className="text-xl">{emoji}</span>}
        <span className={onboarding[key] === value ? 'font-semibold text-indigo-700' : 'text-gray-700'}>
          {label}
        </span>
      </span>
    </button>
  )

  const canProceed = () => {
    switch (step) {
      case 1: return !!onboarding.companyType
      case 2: return !!onboarding.teamSize
      case 3: return !!onboarding.role
      case 4: return !!onboarding.recruitmentVolume
      case 5: return !!onboarding.useCase
      case 6: return !!onboarding.source
      case 7: return !!onboarding.urgency
      case 8: return !!onboarding.contractTypes
      case 9: return !!onboarding.mainGoal
      default: return true
    }
  }

  const totalSteps = getTotalSteps()
  const progressPercent = (step / totalSteps) * 100

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: '#F8F9FA' }}>
      <Card className="w-full max-w-lg p-8 shadow-lg">
        {/* Header */}
        <div className="text-center mb-6">
          <Link href="/">
            <h1 className="text-2xl font-bold" style={{ color: '#1D3557' }}>
              Push<span style={{ color: '#6366F1' }}>Profile</span>
            </h1>
          </Link>
        </div>

        {/* Progress bar */}
        <div className="mb-8">
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full transition-all duration-300"
              style={{ width: `${progressPercent}%`, backgroundColor: '#6366F1' }}
            />
          </div>
          <p className="text-xs text-center mt-2" style={{ color: '#457B9D' }}>
            Étape {step} sur {totalSteps}
          </p>
        </div>

        {/* Step 1: Type d'organisation */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="text-center mb-6">
              <h2 className="text-xl font-bold" style={{ color: '#1D3557' }}>Bienvenue ! Qui êtes-vous ?</h2>
              <p className="text-sm mt-2" style={{ color: '#457B9D' }}>Cela nous aide à personnaliser votre expérience</p>
            </div>
            <div className="space-y-3">
              {renderOption('companyType', 'freelance', 'Freelance / Indépendant', '👤')}
              {renderOption('companyType', 'startup', 'Startup (< 3 ans)', '🚀')}
              {renderOption('companyType', 'pme', 'PME', '🏢')}
              {renderOption('companyType', 'cabinet', 'Cabinet de recrutement', '🎯')}
              {renderOption('companyType', 'esn', 'ESN / Cabinet de conseil', '💼')}
              {renderOption('companyType', 'grand_groupe', 'Grand groupe', '🏛️')}
              {renderOption('companyType', 'job_seeker', 'Je cherche un job', '🔍')}
            </div>
          </div>
        )}

        {/* Step 2: Taille d'équipe */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="text-center mb-6">
              <h2 className="text-xl font-bold" style={{ color: '#1D3557' }}>Quelle est la taille de votre équipe ?</h2>
            </div>
            <div className="space-y-3">
              {renderOption('teamSize', '1-10', '1 à 10 personnes', '👥')}
              {renderOption('teamSize', '11-50', '11 à 50 personnes', '👥')}
              {renderOption('teamSize', '51-200', '51 à 200 personnes', '🏢')}
              {renderOption('teamSize', '200+', 'Plus de 200 personnes', '🏛️')}
            </div>
          </div>
        )}

        {/* Step 3: Rôle */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="text-center mb-6">
              <h2 className="text-xl font-bold" style={{ color: '#1D3557' }}>Quel est votre rôle principal ?</h2>
            </div>
            <div className="space-y-3">
              {renderOption('role', 'recruiter', 'Recruteur / RH', '🎯')}
              {renderOption('role', 'founder', 'Fondateur / Dirigeant', '👔')}
              {renderOption('role', 'manager', 'Manager opérationnel', '📊')}
              {renderOption('role', 'sales', 'Commercial / Business Developer', '💼')}
            </div>
          </div>
        )}

        {/* Step 4: Volume de recrutement */}
        {step === 4 && (
          <div className="space-y-4">
            <div className="text-center mb-6">
              <h2 className="text-xl font-bold" style={{ color: '#1D3557' }}>Combien de postes recrutez-vous par an ?</h2>
            </div>
            <div className="space-y-3">
              {renderOption('recruitmentVolume', '1-5', '1 à 5 postes', '📝')}
              {renderOption('recruitmentVolume', '6-20', '6 à 20 postes', '📋')}
              {renderOption('recruitmentVolume', '21-50', '21 à 50 postes', '📊')}
              {renderOption('recruitmentVolume', '50+', 'Plus de 50 postes', '🚀')}
            </div>
          </div>
        )}

        {/* Step 5: Cas d'usage */}
        {step === 5 && (
          <div className="space-y-4">
            <div className="text-center mb-6">
              <h2 className="text-xl font-bold" style={{ color: '#1D3557' }}>
                {isJobSeeker ? 'Que recherchez-vous ?' : 'Votre cas d\'usage prioritaire ?'}
              </h2>
            </div>
            <div className="space-y-3">
              {isJobSeeker ? (
                <>
                  {renderOption('useCase', 'find_job', 'Trouver un job qui me correspond', '🎯')}
                </>
              ) : (
                <>
                  {renderOption('useCase', 'find_jobs', 'Trouver des jobs pour mes candidats', '📋')}
                  {renderOption('useCase', 'find_candidates', 'Trouver des candidats pour mes postes', '👥')}
                  {renderOption('useCase', 'both', 'Les deux', '🔄')}
                </>
              )}
            </div>
          </div>
        )}

        {/* Step 6: Source */}
        {step === 6 && (
          <div className="space-y-4">
            <div className="text-center mb-6">
              <h2 className="text-xl font-bold" style={{ color: '#1D3557' }}>Comment nous avez-vous connu ?</h2>
            </div>
            <div className="space-y-3">
              {renderOption('source', 'linkedin', 'LinkedIn', '💼')}
              {renderOption('source', 'word_of_mouth', 'Bouche à oreille', '🗣️')}
              {renderOption('source', 'google', 'Google', '🔍')}
              {renderOption('source', 'other', 'Autre', '💡')}
            </div>
          </div>
        )}

        {/* Step 7: Urgence */}
        {step === 7 && (
          <div className="space-y-4">
            <div className="text-center mb-6">
              <h2 className="text-xl font-bold" style={{ color: '#1D3557' }}>Quelle est l'urgence de votre besoin ?</h2>
            </div>
            <div className="space-y-3">
              {renderOption('urgency', 'immediate', 'Immédiat', '⚡')}
              {renderOption('urgency', '1-3months', 'Dans 1 à 3 mois', '📅')}
              {renderOption('urgency', 'exploration', 'Je suis en exploration', '🔭')}
            </div>
          </div>
        )}

        {/* Step 8: Types de contrats */}
        {step === 8 && (
          <div className="space-y-4">
            <div className="text-center mb-6">
              <h2 className="text-xl font-bold" style={{ color: '#1D3557' }}>
                {isJobSeeker ? 'Quel type de contrat recherchez-vous ?' : 'Types de contrats que vous proposez ?'}
              </h2>
            </div>
            <div className="space-y-3">
              {renderOption('contractTypes', 'cdi', 'CDI', '📝')}
              {renderOption('contractTypes', 'freelance', 'Freelance / Mission', '💼')}
              {renderOption('contractTypes', 'both', 'Les deux', '🔄')}
            </div>
          </div>
        )}

        {/* Step 9: Objectif principal */}
        {step === 9 && (
          <div className="space-y-4">
            <div className="text-center mb-6">
              <h2 className="text-xl font-bold" style={{ color: '#1D3557' }}>Votre objectif principal ?</h2>
            </div>
            <div className="space-y-3">
              {renderOption('mainGoal', 'save_time', 'Gagner du temps', '⏱️')}
              {renderOption('mainGoal', 'reduce_costs', 'Réduire les coûts', '💰')}
              {renderOption('mainGoal', 'improve_quality', 'Améliorer la qualité', '✨')}
              {renderOption('mainGoal', 'test', 'Je veux juste tester le service', '🧪')}
            </div>
          </div>
        )}

        {/* Step 10: Formulaire d'inscription */}
        {step === 10 && (
          <div className="space-y-4">
            <div className="text-center mb-6">
              <div className="text-5xl mb-4">🎯</div>
              <h2 className="text-xl font-bold" style={{ color: '#1D3557' }}>Merci pour vos réponses !</h2>
              <p className="text-sm mt-3 px-4 py-3 rounded-xl" style={{ backgroundColor: '#F1FAEE', color: '#1D3557' }}>
                {isJobSeeker
                  ? "Vous êtes à deux doigts de devenir un chasseur de jobs d'élite. 🏹 Fini les heures perdues sur LinkedIn !"
                  : "Vous êtes à deux doigts de devenir un sniper du recrutement. 🎯 Vos concurrents vont pleurer."
                }
              </p>
              <p className="text-sm mt-4" style={{ color: '#457B9D' }}>Créez votre compte pour commencer</p>
            </div>

            <form onSubmit={handleSignup} className="space-y-4">
              {/* Nom complet */}
              <div>
                <Label htmlFor="fullName">Nom complet *</Label>
                <Input
                  id="fullName"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  placeholder="Jean Dupont"
                  className="mt-1"
                  autoComplete="name"
                />
              </div>

              {/* Email */}
              <div>
                <Label htmlFor="email">Email *</Label>
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

              {/* Nom de la société (pas pour les chercheurs d'emploi) */}
              {!isJobSeeker && (
                <div>
                  <Label htmlFor="companyName">Nom de la société *</Label>
                  <Input
                    id="companyName"
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    required
                    placeholder="Acme Inc."
                    className="mt-1"
                    autoComplete="organization"
                  />
                </div>
              )}

              {/* Localisation */}
              <div>
                <Label htmlFor="location">Localisation *</Label>
                <Input
                  id="location"
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  required
                  placeholder="Paris, France"
                  className="mt-1"
                  autoComplete="address-level2"
                />
              </div>

              {/* Téléphone (optionnel) */}
              <div>
                <Label htmlFor="phone">Téléphone <span className="text-gray-400">(optionnel)</span></Label>
                <Input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+33 6 12 34 56 78"
                  className="mt-1"
                  autoComplete="tel"
                />
              </div>

              {/* Mot de passe */}
              <div>
                <Label htmlFor="password">Mot de passe *</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="mt-1"
                  minLength={8}
                  autoComplete="new-password"
                />
                <p className="text-xs mt-1" style={{ color: '#457B9D' }}>Minimum 8 caractères</p>
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
                {loading ? 'Création...' : 'Créer mon compte'}
              </Button>
            </form>
          </div>
        )}

        {/* Navigation buttons */}
        {step < 10 && (
          <div className="flex gap-3 mt-8">
            {step > 1 && (
              <Button
                type="button"
                variant="outline"
                onClick={prevStep}
                className="flex-1"
              >
                Retour
              </Button>
            )}
            <Button
              type="button"
              onClick={nextStep}
              disabled={!canProceed()}
              className="flex-1"
              style={{ backgroundColor: canProceed() ? '#6366F1' : '#E5E7EB', color: canProceed() ? 'white' : '#9CA3AF' }}
            >
              Continuer
            </Button>
          </div>
        )}

        {/* Lien connexion */}
        <div className="text-center mt-6">
          <p className="text-sm" style={{ color: '#457B9D' }}>
            Déjà un compte ?{' '}
            <Link href="/login" className="font-semibold hover:underline" style={{ color: '#6366F1' }}>
              Se connecter
            </Link>
          </p>
        </div>
      </Card>
    </div>
  )
}
