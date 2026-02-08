'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import AppLayout from '@/components/AppLayout'
import { supabase } from '@/lib/supabase'

// Messages de chargement
const LOADING_MESSAGES = [
  { text: "Analyse du profil...", icon: "🧠" },
  { text: "Connexion aux jobboards...", icon: "🔌" },
  { text: "Recherche en cours...", icon: "🔍" },
  { text: "Filtrage des résultats...", icon: "🚫" },
  { text: "Scoring avec l'IA...", icon: "🤖" },
  { text: "Préparation...", icon: "✨" },
]

export default function NewSearchPage() {
  const router = useRouter()

  // États du formulaire
  const [activeTab, setActiveTab] = useState<'standard' | 'linkedin'>('standard')
  const [searchTitle, setSearchTitle] = useState('')
  const [excludeAgencies, setExcludeAgencies] = useState(true)
  const [addToFavorites, setAddToFavorites] = useState(false)

  // Champs de recherche
  const [jobTitle, setJobTitle] = useState('')
  const [location, setLocation] = useState('')
  const [contractTypes, setContractTypes] = useState<string[]>([])
  const [remoteOptions, setRemoteOptions] = useState<string[]>([])
  const [seniorityLevels, setSeniorityLevels] = useState<string[]>([])
  const [brief, setBrief] = useState('')
  const [maxDaysOld, setMaxDaysOld] = useState<number>(30)

  // CV
  const [cvBase64, setCvBase64] = useState<string | null>(null)
  const [cvMediaType, setCvMediaType] = useState<string | null>(null)
  const [cvText, setCvText] = useState('')
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [extracting, setExtracting] = useState(false)

  // LinkedIn
  const [linkedinUrl, setLinkedinUrl] = useState('')
  const [inputMode, setInputMode] = useState<'cv' | 'linkedin'>('cv')

  // Récurrence
  const [recurrence, setRecurrence] = useState<'none' | '2days' | 'weekly' | 'monthly'>('none')

  // LinkedIn Posts tab
  const [linkedinKeywords, setLinkedinKeywords] = useState('')
  const [linkedinLocation, setLinkedinLocation] = useState('')
  const [linkedinContractTypes, setLinkedinContractTypes] = useState<string[]>([])
  const [linkedinPostedWithin, setLinkedinPostedWithin] = useState<string>('week')
  const [linkedinSearchName, setLinkedinSearchName] = useState('')
  const [linkedinExcludeAgencies, setLinkedinExcludeAgencies] = useState(true)

  // UI
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0)

  useEffect(() => {
    if (!loading) { setLoadingMessageIndex(0); return }
    const interval = setInterval(() => {
      setLoadingMessageIndex(prev => prev < LOADING_MESSAGES.length - 1 ? prev + 1 : prev)
    }, 3000)
    return () => clearInterval(interval)
  }, [loading])

  // File handlers
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = () => resolve((reader.result as string).split(',')[1])
      reader.onerror = reject
    })
  }

  const extractDocxText = async (file: File): Promise<string> => {
    const mammoth = await import('mammoth')
    const arrayBuffer = await file.arrayBuffer()
    const result = await mammoth.extractRawText({ arrayBuffer })
    return result.value
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadedFile(file)
    setExtracting(true)
    setError('')
    setCvBase64(null)
    setCvMediaType(null)
    try {
      if (file.type === 'application/pdf') {
        setCvBase64(await fileToBase64(file))
        setCvMediaType('application/pdf')
        setCvText('')
      } else if (file.name.endsWith('.docx')) {
        setCvText(await extractDocxText(file))
      } else if (file.name.endsWith('.txt')) {
        setCvText(await file.text())
      } else {
        throw new Error('Format non supporté (PDF, DOCX, TXT)')
      }
    } catch (err: any) {
      setError(err.message)
      setUploadedFile(null)
    } finally {
      setExtracting(false)
    }
  }

  const removeFile = () => {
    setUploadedFile(null)
    setCvText('')
    setCvBase64(null)
    setCvMediaType(null)
  }

  const isValidLinkedInUrl = (url: string) => /^https?:\/\/(www\.)?linkedin\.com\/in\/[\w-]+\/?/.test(url)

  // Submit standard
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!searchTitle.trim()) { setError('Titre obligatoire'); return }
    const hasCV = cvText || cvBase64
    const hasLinkedIn = linkedinUrl && isValidLinkedInUrl(linkedinUrl)
    const hasManual = jobTitle || location || brief
    if (!hasCV && !hasLinkedIn && !hasManual) { setError('Remplissez au moins un champ'); return }
    if (linkedinUrl && !isValidLinkedInUrl(linkedinUrl)) { setError('URL LinkedIn invalide'); return }

    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setError('Connectez-vous'); setLoading(false); return }

      const response = await fetch('/api/analyze-cv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: searchTitle,
          search_type: 'both',
          input_type: linkedinUrl ? 'linkedin' : (cvText || cvBase64) ? 'cv' : 'manual',
          exclude_agencies: excludeAgencies,
          job_title: jobTitle || null,
          location: location || null,
          contract_types: contractTypes.length > 0 ? contractTypes : null,
          remote_options: remoteOptions.length > 0 ? remoteOptions : null,
          seniority: seniorityLevels.length > 0 ? seniorityLevels : null,
          brief: brief || null,
          max_days_old: maxDaysOld,
          cv_text: cvText || null,
          cv_base64: cvBase64 || null,
          cv_media_type: cvMediaType || null,
          linkedin_url: linkedinUrl || null,
          recurrence: recurrence !== 'none' ? recurrence : null,
          user_id: session.user.id,
          is_favorite: addToFavorites,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)
      router.push(`/searches/${data.search_id}`)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Submit LinkedIn
  const handleLinkedInSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!linkedinSearchName.trim()) { setError('Nom obligatoire'); return }
    if (!linkedinKeywords.trim()) { setError('Mots-clés obligatoires'); return }

    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setError('Connectez-vous'); setLoading(false); return }

      const response = await fetch('/api/analyze-cv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: linkedinSearchName,
          search_type: 'both',
          input_type: 'manual',
          exclude_agencies: linkedinExcludeAgencies,
          job_title: linkedinKeywords,
          location: linkedinLocation || null,
          contract_types: linkedinContractTypes.length > 0 ? linkedinContractTypes : null,
          user_id: session.user.id,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)
      router.push(`/searches/${data.search_id}`)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AppLayout>
      <div className="p-4 md:p-6">
        <div className="max-w-4xl mx-auto">

          {/* Header */}
          <div className="flex items-center gap-3 mb-4">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Nouvelle Recherche</h1>
          </div>

          {/* Tabs */}
          <div className="flex bg-gray-100 rounded-xl p-1 mb-4">
            <button type="button" onClick={() => setActiveTab('standard')}
              className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all ${activeTab === 'standard' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              Recherche standard
            </button>
            <button type="button" onClick={() => setActiveTab('linkedin')}
              className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2 ${activeTab === 'linkedin' ? 'bg-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              style={activeTab === 'linkedin' ? { color: '#0A66C2' } : {}}>
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
              </svg>
              LinkedIn
            </button>
          </div>

          {/* Card */}
          <div className={`bg-white rounded-2xl p-5 md:p-6 shadow-xl border-t-4 ${activeTab === 'standard' ? 'border-t-indigo-500' : 'border-t-[#0A66C2]'}`}>

            {/* ========== STANDARD FORM ========== */}
            {activeTab === 'standard' && (
              <form onSubmit={handleSubmit} className="space-y-4">

                {/* Row 1: Titre + Profil */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Titre */}
                  <div>
                    <Label className="text-sm font-semibold text-gray-800">Titre de la recherche *</Label>
                    <Input value={searchTitle} onChange={(e) => setSearchTitle(e.target.value)}
                      placeholder="Ex: Dev React Senior - Jan 2026" className="mt-1.5 h-10" required />
                  </div>

                  {/* Profil candidat */}
                  <div className="bg-gradient-to-br from-gray-50 to-gray-100/50 rounded-xl p-4 border border-gray-200/50">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-semibold text-gray-800">Profil candidat <span className="text-gray-400 text-xs font-normal">(optionnel)</span></span>
                      <div className="flex bg-white rounded-lg p-0.5 shadow-sm border border-gray-200">
                        <button type="button" onClick={() => setInputMode('cv')}
                          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${inputMode === 'cv' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-500 hover:text-gray-700'}`}>📄 CV</button>
                        <button type="button" onClick={() => setInputMode('linkedin')}
                          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${inputMode === 'linkedin' ? 'bg-blue-100' : 'text-gray-500 hover:text-gray-700'}`}
                          style={inputMode === 'linkedin' ? { color: '#0A66C2' } : {}}>in LinkedIn</button>
                      </div>
                    </div>
                    {inputMode === 'cv' ? (
                      <label className="cursor-pointer block">
                        <div className="border-2 border-dashed border-gray-300 rounded-lg p-3 text-center hover:border-indigo-400 hover:bg-indigo-50/30 transition-all">
                          {uploadedFile ? (
                            <div className="flex items-center justify-between">
                              <span className="text-green-600 text-sm font-medium">✓ {uploadedFile.name}</span>
                              <button type="button" onClick={removeFile} className="text-red-500 text-xs hover:underline">Supprimer</button>
                            </div>
                          ) : extracting ? (
                            <span className="text-gray-500 text-sm">⏳ Extraction en cours...</span>
                          ) : (
                            <span className="text-gray-500 text-sm">Déposer un CV (PDF, DOCX, TXT)</span>
                          )}
                        </div>
                        <input type="file" accept=".pdf,.docx,.txt" onChange={handleFileUpload} className="hidden" />
                      </label>
                    ) : (
                      <Input value={linkedinUrl} onChange={(e) => setLinkedinUrl(e.target.value)}
                        placeholder="https://linkedin.com/in/nom-prenom" className="h-10" />
                    )}
                  </div>
                </div>

                {/* Row 2: Critères principaux */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <Label className="text-xs font-medium text-gray-600">Titre du poste</Label>
                    <Input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} placeholder="Product Owner" className="mt-1 h-9" />
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-gray-600">Lieu</Label>
                    <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Paris" className="mt-1 h-9" />
                  </div>
                  <div className="md:col-span-2">
                    <Label className="text-xs font-medium text-gray-600">Séniorité</Label>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {[
                        { value: 'junior', label: 'Junior (0-2 ans)' },
                        { value: 'confirmé', label: 'Confirmé (2-5 ans)' },
                        { value: 'senior', label: 'Senior (5+ ans)' },
                        { value: 'expert', label: 'Expert (10+ ans)' }
                      ].map((level) => (
                        <button key={level.value} type="button"
                          onClick={() => setSeniorityLevels(prev => prev.includes(level.value) ? prev.filter(l => l !== level.value) : [...prev, level.value])}
                          className={`px-3 py-1.5 text-xs rounded-lg border-2 font-medium transition-all ${seniorityLevels.includes(level.value) ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                          {level.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Row 3: Filtres toggle */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Contrat */}
                  <div>
                    <Label className="text-xs font-medium text-gray-600">Type de contrat</Label>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {['CDI', 'CDD', 'Freelance', 'Stage'].map((type) => (
                        <button key={type} type="button"
                          onClick={() => setContractTypes(prev => prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type])}
                          className={`px-3 py-1.5 text-xs rounded-lg border-2 font-medium transition-all ${contractTypes.includes(type) ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                          {type}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Remote */}
                  <div>
                    <Label className="text-xs font-medium text-gray-600">Remote</Label>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {['On-site', 'Hybrid', 'Remote'].map((opt) => (
                        <button key={opt} type="button"
                          onClick={() => setRemoteOptions(prev => prev.includes(opt) ? prev.filter(o => o !== opt) : [...prev, opt])}
                          className={`px-3 py-1.5 text-xs rounded-lg border-2 font-medium transition-all ${remoteOptions.includes(opt) ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Date */}
                  <div>
                    <Label className="text-xs font-medium text-gray-600">Date de publication</Label>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {[{ v: 7, l: '-1 sem' }, { v: 14, l: '-2 sem' }, { v: 30, l: '-1 mois' }, { v: 31, l: '+1 mois' }, { v: 90, l: '+3 mois' }].map((opt) => (
                        <button key={opt.v} type="button" onClick={() => setMaxDaysOld(opt.v)}
                          className={`px-2.5 py-1.5 text-xs rounded-lg border-2 font-medium transition-all ${maxDaysOld === opt.v ? (opt.v >= 31 ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-indigo-500 bg-indigo-50 text-indigo-700') : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                          {opt.l}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Row 4: Brief */}
                <div>
                  <Label className="text-xs font-medium text-gray-600">Brief / Compétences clés</Label>
                  <Input value={brief} onChange={(e) => setBrief(e.target.value)}
                    placeholder="React, TypeScript, AWS, expérience startup..." className="mt-1 h-9" />
                </div>

                {/* Row 5: Récurrence + Options */}
                <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl p-4 border border-indigo-100">
                  <div className="flex flex-col md:flex-row md:items-center gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-lg">🔔</span>
                        <Label className="text-sm font-semibold text-gray-800">Alertes automatiques</Label>
                      </div>
                      <p className="text-xs text-gray-600 mb-3">
                        Recevez une notification dès que de nouvelles offres correspondent à vos critères
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {[
                          { value: 'none', label: 'Désactivé', icon: '❌' },
                          { value: '2days', label: 'Tous les 2 jours', icon: '📅' },
                          { value: 'weekly', label: 'Chaque semaine', icon: '📆' },
                          { value: 'monthly', label: 'Chaque mois', icon: '🗓️' }
                        ].map((opt) => (
                          <button key={opt.value} type="button"
                            onClick={() => setRecurrence(opt.value as any)}
                            className={`px-3 py-2 text-xs rounded-lg border-2 font-medium transition-all flex items-center gap-1.5 ${
                              recurrence === opt.value
                                ? (opt.value === 'none' ? 'border-gray-400 bg-gray-100 text-gray-700' : 'border-indigo-500 bg-indigo-100 text-indigo-700 shadow-sm')
                                : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                            }`}>
                            <span>{opt.icon}</span> {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 md:border-l md:border-indigo-200 md:pl-4">
                      <label className="flex items-center gap-2 cursor-pointer text-sm">
                        <input type="checkbox" checked={excludeAgencies} onChange={(e) => setExcludeAgencies(e.target.checked)}
                          className="w-4 h-4 rounded border-gray-300 text-indigo-600" />
                        <span className="text-gray-700">Exclure les cabinets</span>
                      </label>
                    </div>
                  </div>
                  {recurrence !== 'none' && (
                    <div className="mt-3 flex items-center gap-2 text-xs text-indigo-700 bg-indigo-100/50 rounded-lg px-3 py-2">
                      <span>✨</span>
                      <span>Vous recevrez un email <strong>{recurrence === '2days' ? 'tous les 2 jours' : recurrence === 'weekly' ? 'chaque semaine' : 'chaque mois'}</strong> avec les nouvelles offres</span>
                    </div>
                  )}
                </div>

                {/* Error */}
                {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">❌ {error}</div>}

                {/* Actions */}
                {!loading ? (
                  <div className="flex items-center gap-4 pt-4 border-t border-gray-100">
                    <Button type="button" variant="outline" onClick={() => router.push('/searches')} className="h-11 px-6 rounded-xl">
                      Annuler
                    </Button>
                    <Button type="submit" disabled={extracting}
                      className="flex-1 h-11 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-lg shadow-indigo-500/30 font-semibold">
                      🚀 Lancer l'analyse
                    </Button>
                    <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-600 whitespace-nowrap">
                      <input type="checkbox" checked={addToFavorites} onChange={(e) => setAddToFavorites(e.target.checked)}
                        className="w-4 h-4 rounded border-gray-300 text-amber-500" />
                      ⭐ Favoris
                    </label>
                  </div>
                ) : (
                  <div className="pt-4">
                    <div className="relative h-12 rounded-xl bg-gradient-to-r from-indigo-100 to-purple-100 overflow-hidden">
                      <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-xl transition-all duration-1000"
                        style={{ width: `${Math.min(((loadingMessageIndex + 1) / LOADING_MESSAGES.length) * 100, 90)}%` }} />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-sm font-semibold text-white drop-shadow-md">
                          {LOADING_MESSAGES[loadingMessageIndex]?.icon} {LOADING_MESSAGES[loadingMessageIndex]?.text}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </form>
            )}

            {/* ========== LINKEDIN FORM ========== */}
            {activeTab === 'linkedin' && (
              <form onSubmit={handleLinkedInSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-semibold text-gray-800">Nom de la recherche *</Label>
                    <Input value={linkedinSearchName} onChange={(e) => setLinkedinSearchName(e.target.value)}
                      placeholder="Ex: Product Manager Paris" className="mt-1.5 h-10" required />
                  </div>
                  <div>
                    <Label className="text-sm font-semibold text-gray-800">Mots-clés *</Label>
                    <Input value={linkedinKeywords} onChange={(e) => setLinkedinKeywords(e.target.value)}
                      placeholder="Product Manager, Chef de projet digital..." className="mt-1.5 h-10" required />
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <Label className="text-xs font-medium text-gray-600">Localisation</Label>
                    <Input value={linkedinLocation} onChange={(e) => setLinkedinLocation(e.target.value)}
                      placeholder="Paris, Lyon..." className="mt-1 h-9" />
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-gray-600">Type de contrat</Label>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {['CDI', 'CDD', 'Freelance'].map((type) => (
                        <button key={type} type="button"
                          onClick={() => setLinkedinContractTypes(prev => prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type])}
                          className={`px-3 py-1.5 text-xs rounded-lg border-2 font-medium transition-all ${linkedinContractTypes.includes(type) ? 'border-[#0A66C2] bg-blue-50 text-[#0A66C2]' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                          {type}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-gray-600">Publié il y a</Label>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {[{ v: '24h', l: '24h' }, { v: 'week', l: '7 jours' }, { v: 'month', l: '30 jours' }].map((opt) => (
                        <button key={opt.v} type="button" onClick={() => setLinkedinPostedWithin(opt.v)}
                          className={`px-2.5 py-1.5 text-xs rounded-lg border-2 font-medium transition-all ${linkedinPostedWithin === opt.v ? 'border-[#0A66C2] bg-blue-50 text-[#0A66C2]' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                          {opt.l}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-end pb-1">
                    <label className="flex items-center gap-2 cursor-pointer text-sm">
                      <input type="checkbox" checked={linkedinExcludeAgencies} onChange={(e) => setLinkedinExcludeAgencies(e.target.checked)}
                        className="w-4 h-4 rounded border-gray-300" style={{ accentColor: '#0A66C2' }} />
                      <span className="text-gray-700">Exclure les cabinets</span>
                    </label>
                  </div>
                </div>

                {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">❌ {error}</div>}

                {!loading ? (
                  <div className="flex items-center gap-4 pt-4 border-t border-gray-100">
                    <Button type="button" variant="outline" onClick={() => router.push('/searches')} className="h-11 px-6 rounded-xl">
                      Annuler
                    </Button>
                    <Button type="submit" className="flex-1 h-11 rounded-xl text-white shadow-lg font-semibold" style={{ backgroundColor: '#0A66C2' }}>
                      🔍 Lancer la recherche LinkedIn
                    </Button>
                  </div>
                ) : (
                  <div className="pt-4">
                    <div className="relative h-12 rounded-xl overflow-hidden" style={{ backgroundColor: '#E7F0F9' }}>
                      <div className="absolute inset-y-0 left-0 rounded-xl transition-all duration-1000"
                        style={{ backgroundColor: '#0A66C2', width: `${Math.min(((loadingMessageIndex + 1) / LOADING_MESSAGES.length) * 100, 90)}%` }} />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-sm font-semibold text-white drop-shadow-md">
                          {LOADING_MESSAGES[loadingMessageIndex]?.icon} {LOADING_MESSAGES[loadingMessageIndex]?.text}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </form>
            )}

          </div>
        </div>
      </div>
    </AppLayout>
  )
}
