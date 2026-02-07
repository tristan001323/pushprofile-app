'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import Image from 'next/image'

export default function LandingPage() {
  const router = useRouter()
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [isAnnual, setIsAnnual] = useState(false)
  const [waitlistEmail, setWaitlistEmail] = useState('')
  const [waitlistSubmitted, setWaitlistSubmitted] = useState(false)
  const [waitlistLoading, setWaitlistLoading] = useState(false)

  const handleWaitlistSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!waitlistEmail) return

    setWaitlistLoading(true)

    // Sauvegarder l'email dans Supabase
    await supabase.from('waitlist').insert({
      email: waitlistEmail,
      created_at: new Date().toISOString()
    })

    setWaitlistSubmitted(true)
    setWaitlistLoading(false)
  }

  useEffect(() => {
    // Vérifier la session existante
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        // Utilisateur connecté -> rediriger vers "Mon espace"
        router.push('/dashboard')
      } else {
        setIsLoggedIn(false)
        setCheckingAuth(false)
      }
    })

    // Écouter les événements d'authentification
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        router.push('/reset-password')
      } else if (event === 'SIGNED_IN' && session) {
        // Rediriger après connexion
        router.push('/dashboard')
      }
    })

    return () => subscription.unsubscribe()
  }, [router])

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#F8F9FA' }}>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: '#A8DADC' }}></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F8F9FA' }}>
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="text-2xl font-bold" style={{ color: '#1D3557' }}>
              Push<span style={{ color: '#6366F1' }}>Profile</span>
            </div>
            <span className="px-2 py-1 text-xs font-semibold rounded-full" style={{ backgroundColor: '#FEF3C7', color: '#92400E' }}>
              BETA
            </span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            <a href="#fonctionnalites" className="text-sm font-medium hover:text-gray-900" style={{ color: '#457B9D' }}>Fonctionnalités</a>
            <a href="#tarifs" className="text-sm font-medium hover:text-gray-900" style={{ color: '#457B9D' }}>Tarifs</a>
            <a href="#temoignages" className="text-sm font-medium hover:text-gray-900" style={{ color: '#457B9D' }}>Témoignages</a>
          </div>
          <div className="flex items-center gap-4">
            {isLoggedIn ? (
              <Link href="/searches">
                <Button style={{ backgroundColor: '#6366F1', color: 'white' }}>
                  Mon espace
                </Button>
              </Link>
            ) : (
              <>
                <Link href="/login">
                  <Button variant="ghost" style={{ color: '#1D3557' }}>Connexion</Button>
                </Link>
                <Link href="/signup">
                  <Button style={{ backgroundColor: '#6366F1', color: 'white' }}>
                    Essai gratuit
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-7xl mx-auto">
          {/* Badge */}
          <div className="flex justify-center mb-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium" style={{ backgroundColor: '#F1FAEE', color: '#1D3557' }}>
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
              Gagnez du temps et visez juste — ça n'a pas de prix
            </div>
          </div>

          <div className="text-center max-w-4xl mx-auto">
            <h1 className="text-5xl md:text-6xl font-bold leading-tight mb-6" style={{ color: '#1D3557' }}>
              Arrêtez de payer pour 5 outils.
              <br />
              <span style={{ color: '#6366F1' }}>PushProfile fait tout.</span>
            </h1>
            <p className="text-xl mb-8" style={{ color: '#457B9D' }}>
              Matching CV-Job • Sourcing • Contacts • Multi-sources
              <br />
              <span className="font-medium">Recherche intelligente assistée par IA</span>
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
              <Link href="/signup">
                <Button size="lg" className="text-lg px-8 py-6" style={{ backgroundColor: '#6366F1', color: 'white' }}>
                  Essayer gratuitement
                </Button>
              </Link>
            </div>

            <div className="flex flex-wrap justify-center gap-6 text-sm" style={{ color: '#457B9D' }}>
              <span className="flex items-center gap-2">
                <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Gratuit pour tester
              </span>
              <span className="flex items-center gap-2">
                <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Sans carte bancaire
              </span>
              <span className="flex items-center gap-2">
                <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Setup en 30 secondes
              </span>
            </div>
          </div>

          {/* Comment ça marche - 4 étapes */}
          <div className="mt-20 mb-8">
            <h3 className="text-center text-2xl font-bold mb-12" style={{ color: '#1D3557' }}>Comment ça marche ?</h3>

            {/* Version desktop */}
            <div className="hidden md:block max-w-5xl mx-auto px-8">
              <div className="grid grid-cols-4 gap-8">
                {/* Étape 1 */}
                <div className="relative">
                  <div className="bg-white rounded-2xl p-6 shadow-lg border-2 border-indigo-100 hover:border-indigo-300 transition-colors h-full">
                    <div className="w-14 h-14 rounded-xl bg-indigo-100 flex items-center justify-center mb-4">
                      <span className="text-3xl">📄</span>
                    </div>
                    <div className="text-indigo-500 text-sm font-bold mb-2">Étape 1</div>
                    <h4 className="font-bold mb-2" style={{ color: '#1D3557' }}>Upload ou Critères</h4>
                    <p className="text-sm" style={{ color: '#457B9D' }}>CV en PDF/DOCX ou définissez vos critères de recherche</p>
                  </div>
                  {/* Connecteur */}
                  <div className="hidden md:block absolute top-1/2 -right-4 w-8 h-0.5 bg-indigo-200"></div>
                </div>

                {/* Étape 2 */}
                <div className="relative">
                  <div className="bg-white rounded-2xl p-6 shadow-lg border-2 border-indigo-100 hover:border-indigo-300 transition-colors h-full">
                    <div className="w-14 h-14 rounded-xl bg-indigo-100 flex items-center justify-center mb-4">
                      <span className="text-3xl">🔍</span>
                    </div>
                    <div className="text-indigo-500 text-sm font-bold mb-2">Étape 2</div>
                    <h4 className="font-bold mb-2" style={{ color: '#1D3557' }}>Analyse IA</h4>
                    <p className="text-sm" style={{ color: '#457B9D' }}>Notre algorithme scanne 50K+ offres en quelques secondes</p>
                  </div>
                  {/* Connecteur */}
                  <div className="hidden md:block absolute top-1/2 -right-4 w-8 h-0.5 bg-indigo-200"></div>
                </div>

                {/* Étape 3 */}
                <div className="relative">
                  <div className="bg-white rounded-2xl p-6 shadow-lg border-2 border-indigo-100 hover:border-indigo-300 transition-colors h-full">
                    <div className="w-14 h-14 rounded-xl bg-indigo-100 flex items-center justify-center mb-4">
                      <span className="text-3xl">🎯</span>
                    </div>
                    <div className="text-indigo-500 text-sm font-bold mb-2">Étape 3</div>
                    <h4 className="font-bold mb-2" style={{ color: '#1D3557' }}>~50 Jobs matchés</h4>
                    <p className="text-sm" style={{ color: '#457B9D' }}>Les meilleures offres scorées avec explications détaillées</p>
                  </div>
                  {/* Connecteur */}
                  <div className="hidden md:block absolute top-1/2 -right-4 w-8 h-0.5 bg-green-200"></div>
                </div>

                {/* Étape 4 */}
                <div className="relative">
                  <div className="bg-white rounded-2xl p-6 shadow-lg border-2 border-green-100 hover:border-green-300 transition-colors h-full">
                    <div className="w-14 h-14 rounded-xl bg-green-100 flex items-center justify-center mb-4">
                      <span className="text-3xl">📞</span>
                    </div>
                    <div className="text-green-600 text-sm font-bold mb-2">Étape 4</div>
                    <h4 className="font-bold mb-2" style={{ color: '#1D3557' }}>Contacts Directs</h4>
                    <p className="text-sm" style={{ color: '#457B9D' }}>Coordonnées des personnes ayant publié l'offre</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Version mobile */}
            <div className="md:hidden px-6">
              <div className="space-y-4">
                {/* Étape 1 */}
                <div className="bg-white rounded-xl p-5 shadow-md border-l-4 border-indigo-500">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-2xl">📄</span>
                    </div>
                    <div>
                      <div className="text-indigo-500 text-xs font-bold mb-1">Étape 1</div>
                      <h4 className="font-bold mb-1" style={{ color: '#1D3557' }}>Upload ou Critères</h4>
                      <p className="text-sm" style={{ color: '#457B9D' }}>CV en PDF/DOCX ou définissez vos critères</p>
                    </div>
                  </div>
                </div>

                {/* Étape 2 */}
                <div className="bg-white rounded-xl p-5 shadow-md border-l-4 border-indigo-500">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-2xl">🔍</span>
                    </div>
                    <div>
                      <div className="text-indigo-500 text-xs font-bold mb-1">Étape 2</div>
                      <h4 className="font-bold mb-1" style={{ color: '#1D3557' }}>Analyse IA</h4>
                      <p className="text-sm" style={{ color: '#457B9D' }}>Scan de 50K+ offres en quelques secondes</p>
                    </div>
                  </div>
                </div>

                {/* Étape 3 */}
                <div className="bg-white rounded-xl p-5 shadow-md border-l-4 border-indigo-500">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-2xl">🎯</span>
                    </div>
                    <div>
                      <div className="text-indigo-500 text-xs font-bold mb-1">Étape 3</div>
                      <h4 className="font-bold mb-1" style={{ color: '#1D3557' }}>~50 Jobs matchés</h4>
                      <p className="text-sm" style={{ color: '#457B9D' }}>Les meilleures offres avec explications</p>
                    </div>
                  </div>
                </div>

                {/* Étape 4 */}
                <div className="bg-white rounded-xl p-5 shadow-md border-l-4 border-green-500">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-2xl">📞</span>
                    </div>
                    <div>
                      <div className="text-green-600 text-xs font-bold mb-1">Étape 4</div>
                      <h4 className="font-bold mb-1" style={{ color: '#1D3557' }}>Contacts Directs</h4>
                      <p className="text-sm" style={{ color: '#457B9D' }}>Coordonnées des personnes ayant publié l'offre</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Sources Schema - Premium Design */}
      <section className="py-20 bg-gradient-to-b from-gray-50 to-white overflow-hidden">
        <div className="max-w-7xl mx-auto px-6">
          {/* Header with subtle animation feel */}
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-50 text-indigo-600 text-sm font-medium mb-4">
              <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
              Agrégation en temps réel
            </div>
            <h2 className="text-3xl md:text-4xl font-bold mb-4" style={{ color: '#1D3557' }}>
              Toutes vos sources. Un seul dashboard.
            </h2>
          </div>

          {/* Desktop Layout */}
          <div className="hidden lg:flex items-center justify-center gap-8">
            {/* Job Boards - Left Column */}
            <div className="flex flex-col gap-3">
              {/* LinkedIn */}
              <div className="group flex items-center gap-3 bg-white rounded-2xl px-5 py-4 shadow-lg shadow-gray-100/50 border border-gray-100 hover:border-[#0A66C2]/30 hover:shadow-xl hover:shadow-[#0A66C2]/10 transition-all duration-300 cursor-pointer">
                <div className="w-12 h-12 rounded-xl bg-[#0A66C2] flex items-center justify-center shadow-lg shadow-[#0A66C2]/30">
                  <Image src="/logos/linkedin.svg" alt="LinkedIn" width={28} height={28} className="brightness-0 invert" />
                </div>
                <div>
                  <span className="font-semibold text-gray-900">LinkedIn</span>
                  <p className="text-xs text-gray-500">Jobs & Posts</p>
                </div>
              </div>
              {/* Indeed */}
              <div className="group flex items-center gap-3 bg-white rounded-2xl px-5 py-4 shadow-lg shadow-gray-100/50 border border-gray-100 hover:border-[#2164F3]/30 hover:shadow-xl hover:shadow-[#2164F3]/10 transition-all duration-300 cursor-pointer">
                <div className="w-12 h-12 rounded-xl bg-[#2164F3] flex items-center justify-center shadow-lg shadow-[#2164F3]/30">
                  <Image src="/logos/indeed.svg" alt="Indeed" width={28} height={28} className="brightness-0 invert" />
                </div>
                <div>
                  <span className="font-semibold text-gray-900">Indeed</span>
                  <p className="text-xs text-gray-500">Offres d'emploi</p>
                </div>
              </div>
              {/* Glassdoor */}
              <div className="group flex items-center gap-3 bg-white rounded-2xl px-5 py-4 shadow-lg shadow-gray-100/50 border border-gray-100 hover:border-[#0CAA41]/30 hover:shadow-xl hover:shadow-[#0CAA41]/10 transition-all duration-300 cursor-pointer">
                <div className="w-12 h-12 rounded-xl bg-[#0CAA41] flex items-center justify-center shadow-lg shadow-[#0CAA41]/30">
                  <Image src="/logos/glassdoor.svg" alt="Glassdoor" width={28} height={28} className="brightness-0 invert" />
                </div>
                <div>
                  <span className="font-semibold text-gray-900">Glassdoor</span>
                  <p className="text-xs text-gray-500">Jobs & Avis</p>
                </div>
              </div>
              {/* WTTJ */}
              <div className="group flex items-center gap-3 bg-white rounded-2xl px-5 py-4 shadow-lg shadow-gray-100/50 border border-gray-100 hover:border-[#FFCD00]/50 hover:shadow-xl hover:shadow-[#FFCD00]/10 transition-all duration-300 cursor-pointer">
                <div className="w-12 h-12 rounded-xl bg-[#FFCD00] flex items-center justify-center shadow-lg shadow-[#FFCD00]/30">
                  <Image src="/logos/wttj.svg" alt="WTTJ" width={28} height={28} />
                </div>
                <div>
                  <span className="font-semibold text-gray-900">WTTJ</span>
                  <p className="text-xs text-gray-500">Welcome to the Jungle</p>
                </div>
              </div>
              {/* HelloWork */}
              <div className="group flex items-center gap-3 bg-white rounded-2xl px-5 py-4 shadow-lg shadow-gray-100/50 border border-gray-100 hover:border-gray-300 hover:shadow-xl transition-all duration-300 cursor-pointer">
                <div className="w-12 h-12 rounded-xl bg-white border-2 border-gray-200 flex items-center justify-center">
                  <Image src="/logos/hellowork.svg" alt="HelloWork" width={32} height={32} />
                </div>
                <div>
                  <span className="font-semibold text-gray-900">HelloWork</span>
                  <p className="text-xs text-gray-500">Offres France</p>
                </div>
              </div>
            </div>

            {/* Animated Arrows Left */}
            <div className="flex flex-col items-center gap-2 px-4">
              <div className="flex items-center">
                <div className="w-16 h-0.5 bg-gradient-to-r from-gray-200 to-indigo-400"></div>
                <svg className="w-6 h-6 text-indigo-500 -ml-1" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </div>
              <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Job Boards</span>
            </div>

            {/* Center Result Card - Hero Element */}
            <div className="relative">
              {/* Glow effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-3xl blur-2xl opacity-20 scale-105"></div>

              <div className="relative bg-gradient-to-br from-indigo-600 via-indigo-500 to-purple-600 rounded-3xl p-8 text-white shadow-2xl shadow-indigo-500/30 min-w-[320px]">
                {/* Decorative elements */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2"></div>
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2"></div>

                <div className="relative">
                  {/* Icon */}
                  <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center">
                    <span className="text-3xl">🎯</span>
                  </div>

                  {/* Title */}
                  <h3 className="text-xl font-bold text-center mb-6">Vos résultats</h3>

                  {/* Features */}
                  <ul className="space-y-3">
                    <li className="flex items-center gap-3 bg-white/10 backdrop-blur rounded-xl px-4 py-2.5">
                      <div className="w-6 h-6 rounded-full bg-green-400 flex items-center justify-center flex-shrink-0">
                        <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <span className="font-medium">~50 jobs pertinents</span>
                    </li>
                    <li className="flex items-center gap-3 bg-white/10 backdrop-blur rounded-xl px-4 py-2.5">
                      <div className="w-6 h-6 rounded-full bg-green-400 flex items-center justify-center flex-shrink-0">
                        <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <span className="font-medium">Scoring IA intelligent</span>
                    </li>
                    <li className="flex items-center gap-3 bg-white/10 backdrop-blur rounded-xl px-4 py-2.5">
                      <div className="w-6 h-6 rounded-full bg-green-400 flex items-center justify-center flex-shrink-0">
                        <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <span className="font-medium">Contacts directs</span>
                    </li>
                    <li className="flex items-center gap-3 bg-white/10 backdrop-blur rounded-xl px-4 py-2.5">
                      <div className="w-6 h-6 rounded-full bg-green-400 flex items-center justify-center flex-shrink-0">
                        <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <span className="font-medium">Dédupliqués & classés</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Animated Arrows Right */}
            <div className="flex flex-col items-center gap-2 px-4">
              <div className="flex items-center">
                <svg className="w-6 h-6 text-emerald-500 -mr-1 rotate-180" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
                <div className="w-16 h-0.5 bg-gradient-to-l from-gray-200 to-emerald-400"></div>
              </div>
              <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">ATS Directs</span>
            </div>

            {/* ATS - Right Column */}
            <div className="flex flex-col gap-3">
              {/* Greenhouse */}
              <div className="group flex items-center gap-3 bg-white rounded-2xl px-5 py-4 shadow-lg shadow-gray-100/50 border border-gray-100 hover:border-[#4CB398]/30 hover:shadow-xl hover:shadow-[#4CB398]/10 transition-all duration-300 cursor-pointer">
                <div className="w-12 h-12 rounded-xl bg-[#4CB398] flex items-center justify-center shadow-lg shadow-[#4CB398]/30">
                  <Image src="/logos/greenhouse.svg" alt="Greenhouse" width={28} height={28} className="brightness-0 invert" />
                </div>
                <div>
                  <span className="font-semibold text-gray-900">Greenhouse</span>
                  <p className="text-xs text-gray-500">ATS Enterprise</p>
                </div>
              </div>
              {/* Lever */}
              <div className="group flex items-center gap-3 bg-white rounded-2xl px-5 py-4 shadow-lg shadow-gray-100/50 border border-gray-100 hover:border-[#6C5CE7]/30 hover:shadow-xl hover:shadow-[#6C5CE7]/10 transition-all duration-300 cursor-pointer">
                <div className="w-12 h-12 rounded-xl bg-[#6C5CE7] flex items-center justify-center shadow-lg shadow-[#6C5CE7]/30">
                  <Image src="/logos/lever.svg" alt="Lever" width={28} height={28} className="brightness-0 invert" />
                </div>
                <div>
                  <span className="font-semibold text-gray-900">Lever</span>
                  <p className="text-xs text-gray-500">ATS Startups</p>
                </div>
              </div>
              {/* Workday */}
              <div className="group flex items-center gap-3 bg-white rounded-2xl px-5 py-4 shadow-lg shadow-gray-100/50 border border-gray-100 hover:border-[#0057AE]/30 hover:shadow-xl hover:shadow-[#0057AE]/10 transition-all duration-300 cursor-pointer">
                <div className="w-12 h-12 rounded-xl bg-[#0057AE] flex items-center justify-center shadow-lg shadow-[#0057AE]/30">
                  <Image src="/logos/workday.svg" alt="Workday" width={28} height={28} className="brightness-0 invert" />
                </div>
                <div>
                  <span className="font-semibold text-gray-900">Workday</span>
                  <p className="text-xs text-gray-500">ATS Corporate</p>
                </div>
              </div>
              {/* Ashby */}
              <div className="group flex items-center gap-3 bg-white rounded-2xl px-5 py-4 shadow-lg shadow-gray-100/50 border border-gray-100 hover:border-[#5046E5]/30 hover:shadow-xl hover:shadow-[#5046E5]/10 transition-all duration-300 cursor-pointer">
                <div className="w-12 h-12 rounded-xl bg-[#5046E5] flex items-center justify-center shadow-lg shadow-[#5046E5]/30">
                  <Image src="/logos/ashby.svg" alt="Ashby" width={28} height={28} className="brightness-0 invert" />
                </div>
                <div>
                  <span className="font-semibold text-gray-900">Ashby</span>
                  <p className="text-xs text-gray-500">ATS Modern</p>
                </div>
              </div>
              {/* +9 autres */}
              <div className="group flex items-center gap-3 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-2xl px-5 py-4 border border-emerald-200 hover:shadow-xl transition-all duration-300 cursor-pointer">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                  <span className="text-white font-bold text-lg">+9</span>
                </div>
                <div>
                  <span className="font-semibold text-gray-900">Et plus</span>
                  <p className="text-xs text-gray-500">BambooHR, Jobvite...</p>
                </div>
              </div>
            </div>
          </div>

          {/* Mobile Layout */}
          <div className="lg:hidden">
            {/* Center Result Card First on Mobile */}
            <div className="relative mb-8">
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-3xl blur-xl opacity-20 scale-105"></div>
              <div className="relative bg-gradient-to-br from-indigo-600 via-indigo-500 to-purple-600 rounded-3xl p-6 text-white shadow-2xl shadow-indigo-500/30">
                <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center">
                  <span className="text-2xl">🎯</span>
                </div>
                <h3 className="text-lg font-bold text-center mb-4">Vos résultats</h3>
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center gap-2 bg-white/10 rounded-lg px-3 py-2">
                    <svg className="w-4 h-4 text-green-300" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    <span className="text-sm">~50 jobs</span>
                  </div>
                  <div className="flex items-center gap-2 bg-white/10 rounded-lg px-3 py-2">
                    <svg className="w-4 h-4 text-green-300" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    <span className="text-sm">Scoring IA</span>
                  </div>
                  <div className="flex items-center gap-2 bg-white/10 rounded-lg px-3 py-2">
                    <svg className="w-4 h-4 text-green-300" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    <span className="text-sm">Contacts</span>
                  </div>
                  <div className="flex items-center gap-2 bg-white/10 rounded-lg px-3 py-2">
                    <svg className="w-4 h-4 text-green-300" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    <span className="text-sm">Dédupliqués</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Two columns for sources */}
            <div className="grid grid-cols-2 gap-4">
              {/* Job Boards */}
              <div className="space-y-3">
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wider text-center mb-2">Job Boards</p>
                <div className="flex items-center gap-2 bg-white rounded-xl px-3 py-2.5 shadow-md border border-gray-100">
                  <div className="w-8 h-8 rounded-lg bg-[#0A66C2] flex items-center justify-center">
                    <Image src="/logos/linkedin.svg" alt="LinkedIn" width={18} height={18} className="brightness-0 invert" />
                  </div>
                  <span className="text-sm font-medium text-gray-900">LinkedIn</span>
                </div>
                <div className="flex items-center gap-2 bg-white rounded-xl px-3 py-2.5 shadow-md border border-gray-100">
                  <div className="w-8 h-8 rounded-lg bg-[#2164F3] flex items-center justify-center">
                    <Image src="/logos/indeed.svg" alt="Indeed" width={18} height={18} className="brightness-0 invert" />
                  </div>
                  <span className="text-sm font-medium text-gray-900">Indeed</span>
                </div>
                <div className="flex items-center gap-2 bg-white rounded-xl px-3 py-2.5 shadow-md border border-gray-100">
                  <div className="w-8 h-8 rounded-lg bg-[#0CAA41] flex items-center justify-center">
                    <Image src="/logos/glassdoor.svg" alt="Glassdoor" width={18} height={18} className="brightness-0 invert" />
                  </div>
                  <span className="text-sm font-medium text-gray-900">Glassdoor</span>
                </div>
                <div className="flex items-center gap-2 bg-white rounded-xl px-3 py-2.5 shadow-md border border-gray-100">
                  <div className="w-8 h-8 rounded-lg bg-[#FFCD00] flex items-center justify-center">
                    <Image src="/logos/wttj.svg" alt="WTTJ" width={18} height={18} />
                  </div>
                  <span className="text-sm font-medium text-gray-900">WTTJ</span>
                </div>
                <div className="flex items-center gap-2 bg-white rounded-xl px-3 py-2.5 shadow-md border border-gray-100">
                  <div className="w-8 h-8 rounded-lg bg-white border border-gray-200 flex items-center justify-center">
                    <Image src="/logos/hellowork.svg" alt="HelloWork" width={22} height={22} />
                  </div>
                  <span className="text-sm font-medium text-gray-900">HelloWork</span>
                </div>
              </div>

              {/* ATS */}
              <div className="space-y-3">
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wider text-center mb-2">ATS Directs</p>
                <div className="flex items-center gap-2 bg-white rounded-xl px-3 py-2.5 shadow-md border border-emerald-100">
                  <div className="w-8 h-8 rounded-lg bg-[#4CB398] flex items-center justify-center">
                    <Image src="/logos/greenhouse.svg" alt="Greenhouse" width={18} height={18} className="brightness-0 invert" />
                  </div>
                  <span className="text-sm font-medium text-gray-900">Greenhouse</span>
                </div>
                <div className="flex items-center gap-2 bg-white rounded-xl px-3 py-2.5 shadow-md border border-emerald-100">
                  <div className="w-8 h-8 rounded-lg bg-[#6C5CE7] flex items-center justify-center">
                    <Image src="/logos/lever.svg" alt="Lever" width={18} height={18} className="brightness-0 invert" />
                  </div>
                  <span className="text-sm font-medium text-gray-900">Lever</span>
                </div>
                <div className="flex items-center gap-2 bg-white rounded-xl px-3 py-2.5 shadow-md border border-emerald-100">
                  <div className="w-8 h-8 rounded-lg bg-[#0057AE] flex items-center justify-center">
                    <Image src="/logos/workday.svg" alt="Workday" width={18} height={18} className="brightness-0 invert" />
                  </div>
                  <span className="text-sm font-medium text-gray-900">Workday</span>
                </div>
                <div className="flex items-center gap-2 bg-white rounded-xl px-3 py-2.5 shadow-md border border-emerald-100">
                  <div className="w-8 h-8 rounded-lg bg-[#5046E5] flex items-center justify-center">
                    <Image src="/logos/ashby.svg" alt="Ashby" width={18} height={18} className="brightness-0 invert" />
                  </div>
                  <span className="text-sm font-medium text-gray-900">Ashby</span>
                </div>
                <div className="flex items-center gap-2 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl px-3 py-2.5 border border-emerald-200">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
                    <span className="text-white font-bold text-xs">+9</span>
                  </div>
                  <span className="text-sm font-medium text-gray-900">Et plus</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-3 gap-8 max-w-3xl mx-auto">
            <div className="text-center">
              <div className="text-4xl md:text-5xl font-bold mb-2" style={{ color: '#1D3557' }}>30s</div>
              <div style={{ color: '#457B9D' }}>Temps de matching</div>
            </div>
            <div className="text-center">
              <div className="text-4xl md:text-5xl font-bold mb-2" style={{ color: '#1D3557' }}>50+</div>
              <div style={{ color: '#457B9D' }}>Jobs par recherche</div>
            </div>
            <div className="text-center">
              <div className="text-4xl md:text-5xl font-bold mb-2" style={{ color: '#1D3557' }}>3x</div>
              <div style={{ color: '#457B9D' }}>Plus de placements</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="fonctionnalites" className="py-20 px-6 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4" style={{ color: '#1D3557' }}>
              Une recherche qui comprend vraiment votre profil
            </h2>
            <p className="text-xl max-w-2xl mx-auto" style={{ color: '#457B9D' }}>
              Algorithme intelligent boosté par l'IA pour analyser CV et matcher les meilleures offres d'emploi
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-gray-50 rounded-2xl p-8">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-6" style={{ backgroundColor: '#A8DADC' }}>
                <svg className="w-6 h-6" style={{ color: '#1D3557' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold mb-3" style={{ color: '#1D3557' }}>Upload & Analyse</h3>
              <p style={{ color: '#457B9D' }}>
                Uploadez votre CV (PDF, DOCX) ou définissez vos critères. L'algorithme extrait automatiquement compétences, expériences et préférences.
              </p>
            </div>

            <div className="bg-gray-50 rounded-2xl p-8">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-6" style={{ backgroundColor: '#A8DADC' }}>
                <svg className="w-6 h-6" style={{ color: '#1D3557' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold mb-3" style={{ color: '#1D3557' }}>Matching Multi-Sources</h3>
              <p style={{ color: '#457B9D' }}>
                Recherche simultanée sur LinkedIn, Indeed, Glassdoor, WTTJ, HelloWork + directement sur les ATS des entreprises. Fini les heures à chercher partout.
              </p>
            </div>

            <div className="bg-gray-50 rounded-2xl p-8">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-6" style={{ backgroundColor: '#A8DADC' }}>
                <svg className="w-6 h-6" style={{ color: '#1D3557' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold mb-3" style={{ color: '#1D3557' }}>Scoring Intelligent</h3>
              <p style={{ color: '#457B9D' }}>
                Chaque match est scoré avec une explication détaillée. Vous savez POURQUOI cette offre correspond.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 3 Target Customers */}
      <section className="py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4" style={{ color: '#1D3557' }}>
              Pour qui ?
            </h2>
            <p className="text-xl" style={{ color: '#457B9D' }}>
              3 profils, 3 solutions, un seul outil
            </p>
          </div>

          {/* Cabinets de recrutement / conseil */}
          <div className="mb-16">
            <div className="bg-white rounded-3xl shadow-xl overflow-hidden">
              <div className="grid md:grid-cols-2">
                <div className="p-8 md:p-12">
                  <div className="inline-block px-4 py-2 rounded-full text-sm font-medium mb-6" style={{ backgroundColor: '#6366F1', color: 'white' }}>
                    Cabinets de recrutement / conseil
                  </div>

                  {/* Problème / Solution */}
                  <div className="mb-6 p-4 rounded-xl" style={{ backgroundColor: '#FEF2F2' }}>
                    <p className="text-sm font-medium mb-2" style={{ color: '#DC2626' }}>
                      😤 Le problème : Vos CVs dorment dans votre base, faute de jobs pertinents à proposer rapidement.
                    </p>
                    <p className="text-sm font-medium" style={{ color: '#059669' }}>
                      💡 La solution : On inverse le processus - 50 jobs qualifiés par CV en 30 secondes.
                    </p>
                  </div>

                  <h3 className="text-3xl font-bold mb-4" style={{ color: '#1D3557' }}>
                    Placez 3x plus de candidats
                  </h3>
                  <p className="text-lg mb-6" style={{ color: '#457B9D' }}>
                    Arrêtez de payer LinkedIn Recruiter + Apollo + Indeed. PushProfile les remplace tous.
                  </p>
                  <ul className="space-y-4 mb-8">
                    <li className="flex items-start gap-3">
                      <svg className="w-6 h-6 text-green-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      <span style={{ color: '#1D3557' }}>1 CV → 50 jobs pertinents en 30 secondes</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <svg className="w-6 h-6 text-green-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      <span style={{ color: '#1D3557' }}>Gagnez du temps et visez juste — ça n'a pas de prix</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <svg className="w-6 h-6 text-green-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      <span style={{ color: '#1D3557' }}>Multi-sources : LinkedIn, Indeed, Glassdoor, WTTJ + ATS entreprises</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <svg className="w-6 h-6 text-green-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      <span style={{ color: '#1D3557' }}>Prospection ultra-ciblée avec email et téléphone direct</span>
                    </li>
                  </ul>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 px-4 py-2 rounded-full" style={{ backgroundColor: '#F1FAEE' }}>
                      <span className="text-lg">🎁</span>
                      <span className="font-medium" style={{ color: '#1D3557' }}>2 recherches gratuites</span>
                    </div>
                    <Link href="/signup">
                      <Button style={{ backgroundColor: '#6366F1', color: 'white' }}>
                        Tester gratuitement
                      </Button>
                    </Link>
                  </div>
                </div>
                <div className="bg-gradient-to-br p-8 flex items-center justify-center" style={{ backgroundColor: '#F1FAEE' }}>
                  <div className="text-center">
                    <div className="text-8xl mb-4">🏢</div>
                    <p className="font-medium" style={{ color: '#1D3557' }}>Pour les pros du recrutement</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Candidats */}
          <div className="mb-16">
            <div className="bg-white rounded-3xl shadow-xl overflow-hidden">
              <div className="grid md:grid-cols-2">
                <div className="bg-gradient-to-br p-8 flex items-center justify-center order-2 md:order-1" style={{ backgroundColor: '#A8DADC' }}>
                  <div className="text-center">
                    <div className="text-8xl mb-4">🎯</div>
                    <p className="font-medium" style={{ color: '#1D3557' }}>Trouvez le job idéal</p>
                  </div>
                </div>
                <div className="p-8 md:p-12 order-1 md:order-2">
                  <div className="inline-block px-4 py-2 rounded-full text-sm font-medium mb-6" style={{ backgroundColor: '#A8DADC', color: '#1D3557' }}>
                    Candidats
                  </div>
                  <h3 className="text-3xl font-bold mb-4" style={{ color: '#1D3557' }}>
                    Trouvez un job 2x plus vite
                  </h3>
                  <p className="text-lg mb-6" style={{ color: '#457B9D' }}>
                    Fini les 10h/semaine à chercher sur LinkedIn, Indeed, WTTJ, Glassdoor... Uploadez, on fait le reste.
                  </p>
                  <ul className="space-y-4 mb-8">
                    <li className="flex items-start gap-3">
                      <svg className="w-6 h-6 text-green-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      <span style={{ color: '#1D3557' }}>Upload CV → 50 jobs pertinents en 30 secondes</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <svg className="w-6 h-6 text-green-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      <span style={{ color: '#1D3557' }}>Scores expliqués - sachez POURQUOI ça matche</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <svg className="w-6 h-6 text-green-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      <span style={{ color: '#1D3557' }}>Des heures économisées + contacts directs des recruteurs</span>
                    </li>
                  </ul>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 px-4 py-2 rounded-full" style={{ backgroundColor: '#F1FAEE' }}>
                      <span className="text-lg">🎁</span>
                      <span className="font-medium" style={{ color: '#1D3557' }}>2 recherches gratuites</span>
                    </div>
                    <Link href="/signup">
                      <Button style={{ backgroundColor: '#6366F1', color: 'white' }}>
                        Tester gratuitement
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Entreprises - Coming Soon */}
          <div>
            <div className="bg-white rounded-3xl shadow-xl overflow-hidden relative">
              <div className="absolute top-4 right-4 px-4 py-2 rounded-full text-sm font-medium" style={{ backgroundColor: '#457B9D', color: 'white' }}>
                Bientôt disponible
              </div>
              <div className="grid md:grid-cols-2">
                <div className="p-8 md:p-12">
                  <div className="inline-block px-4 py-2 rounded-full text-sm font-medium mb-6" style={{ backgroundColor: '#1D3557', color: 'white' }}>
                    Entreprises
                  </div>
                  <h3 className="text-3xl font-bold mb-4" style={{ color: '#1D3557' }}>
                    Sourcez les meilleurs talents
                  </h3>
                  <p className="text-lg mb-6" style={{ color: '#457B9D' }}>
                    Upload fiche de poste → On cible les candidats "Open to Work" et ceux prêts au changement.
                  </p>
                  <ul className="space-y-4 mb-8">
                    <li className="flex items-start gap-3">
                      <svg className="w-6 h-6 text-green-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      <span style={{ color: '#1D3557' }}>Ciblage des profils "Open to Work" et en veille active</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <svg className="w-6 h-6 text-green-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      <span style={{ color: '#1D3557' }}>Pas besoin de connecter votre LinkedIn (évite les blocages)</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <svg className="w-6 h-6 text-green-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      <span style={{ color: '#1D3557' }}>Contacts enrichis automatiquement</span>
                    </li>
                  </ul>

                  {/* Formulaire liste d'attente */}
                  {waitlistSubmitted ? (
                    <div className="p-4 rounded-xl" style={{ backgroundColor: '#D1FAE5' }}>
                      <p className="text-sm font-medium" style={{ color: '#059669' }}>
                        ✅ Merci ! Vous serez notifié dès la sortie de cette fonctionnalité.
                      </p>
                    </div>
                  ) : (
                    <form onSubmit={handleWaitlistSubmit} className="flex gap-2">
                      <input
                        type="email"
                        value={waitlistEmail}
                        onChange={(e) => setWaitlistEmail(e.target.value)}
                        placeholder="votre@email.com"
                        required
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      />
                      <Button
                        type="submit"
                        disabled={waitlistLoading}
                        style={{ backgroundColor: '#1D3557', color: 'white' }}
                      >
                        {waitlistLoading ? '...' : "M'alerter"}
                      </Button>
                    </form>
                  )}
                </div>
                <div className="bg-gradient-to-br p-8 flex items-center justify-center opacity-75" style={{ backgroundColor: '#1D3557' }}>
                  <div className="text-center">
                    <div className="text-8xl mb-4">🚀</div>
                    <p className="font-medium text-white">Phase 2 - Q2 2026</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="tarifs" className="py-20 px-6 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold mb-4" style={{ color: '#1D3557' }}>
              Tarifs simples et transparents
            </h2>
            <p className="text-xl" style={{ color: '#457B9D' }}>
              Commencez gratuitement, passez Pro quand vous êtes prêt
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Essai Gratuit */}
            <div className="bg-gray-50 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">🎁</span>
                <h3 className="text-lg font-bold" style={{ color: '#1D3557' }}>Essai Gratuit</h3>
              </div>
              <div className="mb-4">
                <span className="text-3xl font-bold" style={{ color: '#1D3557' }}>0€</span>
              </div>
              <p className="text-sm mb-4" style={{ color: '#059669' }}>Pas de CB requise</p>
              <ul className="space-y-2 mb-6 text-sm">
                <li className="flex items-start gap-2" style={{ color: '#1D3557' }}>
                  <svg className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span><strong>2 recherches</strong> CV gratuites</span>
                </li>
                <li className="flex items-start gap-2" style={{ color: '#1D3557' }}>
                  <svg className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span>~50 jobs matchés/recherche</span>
                </li>
                <li className="flex items-start gap-2" style={{ color: '#1D3557' }}>
                  <svg className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span>Scores IA + justifications</span>
                </li>
                <li className="flex items-start gap-2" style={{ color: '#1D3557' }}>
                  <svg className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span>3 décideurs/entreprise (top 10)</span>
                </li>
                <li className="flex items-start gap-2" style={{ color: '#1D3557' }}>
                  <svg className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span>Emails + téléphones enrichis</span>
                </li>
                <li className="flex items-start gap-2" style={{ color: '#1D3557' }}>
                  <svg className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span>Historique 30 jours</span>
                </li>
              </ul>
              <Link href="/signup" className="block">
                <Button variant="outline" className="w-full">
                  Essayer gratuitement
                </Button>
              </Link>
            </div>

            {/* Starter */}
            <div className="bg-white rounded-2xl p-6 border border-gray-200">
              <h3 className="text-lg font-bold mb-2" style={{ color: '#1D3557' }}>Starter</h3>
              <div className="mb-4">
                <span className="text-3xl font-bold" style={{ color: '#1D3557' }}>49€</span>
                <span style={{ color: '#457B9D' }}>/mois</span>
              </div>
              <ul className="space-y-2 mb-6 text-sm">
                <li className="flex items-start gap-2" style={{ color: '#1D3557' }}>
                  <svg className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span><strong>10 recherches</strong> CV/mois</span>
                </li>
                <li className="flex items-start gap-2" style={{ color: '#1D3557' }}>
                  <svg className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span>25 jobs matchés/recherche</span>
                </li>
                <li className="flex items-start gap-2" style={{ color: '#1D3557' }}>
                  <svg className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span>Scores IA + justifications</span>
                </li>
                <li className="flex items-start gap-2" style={{ color: '#1D3557' }}>
                  <svg className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span>3 décideurs/entreprise (top 10)</span>
                </li>
                <li className="flex items-start gap-2" style={{ color: '#1D3557' }}>
                  <svg className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span>Emails enrichis uniquement</span>
                </li>
                <li className="flex items-start gap-2" style={{ color: '#1D3557' }}>
                  <svg className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span>Historique 30 jours</span>
                </li>
                <li className="flex items-start gap-2" style={{ color: '#1D3557' }}>
                  <svg className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span>1 utilisateur</span>
                </li>
              </ul>
              <Link href="/signup" className="block">
                <Button variant="outline" className="w-full">
                  Choisir Starter
                </Button>
              </Link>
            </div>

            {/* Pro - Populaire */}
            <div className="bg-white rounded-2xl p-6 shadow-xl border-2 relative" style={{ borderColor: '#6366F1' }}>
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="px-3 py-1 rounded-full text-xs font-medium" style={{ backgroundColor: '#6366F1', color: 'white' }}>
                  Populaire
                </span>
              </div>
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-lg font-bold" style={{ color: '#1D3557' }}>Pro</h3>
                <span>⭐</span>
              </div>
              <div className="mb-4">
                <span className="text-3xl font-bold" style={{ color: '#1D3557' }}>149€</span>
                <span style={{ color: '#457B9D' }}>/mois</span>
              </div>
              <ul className="space-y-2 mb-6 text-sm">
                <li className="flex items-start gap-2" style={{ color: '#1D3557' }}>
                  <svg className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span><strong>50 recherches</strong> CV/mois</span>
                </li>
                <li className="flex items-start gap-2" style={{ color: '#1D3557' }}>
                  <svg className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span>50 jobs matchés/recherche</span>
                </li>
                <li className="flex items-start gap-2" style={{ color: '#1D3557' }}>
                  <svg className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span>Scores IA + justifications</span>
                </li>
                <li className="flex items-start gap-2" style={{ color: '#1D3557' }}>
                  <svg className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span>3 décideurs/entreprise (top 10)</span>
                </li>
                <li className="flex items-start gap-2" style={{ color: '#1D3557' }}>
                  <svg className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span>Emails + téléphones enrichis</span>
                </li>
                <li className="flex items-start gap-2" style={{ color: '#1D3557' }}>
                  <svg className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span>Historique illimité</span>
                </li>
                <li className="flex items-start gap-2" style={{ color: '#1D3557' }}>
                  <svg className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span>Support email prioritaire</span>
                </li>
                <li className="flex items-start gap-2" style={{ color: '#1D3557' }}>
                  <svg className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span className="font-medium">Récurrence automatique</span>
                </li>
                <li className="flex items-start gap-2" style={{ color: '#1D3557' }}>
                  <svg className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span>3 utilisateurs</span>
                </li>
              </ul>
              <Link href="/signup" className="block">
                <Button className="w-full" style={{ backgroundColor: '#6366F1', color: 'white' }}>
                  Choisir Pro
                </Button>
              </Link>
            </div>

            {/* Business */}
            <div className="bg-gray-900 rounded-2xl p-6 text-white">
              <h3 className="text-lg font-bold mb-2">Business</h3>
              <div className="mb-4">
                <span className="text-3xl font-bold">349€</span>
                <span className="text-gray-400">/mois</span>
              </div>
              <ul className="space-y-2 mb-6 text-sm">
                <li className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span><strong>200 recherches</strong> CV/mois</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span>50 jobs matchés/recherche</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span>Scores IA + justifications</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span>3 décideurs/entreprise (TOUS)</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span>Emails + téléphones enrichis</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span>Historique illimité</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span>Export CSV <span className="text-gray-400">(T1 2026)</span></span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span className="font-medium">Récurrence automatique</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span>Support dédié</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span>10 utilisateurs</span>
                </li>
              </ul>
              <Link href="/signup" className="block">
                <Button className="w-full" style={{ backgroundColor: 'white', color: '#1D3557' }}>
                  Choisir Business
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Final */}
      <section className="py-20 px-6" style={{ backgroundColor: '#1D3557' }}>
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold mb-6 text-white">
            Prêt à révolutionner votre recherche d'emploi ?
          </h2>
          <p className="text-xl mb-8" style={{ color: '#A8DADC' }}>
            Rejoignez les centaines de professionnels qui gagnent du temps et trouvent de meilleures opportunités.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/signup">
              <Button size="lg" className="text-lg px-8 py-6" style={{ backgroundColor: '#6366F1', color: 'white' }}>
                Commencer gratuitement
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-gray-200">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="text-2xl font-bold mb-4" style={{ color: '#1D3557' }}>
                Push<span style={{ color: '#6366F1' }}>Profile</span>
              </div>
              <p className="text-sm" style={{ color: '#457B9D' }}>
                La plateforme intelligente de matching CV-Job qui remplace vos outils de recrutement.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4" style={{ color: '#1D3557' }}>Produit</h4>
              <ul className="space-y-2 text-sm" style={{ color: '#457B9D' }}>
                <li><a href="#fonctionnalites" className="hover:underline">Fonctionnalités</a></li>
                <li><a href="#tarifs" className="hover:underline">Tarifs</a></li>
                <li><a href="#" className="hover:underline">API</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4" style={{ color: '#1D3557' }}>Entreprise</h4>
              <ul className="space-y-2 text-sm" style={{ color: '#457B9D' }}>
                <li><a href="#" className="hover:underline">À propos</a></li>
                <li><a href="#" className="hover:underline">Blog</a></li>
                <li><a href="#" className="hover:underline">Contact</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4" style={{ color: '#1D3557' }}>Légal</h4>
              <ul className="space-y-2 text-sm" style={{ color: '#457B9D' }}>
                <li><a href="#" className="hover:underline">Mentions légales</a></li>
                <li><a href="#" className="hover:underline">CGU</a></li>
                <li><a href="#" className="hover:underline">Confidentialité</a></li>
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t border-gray-200 text-center text-sm" style={{ color: '#457B9D' }}>
            © 2026 PushProfile. Tous droits réservés.
          </div>
        </div>
      </footer>
    </div>
  )
}
