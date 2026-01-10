'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export default function LandingPage() {
  const router = useRouter()
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [isAnnual, setIsAnnual] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsLoggedIn(!!session)
      setCheckingAuth(false)
    })
  }, [])

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
          {/* Badge économie */}
          <div className="flex justify-center mb-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium" style={{ backgroundColor: '#F1FAEE', color: '#1D3557' }}>
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
              Économisez 750€/mois vs LinkedIn + Lusha + Indeed
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
              <Button size="lg" variant="outline" className="text-lg px-8 py-6" style={{ borderColor: '#1D3557', color: '#1D3557' }}>
                Voir la démo
              </Button>
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
            <h3 className="text-center text-2xl font-bold mb-4" style={{ color: '#1D3557' }}>Comment ça marche ?</h3>
            <p className="text-center mb-12" style={{ color: '#457B9D' }}>En 4 étapes simples, trouvez votre prochain job</p>

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
                    <h4 className="font-bold mb-2" style={{ color: '#1D3557' }}>~50 Jobs + TOP 10</h4>
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
                    <p className="text-sm" style={{ color: '#457B9D' }}>Email + téléphone du recruteur (70% des offres)</p>
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
                      <h4 className="font-bold mb-1" style={{ color: '#1D3557' }}>~50 Jobs + TOP 10</h4>
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
                      <p className="text-sm" style={{ color: '#457B9D' }}>Email + téléphone (70% des offres)</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Bar - Remplace ces outils */}
      <section className="py-16 border-y border-gray-200 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <p className="text-center text-sm font-medium uppercase tracking-wider mb-8" style={{ color: '#457B9D' }}>
            PushProfile remplace tous ces outils
          </p>
          <div className="flex flex-wrap justify-center items-center gap-8 md:gap-16">
            <div className="text-center">
              <div className="text-2xl font-bold line-through" style={{ color: '#6366F1' }}>LinkedIn Recruiter</div>
              <div className="text-sm" style={{ color: '#457B9D' }}>500€/mois</div>
            </div>
            <div className="text-3xl" style={{ color: '#A8DADC' }}>+</div>
            <div className="text-center">
              <div className="text-2xl font-bold line-through" style={{ color: '#6366F1' }}>Indeed</div>
              <div className="text-sm" style={{ color: '#457B9D' }}>300€/mois</div>
            </div>
            <div className="text-3xl" style={{ color: '#A8DADC' }}>+</div>
            <div className="text-center">
              <div className="text-2xl font-bold line-through" style={{ color: '#6366F1' }}>Lusha</div>
              <div className="text-sm" style={{ color: '#457B9D' }}>99€/mois</div>
            </div>
          </div>
          <div className="text-center mt-8">
            <div className="inline-block px-6 py-3 rounded-full" style={{ backgroundColor: '#F1FAEE' }}>
              <span className="text-lg" style={{ color: '#457B9D' }}>= </span>
              <span className="text-2xl font-bold line-through" style={{ color: '#6366F1' }}>899€/mois</span>
              <span className="text-lg mx-3" style={{ color: '#457B9D' }}>→</span>
              <span className="text-2xl font-bold" style={{ color: '#059669' }}>149€/mois</span>
              <span className="text-lg ml-2" style={{ color: '#457B9D' }}>avec PushProfile</span>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="text-4xl md:text-5xl font-bold mb-2" style={{ color: '#1D3557' }}>30s</div>
              <div style={{ color: '#457B9D' }}>Temps de matching</div>
            </div>
            <div className="text-center">
              <div className="text-4xl md:text-5xl font-bold mb-2" style={{ color: '#1D3557' }}>50+</div>
              <div style={{ color: '#457B9D' }}>Jobs par recherche</div>
            </div>
            <div className="text-center">
              <div className="text-4xl md:text-5xl font-bold mb-2" style={{ color: '#1D3557' }}>750€</div>
              <div style={{ color: '#457B9D' }}>Économie mensuelle</div>
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
                Recherche simultanée sur Indeed, LinkedIn, WTTJ, Adzuna et 50K+ offres. Fini les heures à chercher sur chaque site.
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
                      <span style={{ color: '#1D3557' }}>Économie : 750€/mois en outils + 49h/mois en temps</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <svg className="w-6 h-6 text-green-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      <span style={{ color: '#1D3557' }}>Multi-sources : Indeed + LinkedIn + WTTJ + 50K jobs</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <svg className="w-6 h-6 text-green-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      <span style={{ color: '#1D3557' }}>Contacts enrichis : email + téléphone (70% des offres)</span>
                    </li>
                  </ul>
                  <div className="flex items-center gap-4">
                    <span className="text-3xl font-bold" style={{ color: '#1D3557' }}>149€</span>
                    <span style={{ color: '#457B9D' }}>/mois</span>
                    <Link href="/signup">
                      <Button style={{ backgroundColor: '#6366F1', color: 'white' }}>
                        Commencer
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
                    Fini les 10h/semaine à chercher sur Indeed, LinkedIn, WTTJ. Uploadez, on fait le reste.
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
                      <span style={{ color: '#1D3557' }}>Économie : 500h/an = 7,500€ de temps gagné</span>
                    </li>
                  </ul>
                  <div className="flex items-center gap-4">
                    <span className="text-3xl font-bold" style={{ color: '#1D3557' }}>Gratuit</span>
                    <span style={{ color: '#457B9D' }}>1 recherche offerte</span>
                    <Link href="/signup">
                      <Button style={{ backgroundColor: '#6366F1', color: 'white' }}>
                        Essayer
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
                    Upload fiche de poste → On trouve les talents sur GitHub, LinkedIn, Stack Overflow.
                  </p>
                  <ul className="space-y-4 mb-8">
                    <li className="flex items-start gap-3">
                      <svg className="w-6 h-6 text-green-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      <span style={{ color: '#1D3557' }}>Scraping GitHub/LinkedIn/Stack Overflow</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <svg className="w-6 h-6 text-green-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      <span style={{ color: '#1D3557' }}>Contacts enrichis automatiquement</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <svg className="w-6 h-6 text-green-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      <span style={{ color: '#1D3557' }}>50% moins cher que LinkedIn Recruiter</span>
                    </li>
                  </ul>
                  <div className="flex items-center gap-4">
                    <span className="text-3xl font-bold" style={{ color: '#1D3557' }}>499€</span>
                    <span style={{ color: '#457B9D' }}>/mois</span>
                    <Button disabled variant="outline">
                      Liste d'attente
                    </Button>
                  </div>
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
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4" style={{ color: '#1D3557' }}>
              Tarifs simples et transparents
            </h2>
            <p className="text-xl mb-8" style={{ color: '#457B9D' }}>
              Commencez gratuitement, passez Pro quand vous êtes prêt
            </p>

            {/* Toggle Mensuel / Annuel */}
            <div className="flex items-center justify-center gap-4">
              <span className={`font-medium ${!isAnnual ? 'text-gray-900' : 'text-gray-400'}`}>Mensuel</span>
              <button
                onClick={() => setIsAnnual(!isAnnual)}
                className="relative w-16 h-8 rounded-full transition-colors"
                style={{ backgroundColor: isAnnual ? '#6366F1' : '#E5E7EB' }}
              >
                <div
                  className="absolute top-1 w-6 h-6 bg-white rounded-full shadow transition-transform"
                  style={{ transform: isAnnual ? 'translateX(34px)' : 'translateX(4px)' }}
                />
              </button>
              <span className={`font-medium ${isAnnual ? 'text-gray-900' : 'text-gray-400'}`}>
                Annuel
                <span className="ml-2 px-2 py-1 text-xs rounded-full" style={{ backgroundColor: '#D1FAE5', color: '#059669' }}>
                  -20%
                </span>
              </span>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {/* Free */}
            <div className="bg-gray-50 rounded-2xl p-8">
              <h3 className="text-xl font-bold mb-2" style={{ color: '#1D3557' }}>Gratuit</h3>
              <p className="mb-6" style={{ color: '#457B9D' }}>Pour découvrir</p>
              <div className="mb-6">
                <span className="text-4xl font-bold" style={{ color: '#1D3557' }}>0€</span>
              </div>
              <ul className="space-y-3 mb-8">
                <li className="flex items-center gap-2" style={{ color: '#1D3557' }}>
                  <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  1 recherche
                </li>
                <li className="flex items-center gap-2" style={{ color: '#1D3557' }}>
                  <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  50 jobs max
                </li>
                <li className="flex items-center gap-2" style={{ color: '#1D3557' }}>
                  <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Scoring intelligent
                </li>
              </ul>
              <Link href="/signup" className="block">
                <Button variant="outline" className="w-full">
                  Commencer
                </Button>
              </Link>
            </div>

            {/* Starter */}
            <div className="bg-white rounded-2xl p-8 shadow-xl border-2" style={{ borderColor: '#6366F1' }}>
              <div className="flex justify-between items-start mb-2">
                <h3 className="text-xl font-bold" style={{ color: '#1D3557' }}>Starter</h3>
                <span className="px-3 py-1 rounded-full text-xs font-medium" style={{ backgroundColor: '#6366F1', color: 'white' }}>
                  Populaire
                </span>
              </div>
              <p className="mb-6" style={{ color: '#457B9D' }}>Pour les candidats actifs</p>
              <div className="mb-6">
                <span className="text-4xl font-bold" style={{ color: '#1D3557' }}>{isAnnual ? '39€' : '49€'}</span>
                <span style={{ color: '#457B9D' }}>/mois</span>
                {isAnnual && (
                  <span className="block text-sm mt-1" style={{ color: '#059669' }}>
                    Facturé 468€/an
                  </span>
                )}
              </div>
              <ul className="space-y-3 mb-8">
                <li className="flex items-center gap-2" style={{ color: '#1D3557' }}>
                  <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  10 recherches/mois
                </li>
                <li className="flex items-center gap-2" style={{ color: '#1D3557' }}>
                  <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Multi-sources
                </li>
                <li className="flex items-center gap-2" style={{ color: '#1D3557' }}>
                  <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Export CSV
                </li>
                <li className="flex items-center gap-2" style={{ color: '#1D3557' }}>
                  <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Support email
                </li>
              </ul>
              <Link href="/signup" className="block">
                <Button className="w-full" style={{ backgroundColor: '#6366F1', color: 'white' }}>
                  Choisir Starter
                </Button>
              </Link>
            </div>

            {/* Pro */}
            <div className="bg-gray-50 rounded-2xl p-8">
              <h3 className="text-xl font-bold mb-2" style={{ color: '#1D3557' }}>Pro</h3>
              <p className="mb-6" style={{ color: '#457B9D' }}>Pour les recruteurs</p>
              <div className="mb-6">
                <span className="text-4xl font-bold" style={{ color: '#1D3557' }}>{isAnnual ? '119€' : '149€'}</span>
                <span style={{ color: '#457B9D' }}>/mois</span>
                {isAnnual && (
                  <span className="block text-sm mt-1" style={{ color: '#059669' }}>
                    Facturé 1 428€/an
                  </span>
                )}
              </div>
              <ul className="space-y-3 mb-8">
                <li className="flex items-center gap-2" style={{ color: '#1D3557' }}>
                  <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Recherches illimitées
                </li>
                <li className="flex items-center gap-2" style={{ color: '#1D3557' }}>
                  <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  API access
                </li>
                <li className="flex items-center gap-2" style={{ color: '#1D3557' }}>
                  <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Intégrations ATS
                </li>
                <li className="flex items-center gap-2" style={{ color: '#1D3557' }}>
                  <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Support prioritaire
                </li>
              </ul>
              <Link href="/signup" className="block">
                <Button variant="outline" className="w-full">
                  Choisir Pro
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
            <Button size="lg" className="text-lg px-8 py-6" style={{ backgroundColor: 'white', color: '#1D3557' }}>
              Demander une démo
            </Button>
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
