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
  const [waitlistEmail, setWaitlistEmail] = useState('')
  const [waitlistSubmitted, setWaitlistSubmitted] = useState(false)
  const [waitlistLoading, setWaitlistLoading] = useState(false)

  const handleWaitlistSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!waitlistEmail) return
    setWaitlistLoading(true)
    await supabase.from('waitlist').insert({
      email: waitlistEmail,
      created_at: new Date().toISOString()
    })
    setWaitlistSubmitted(true)
    setWaitlistLoading(false)
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.push('/dashboard')
      } else {
        setIsLoggedIn(false)
        setCheckingAuth(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        router.push('/reset-password')
      } else if (event === 'SIGNED_IN' && session) {
        router.push('/dashboard')
      }
    })

    return () => subscription.unsubscribe()
  }, [router])

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-indigo-50">
        <div className="relative">
          <div className="w-16 h-16 rounded-full border-4 border-indigo-100 border-t-indigo-600 animate-spin"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation - Glass morphism */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/70 backdrop-blur-xl border-b border-gray-200/50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
              Push<span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">Profile</span>
            </div>
            <span className="px-2.5 py-1 text-[10px] font-bold rounded-full bg-gradient-to-r from-amber-400 to-orange-400 text-white uppercase tracking-wider">
              Beta
            </span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            <a href="#fonctionnalites" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">Fonctionnalités</a>
            <a href="#tarifs" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">Tarifs</a>
          </div>
          <div className="flex items-center gap-3">
            {isLoggedIn ? (
              <Link href="/searches">
                <Button className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-lg shadow-indigo-500/25">
                  Mon espace
                </Button>
              </Link>
            ) : (
              <>
                <Link href="/login">
                  <Button variant="ghost" className="text-gray-700 hover:text-gray-900">Connexion</Button>
                </Link>
                <Link href="/signup">
                  <Button className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-lg shadow-indigo-500/25">
                    Essai gratuit
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section - Premium Gradient */}
      <section className="relative pt-32 pb-24 overflow-hidden">
        {/* Background decorations */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-indigo-50"></div>
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-gradient-to-br from-indigo-100/40 to-purple-100/40 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-gradient-to-tr from-blue-100/30 to-cyan-100/30 rounded-full blur-3xl translate-y-1/2 -translate-x-1/3"></div>

        <div className="relative max-w-7xl mx-auto px-6">
          {/* Badge */}
          <div className="flex justify-center mb-8">
            <div className="group inline-flex items-center gap-3 px-5 py-2.5 rounded-full bg-white shadow-lg shadow-gray-200/50 border border-gray-100 hover:shadow-xl transition-all duration-300">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <span className="text-sm font-medium text-gray-700">Gagnez du temps. Visez juste.</span>
            </div>
          </div>

          <div className="text-center max-w-4xl mx-auto">
            <h1 className="text-5xl md:text-7xl font-bold leading-[1.1] mb-8 tracking-tight">
              <span className="text-gray-900">Arrêtez de payer</span>
              <br />
              <span className="text-gray-900">pour </span>
              <span className="bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent">5 outils.</span>
            </h1>

            <p className="text-xl md:text-2xl text-gray-600 mb-10 max-w-2xl mx-auto leading-relaxed">
              Matching CV-Job, Sourcing, Contacts, Multi-sources.
              <br />
              <span className="font-semibold text-gray-900">Une seule plateforme IA.</span>
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
              <Link href="/signup">
                <Button size="lg" className="text-lg px-10 py-7 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-2xl shadow-indigo-500/30 hover:shadow-indigo-500/40 transition-all duration-300 hover:-translate-y-0.5">
                  Essayer gratuitement
                  <svg className="ml-2 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </Button>
              </Link>
            </div>

            {/* Trust badges */}
            <div className="flex flex-wrap justify-center gap-8 text-sm">
              {[
                { icon: '✓', text: 'Gratuit pour tester' },
                { icon: '✓', text: 'Sans carte bancaire' },
                { icon: '✓', text: 'Setup en 30 secondes' }
              ].map((item, idx) => (
                <span key={idx} className="flex items-center gap-2 text-gray-600">
                  <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-xs font-bold">{item.icon}</span>
                  {item.text}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* How it works - Premium Cards */}
      <section className="py-24 bg-gradient-to-b from-white to-gray-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-50 text-indigo-600 text-sm font-medium mb-4">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
              Simple & Efficace
            </div>
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              Comment ça marche ?
            </h2>
          </div>

          {/* Desktop Steps */}
          <div className="hidden md:grid grid-cols-4 gap-6 max-w-6xl mx-auto">
            {[
              { step: 1, icon: '📄', title: 'Upload ou Critères', desc: 'CV en PDF/DOCX ou définissez vos critères', color: 'indigo' },
              { step: 2, icon: '🔍', title: 'Analyse IA', desc: 'Scan de 50K+ offres en quelques secondes', color: 'indigo' },
              { step: 3, icon: '🎯', title: '~50 Jobs matchés', desc: 'Offres scorées avec explications', color: 'indigo' },
              { step: 4, icon: '📞', title: 'Contacts Directs', desc: 'Emails et téléphones des recruteurs', color: 'emerald' }
            ].map((item, idx) => (
              <div key={idx} className="relative group">
                <div className={`bg-white rounded-2xl p-6 shadow-xl shadow-gray-200/50 border border-gray-100 hover:border-${item.color}-200 hover:shadow-2xl hover:shadow-${item.color}-100/50 transition-all duration-300 h-full`}>
                  {/* Number badge */}
                  <div className={`absolute -top-3 -left-3 w-8 h-8 rounded-full bg-gradient-to-br from-${item.color}-500 to-${item.color}-600 text-white text-sm font-bold flex items-center justify-center shadow-lg`}>
                    {item.step}
                  </div>

                  <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br from-${item.color}-50 to-${item.color}-100 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300`}>
                    <span className="text-3xl">{item.icon}</span>
                  </div>

                  <h4 className="font-bold text-gray-900 mb-2 text-lg">{item.title}</h4>
                  <p className="text-gray-500 text-sm leading-relaxed">{item.desc}</p>
                </div>

                {/* Connector */}
                {idx < 3 && (
                  <div className="hidden md:block absolute top-1/2 -right-3 w-6 h-0.5 bg-gradient-to-r from-gray-200 to-gray-300 z-10"></div>
                )}
              </div>
            ))}
          </div>

          {/* Mobile Steps */}
          <div className="md:hidden space-y-4">
            {[
              { step: 1, icon: '📄', title: 'Upload ou Critères', desc: 'CV en PDF/DOCX ou vos critères', color: 'indigo' },
              { step: 2, icon: '🔍', title: 'Analyse IA', desc: 'Scan de 50K+ offres', color: 'indigo' },
              { step: 3, icon: '🎯', title: '~50 Jobs matchés', desc: 'Offres scorées et expliquées', color: 'indigo' },
              { step: 4, icon: '📞', title: 'Contacts Directs', desc: 'Emails et téléphones', color: 'emerald' }
            ].map((item, idx) => (
              <div key={idx} className={`bg-white rounded-xl p-5 shadow-lg border-l-4 border-${item.color}-500`}>
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 rounded-xl bg-${item.color}-50 flex items-center justify-center flex-shrink-0`}>
                    <span className="text-2xl">{item.icon}</span>
                  </div>
                  <div>
                    <div className={`text-${item.color}-600 text-xs font-bold mb-1`}>Étape {item.step}</div>
                    <h4 className="font-bold text-gray-900 mb-0.5">{item.title}</h4>
                    <p className="text-gray-500 text-sm">{item.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Sources Schema - Premium Design */}
      <section className="py-24 bg-gradient-to-b from-gray-50 to-white overflow-hidden">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-50 text-indigo-600 text-sm font-medium mb-4">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
              </span>
              Agrégation en temps réel
            </div>
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              Toutes vos sources. Un seul dashboard.
            </h2>
          </div>

          {/* Desktop Layout */}
          <div className="hidden lg:flex items-center justify-center gap-8">
            {/* Job Boards */}
            <div className="flex flex-col gap-3">
              {[
                { name: 'LinkedIn', sub: 'Jobs & Posts', color: '#0A66C2', logo: '/logos/linkedin.svg' },
                { name: 'Indeed', sub: "Offres d'emploi", color: '#2164F3', logo: '/logos/indeed.svg' },
                { name: 'Glassdoor', sub: 'Jobs & Avis', color: '#0CAA41', logo: '/logos/glassdoor.svg' },
                { name: 'WTTJ', sub: 'Welcome to the Jungle', color: '#FFCD00', logo: '/logos/wttj.svg', dark: true },
                { name: 'HelloWork', sub: 'Offres France', color: '#ffffff', logo: '/logos/hellowork.svg', border: true }
              ].map((source, idx) => (
                <div key={idx} className="group flex items-center gap-3 bg-white rounded-2xl px-5 py-4 shadow-lg shadow-gray-100/50 border border-gray-100 hover:shadow-xl transition-all duration-300 cursor-pointer"
                  style={{ ['--hover-color' as string]: source.color }}>
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-lg ${source.border ? 'border-2 border-gray-200 bg-white' : ''}`}
                    style={{ backgroundColor: source.border ? undefined : source.color, boxShadow: `0 8px 16px -4px ${source.color}40` }}>
                    <Image src={source.logo} alt={source.name} width={28} height={28} className={source.dark || source.border ? '' : 'brightness-0 invert'} />
                  </div>
                  <div>
                    <span className="font-semibold text-gray-900">{source.name}</span>
                    <p className="text-xs text-gray-500">{source.sub}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Arrow Left */}
            <div className="flex flex-col items-center gap-2 px-4">
              <div className="flex items-center">
                <div className="w-16 h-0.5 bg-gradient-to-r from-gray-200 to-indigo-400"></div>
                <svg className="w-6 h-6 text-indigo-500 -ml-1" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </div>
              <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Job Boards</span>
            </div>

            {/* Center Result Card */}
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-3xl blur-2xl opacity-20 scale-105"></div>
              <div className="relative bg-gradient-to-br from-indigo-600 via-indigo-500 to-purple-600 rounded-3xl p-8 text-white shadow-2xl shadow-indigo-500/30 min-w-[320px]">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2"></div>
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2"></div>

                <div className="relative">
                  <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center">
                    <span className="text-3xl">🎯</span>
                  </div>
                  <h3 className="text-xl font-bold text-center mb-6">Vos résultats</h3>
                  <ul className="space-y-3">
                    {['~50 jobs pertinents', 'Scoring IA intelligent', 'Contacts directs', 'Dédupliqués & classés'].map((item, idx) => (
                      <li key={idx} className="flex items-center gap-3 bg-white/10 backdrop-blur rounded-xl px-4 py-2.5">
                        <div className="w-6 h-6 rounded-full bg-green-400 flex items-center justify-center flex-shrink-0">
                          <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <span className="font-medium">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            {/* Arrow Right */}
            <div className="flex flex-col items-center gap-2 px-4">
              <div className="flex items-center">
                <svg className="w-6 h-6 text-emerald-500 -mr-1 rotate-180" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
                <div className="w-16 h-0.5 bg-gradient-to-l from-gray-200 to-emerald-400"></div>
              </div>
              <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">ATS Directs</span>
            </div>

            {/* ATS */}
            <div className="flex flex-col gap-3">
              {[
                { name: 'Greenhouse', sub: 'ATS Enterprise', color: '#4CB398', logo: '/logos/greenhouse.svg' },
                { name: 'Lever', sub: 'ATS Startups', color: '#6C5CE7', logo: '/logos/lever.png' },
                { name: 'Workday', sub: 'ATS Corporate', color: '#0057AE', logo: '/logos/workday.png' },
                { name: 'Ashby', sub: 'ATS Modern', color: '#5046E5', logo: '/logos/ashby.png' }
              ].map((source, idx) => (
                <div key={idx} className="group flex items-center gap-3 bg-white rounded-2xl px-5 py-4 shadow-lg shadow-gray-100/50 border border-gray-100 hover:shadow-xl transition-all duration-300 cursor-pointer">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center shadow-lg"
                    style={{ backgroundColor: source.color, boxShadow: `0 8px 16px -4px ${source.color}40` }}>
                    <Image src={source.logo} alt={source.name} width={28} height={28} className="brightness-0 invert" />
                  </div>
                  <div>
                    <span className="font-semibold text-gray-900">{source.name}</span>
                    <p className="text-xs text-gray-500">{source.sub}</p>
                  </div>
                </div>
              ))}
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
            <div className="relative mb-8">
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-3xl blur-xl opacity-20 scale-105"></div>
              <div className="relative bg-gradient-to-br from-indigo-600 via-indigo-500 to-purple-600 rounded-3xl p-6 text-white shadow-2xl shadow-indigo-500/30">
                <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center">
                  <span className="text-2xl">🎯</span>
                </div>
                <h3 className="text-lg font-bold text-center mb-4">Vos résultats</h3>
                <div className="grid grid-cols-2 gap-2">
                  {['~50 jobs', 'Scoring IA', 'Contacts', 'Dédupliqués'].map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-white/10 rounded-lg px-3 py-2">
                      <svg className="w-4 h-4 text-green-300" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      <span className="text-sm">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-3">
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wider text-center mb-2">Job Boards</p>
                {[
                  { name: 'LinkedIn', color: '#0A66C2', logo: '/logos/linkedin.svg' },
                  { name: 'Indeed', color: '#2164F3', logo: '/logos/indeed.svg' },
                  { name: 'Glassdoor', color: '#0CAA41', logo: '/logos/glassdoor.svg' },
                  { name: 'WTTJ', color: '#FFCD00', logo: '/logos/wttj.svg', dark: true },
                  { name: 'HelloWork', color: '#ffffff', logo: '/logos/hellowork.svg', border: true }
                ].map((source, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-white rounded-xl px-3 py-2.5 shadow-md border border-gray-100">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${source.border ? 'border border-gray-200' : ''}`}
                      style={{ backgroundColor: source.border ? '#fff' : source.color }}>
                      <Image src={source.logo} alt={source.name} width={18} height={18} className={source.dark || source.border ? '' : 'brightness-0 invert'} />
                    </div>
                    <span className="text-sm font-medium text-gray-900">{source.name}</span>
                  </div>
                ))}
              </div>
              <div className="space-y-3">
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wider text-center mb-2">ATS Directs</p>
                {[
                  { name: 'Greenhouse', color: '#4CB398', logo: '/logos/greenhouse.svg' },
                  { name: 'Lever', color: '#6C5CE7', logo: '/logos/lever.png' },
                  { name: 'Workday', color: '#0057AE', logo: '/logos/workday.png' },
                  { name: 'Ashby', color: '#5046E5', logo: '/logos/ashby.png' }
                ].map((source, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-white rounded-xl px-3 py-2.5 shadow-md border border-emerald-100">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: source.color }}>
                      <Image src={source.logo} alt={source.name} width={18} height={18} className="brightness-0 invert" />
                    </div>
                    <span className="text-sm font-medium text-gray-900">{source.name}</span>
                  </div>
                ))}
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

      {/* Stats Section - Glassmorphism */}
      <section className="py-24 bg-gradient-to-br from-indigo-600 via-purple-600 to-indigo-700 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMiIvPjwvZz48L2c+PC9zdmc+')] opacity-50"></div>
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-white/5 rounded-full blur-3xl"></div>

        <div className="relative max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-3 gap-8 max-w-4xl mx-auto">
            {[
              { value: '30s', label: 'Temps de matching' },
              { value: '50+', label: 'Jobs par recherche' },
              { value: '3x', label: 'Plus de placements' }
            ].map((stat, idx) => (
              <div key={idx} className="text-center">
                <div className="text-5xl md:text-7xl font-bold text-white mb-3 drop-shadow-lg">{stat.value}</div>
                <div className="text-indigo-200 font-medium">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="fonctionnalites" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-50 text-indigo-600 text-sm font-medium mb-4">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
              Fonctionnalités
            </div>
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              Une recherche qui comprend vraiment
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Algorithme intelligent boosté par l'IA pour analyser CV et matcher les meilleures offres
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: '📄',
                title: 'Upload & Analyse',
                desc: 'Uploadez votre CV (PDF, DOCX) ou définissez vos critères. L\'algorithme extrait automatiquement compétences et préférences.',
                gradient: 'from-blue-500 to-cyan-500'
              },
              {
                icon: '🔍',
                title: 'Matching Multi-Sources',
                desc: 'Recherche simultanée sur LinkedIn, Indeed, Glassdoor, WTTJ + directement sur les ATS des entreprises.',
                gradient: 'from-purple-500 to-pink-500'
              },
              {
                icon: '📊',
                title: 'Scoring Intelligent',
                desc: 'Chaque match est scoré avec une explication détaillée. Vous savez POURQUOI cette offre correspond.',
                gradient: 'from-orange-500 to-red-500'
              }
            ].map((feature, idx) => (
              <div key={idx} className="group relative">
                <div className="absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-3xl blur-xl"
                  style={{ background: `linear-gradient(to bottom right, var(--tw-gradient-stops))` }}></div>
                <div className="relative bg-white rounded-3xl p-8 shadow-xl shadow-gray-200/50 border border-gray-100 group-hover:border-gray-200 transition-all duration-300 h-full">
                  <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-6 shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                    <span className="text-3xl">{feature.icon}</span>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-3">{feature.title}</h3>
                  <p className="text-gray-600 leading-relaxed">{feature.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Target Customers */}
      <section className="py-24 bg-gradient-to-b from-gray-50 to-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-50 text-indigo-600 text-sm font-medium mb-4">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
              Pour qui ?
            </div>
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              3 profils, un seul outil
            </h2>
          </div>

          <div className="space-y-8">
            {/* Cabinets */}
            <div className="bg-white rounded-3xl shadow-2xl shadow-gray-200/50 overflow-hidden border border-gray-100">
              <div className="grid md:grid-cols-2">
                <div className="p-10 md:p-12">
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-sm font-medium mb-6">
                    Cabinets de recrutement
                  </div>

                  <div className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-red-50 to-orange-50 border border-red-100">
                    <p className="text-sm font-medium text-red-700 mb-2">
                      Le problème : Vos CVs dorment dans votre base, faute de jobs pertinents.
                    </p>
                    <p className="text-sm font-medium text-emerald-700">
                      La solution : 50 jobs qualifiés par CV en 30 secondes.
                    </p>
                  </div>

                  <h3 className="text-3xl font-bold text-gray-900 mb-4">
                    Placez 3x plus de candidats
                  </h3>

                  <ul className="space-y-3 mb-8">
                    {[
                      '1 CV → 50 jobs pertinents en 30 secondes',
                      'Multi-sources : LinkedIn, Indeed, WTTJ + ATS',
                      'Prospection ultra-ciblée avec contacts directs'
                    ].map((item, idx) => (
                      <li key={idx} className="flex items-start gap-3">
                        <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <span className="text-gray-700">{item}</span>
                      </li>
                    ))}
                  </ul>

                  <Link href="/signup">
                    <Button className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-lg shadow-indigo-500/25">
                      Tester gratuitement
                    </Button>
                  </Link>
                </div>
                <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-12 flex items-center justify-center">
                  <div className="text-center text-white">
                    <div className="text-8xl mb-4">🏢</div>
                    <p className="font-medium text-indigo-100">Pour les pros du recrutement</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Candidats */}
            <div className="bg-white rounded-3xl shadow-2xl shadow-gray-200/50 overflow-hidden border border-gray-100">
              <div className="grid md:grid-cols-2">
                <div className="bg-gradient-to-br from-cyan-500 to-blue-600 p-12 flex items-center justify-center order-2 md:order-1">
                  <div className="text-center text-white">
                    <div className="text-8xl mb-4">🎯</div>
                    <p className="font-medium text-cyan-100">Trouvez le job idéal</p>
                  </div>
                </div>
                <div className="p-10 md:p-12 order-1 md:order-2">
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 text-white text-sm font-medium mb-6">
                    Candidats
                  </div>

                  <h3 className="text-3xl font-bold text-gray-900 mb-4">
                    Trouvez un job 2x plus vite
                  </h3>
                  <p className="text-lg text-gray-600 mb-6">
                    Fini les 10h/semaine à chercher partout. Uploadez, on fait le reste.
                  </p>

                  <ul className="space-y-3 mb-8">
                    {[
                      'Upload CV → 50 jobs pertinents en 30 secondes',
                      'Scores expliqués - sachez POURQUOI ça matche',
                      'Contacts directs des recruteurs'
                    ].map((item, idx) => (
                      <li key={idx} className="flex items-start gap-3">
                        <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <span className="text-gray-700">{item}</span>
                      </li>
                    ))}
                  </ul>

                  <Link href="/signup">
                    <Button className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white shadow-lg shadow-cyan-500/25">
                      Tester gratuitement
                    </Button>
                  </Link>
                </div>
              </div>
            </div>

            {/* Entreprises - Coming Soon */}
            <div className="relative bg-white rounded-3xl shadow-2xl shadow-gray-200/50 overflow-hidden border border-gray-100">
              <div className="absolute top-6 right-6 px-4 py-2 rounded-full bg-gradient-to-r from-gray-700 to-gray-900 text-white text-sm font-medium z-10">
                Bientôt disponible
              </div>
              <div className="grid md:grid-cols-2">
                <div className="p-10 md:p-12">
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gray-900 text-white text-sm font-medium mb-6">
                    Entreprises
                  </div>

                  <h3 className="text-3xl font-bold text-gray-900 mb-4">
                    Sourcez les meilleurs talents
                  </h3>
                  <p className="text-lg text-gray-600 mb-6">
                    Upload fiche de poste → On cible les candidats prêts au changement.
                  </p>

                  <ul className="space-y-3 mb-8">
                    {[
                      'Ciblage des profils "Open to Work"',
                      'Pas besoin de connecter votre LinkedIn',
                      'Contacts enrichis automatiquement'
                    ].map((item, idx) => (
                      <li key={idx} className="flex items-start gap-3">
                        <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <span className="text-gray-700">{item}</span>
                      </li>
                    ))}
                  </ul>

                  {waitlistSubmitted ? (
                    <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
                      <p className="text-sm font-medium text-emerald-700">
                        Merci ! Vous serez notifié dès la sortie.
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
                        className="flex-1 px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all"
                      />
                      <Button type="submit" disabled={waitlistLoading} className="bg-gray-900 hover:bg-gray-800 text-white">
                        {waitlistLoading ? '...' : "M'alerter"}
                      </Button>
                    </form>
                  )}
                </div>
                <div className="bg-gradient-to-br from-gray-800 to-gray-900 p-12 flex items-center justify-center opacity-90">
                  <div className="text-center text-white">
                    <div className="text-8xl mb-4">🚀</div>
                    <p className="font-medium text-gray-300">Phase 2 - Q2 2026</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="tarifs" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-50 text-indigo-600 text-sm font-medium mb-4">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
              Tarifs
            </div>
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              Simple et transparent
            </h2>
            <p className="text-xl text-gray-600">
              Commencez gratuitement, passez Pro quand vous êtes prêt
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
            {/* Free */}
            <div className="bg-gray-50 rounded-3xl p-8 border border-gray-100">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-2xl">🎁</span>
                <h3 className="text-xl font-bold text-gray-900">Essai Gratuit</h3>
              </div>
              <div className="mb-6">
                <span className="text-5xl font-bold text-gray-900">0€</span>
              </div>
              <p className="text-sm text-emerald-600 font-medium mb-6">Pas de CB requise</p>
              <ul className="space-y-3 mb-8 text-sm">
                {['2 recherches gratuites', '~50 jobs matchés', 'Scores IA + justifications', 'Contacts top 10 jobs'].map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-gray-700">
                    <svg className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    {item}
                  </li>
                ))}
              </ul>
              <Link href="/signup" className="block">
                <Button variant="outline" className="w-full">Essayer gratuitement</Button>
              </Link>
            </div>

            {/* Starter */}
            <div className="bg-white rounded-3xl p-8 border border-gray-200 shadow-lg">
              <h3 className="text-xl font-bold text-gray-900 mb-4">Starter</h3>
              <div className="mb-6">
                <span className="text-5xl font-bold text-gray-900">49€</span>
                <span className="text-gray-500">/mois</span>
              </div>
              <ul className="space-y-3 mb-8 text-sm">
                {['10 recherches/mois', '25 jobs/recherche', 'Scores IA', 'Emails enrichis'].map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-gray-700">
                    <svg className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    {item}
                  </li>
                ))}
              </ul>
              <Link href="/signup" className="block">
                <Button variant="outline" className="w-full">Choisir Starter</Button>
              </Link>
            </div>

            {/* Pro - Popular */}
            <div className="relative bg-gradient-to-br from-indigo-600 to-purple-600 rounded-3xl p-8 text-white shadow-2xl shadow-indigo-500/30">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                <span className="px-4 py-1.5 rounded-full text-xs font-bold bg-gradient-to-r from-amber-400 to-orange-400 text-white uppercase tracking-wider shadow-lg">
                  Populaire
                </span>
              </div>
              <div className="flex items-center gap-2 mb-4">
                <h3 className="text-xl font-bold">Pro</h3>
                <span>⭐</span>
              </div>
              <div className="mb-6">
                <span className="text-5xl font-bold">149€</span>
                <span className="text-indigo-200">/mois</span>
              </div>
              <ul className="space-y-3 mb-8 text-sm">
                {['50 recherches/mois', '50 jobs/recherche', 'Emails + téléphones', 'Récurrence auto', '3 utilisateurs'].map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <svg className="w-5 h-5 text-green-300 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    {item}
                  </li>
                ))}
              </ul>
              <Link href="/signup" className="block">
                <Button className="w-full bg-white text-indigo-600 hover:bg-indigo-50">Choisir Pro</Button>
              </Link>
            </div>

            {/* Business */}
            <div className="bg-gray-900 rounded-3xl p-8 text-white shadow-2xl">
              <h3 className="text-xl font-bold mb-4">Business</h3>
              <div className="mb-6">
                <span className="text-5xl font-bold">349€</span>
                <span className="text-gray-400">/mois</span>
              </div>
              <ul className="space-y-3 mb-8 text-sm">
                {['200 recherches/mois', 'Contacts illimités', 'Export CSV', 'Support dédié', '10 utilisateurs'].map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <svg className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    {item}
                  </li>
                ))}
              </ul>
              <Link href="/signup" className="block">
                <Button className="w-full bg-white text-gray-900 hover:bg-gray-100">Choisir Business</Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 bg-gradient-to-br from-indigo-600 via-purple-600 to-indigo-700 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMiIvPjwvZz48L2c+PC9zdmc+')] opacity-50"></div>
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-white/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-white/5 rounded-full blur-3xl"></div>

        <div className="relative max-w-4xl mx-auto text-center px-6">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Prêt à révolutionner votre recherche ?
          </h2>
          <p className="text-xl text-indigo-100 mb-10 max-w-2xl mx-auto">
            Rejoignez les professionnels qui gagnent du temps et trouvent de meilleures opportunités.
          </p>
          <Link href="/signup">
            <Button size="lg" className="text-lg px-10 py-7 bg-white text-indigo-600 hover:bg-indigo-50 shadow-2xl shadow-black/20 hover:-translate-y-0.5 transition-all duration-300">
              Commencer gratuitement
              <svg className="ml-2 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-16 bg-gray-900 text-gray-400">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-12 mb-12">
            <div>
              <div className="text-2xl font-bold text-white mb-4">
                Push<span className="text-indigo-400">Profile</span>
              </div>
              <p className="text-sm leading-relaxed">
                La plateforme intelligente de matching CV-Job qui remplace vos outils de recrutement.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">Produit</h4>
              <ul className="space-y-3 text-sm">
                <li><a href="#fonctionnalites" className="hover:text-white transition-colors">Fonctionnalités</a></li>
                <li><a href="#tarifs" className="hover:text-white transition-colors">Tarifs</a></li>
                <li><a href="#" className="hover:text-white transition-colors">API</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">Entreprise</h4>
              <ul className="space-y-3 text-sm">
                <li><a href="#" className="hover:text-white transition-colors">À propos</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Blog</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Contact</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">Légal</h4>
              <ul className="space-y-3 text-sm">
                <li><a href="#" className="hover:text-white transition-colors">Mentions légales</a></li>
                <li><a href="#" className="hover:text-white transition-colors">CGU</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Confidentialité</a></li>
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t border-gray-800 text-center text-sm">
            © 2026 PushProfile. Tous droits réservés.
          </div>
        </div>
      </footer>
    </div>
  )
}
