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
  const [seniority, setSeniority] = useState('')
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
          seniority: seniority || null,
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
      <div className="p-3 md:p-4 h-[calc(100vh-60px)] overflow-hidden">
        <div className="max-w-5xl mx-auto h-full flex flex-col">

          {/* Header compact */}
          <div className="flex items-center gap-2 mb-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-gray-900">Nouvelle Recherche</h1>
          </div>

          {/* Tabs */}
          <div className="flex bg-gray-100 rounded-lg p-0.5 mb-3">
            <button type="button" onClick={() => setActiveTab('standard')}
              className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all ${activeTab === 'standard' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500'}`}>
              Recherche standard
            </button>
            <button type="button" onClick={() => setActiveTab('linkedin')}
              className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-1.5 ${activeTab === 'linkedin' ? 'bg-white shadow-sm' : 'text-gray-500'}`}
              style={activeTab === 'linkedin' ? { color: '#0A66C2' } : {}}>
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
              </svg>
              LinkedIn
            </button>
          </div>

          {/* Card */}
          <div className={`flex-1 bg-white rounded-xl p-4 shadow-lg border-t-4 overflow-y-auto ${activeTab === 'standard' ? 'border-t-indigo-500' : 'border-t-[#0A66C2]'}`}>

            {/* ========== STANDARD FORM ========== */}
            {activeTab === 'standard' && (
              <form onSubmit={handleSubmit} className="space-y-3">

                {/* Row 1: Titre + Profil */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Titre */}
                  <div>
                    <Label className="text-sm font-medium">Titre de la recherche *</Label>
                    <Input value={searchTitle} onChange={(e) => setSearchTitle(e.target.value)}
                      placeholder="Ex: Dev React Senior - Jan 2026" className="mt-1 h-9" required />
                  </div>

                  {/* Profil candidat */}
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">Profil candidat <span className="text-gray-400 text-xs">(optionnel)</span></span>
                      <div className="flex bg-gray-200 rounded p-0.5 text-xs">
                        <button type="button" onClick={() => setInputMode('cv')}
                          className={`px-2 py-1 rounded ${inputMode === 'cv' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500'}`}>CV</button>
                        <button type="button" onClick={() => setInputMode('linkedin')}
                          className={`px-2 py-1 rounded ${inputMode === 'linkedin' ? 'bg-white shadow-sm' : 'text-gray-500'}`}
                          style={inputMode === 'linkedin' ? { color: '#0A66C2' } : {}}>LinkedIn</button>
                      </div>
                    </div>
                    {inputMode === 'cv' ? (
                      <label className="cursor-pointer block">
                        <div className="border border-dashed border-gray-300 rounded-lg p-2 text-center text-sm hover:border-indigo-400 transition-colors">
                          {uploadedFile ? (
                            <div className="flex items-center justify-between">
                              <span className="text-green-600 text-xs">✓ {uploadedFile.name}</span>
                              <button type="button" onClick={removeFile} className="text-red-500 text-xs hover:underline">Supprimer</button>
                            </div>
                          ) : extracting ? (
                            <span className="text-gray-500 text-xs">⏳ Extraction...</span>
                          ) : (
                            <span className="text-gray-500 text-xs">📄 Déposer CV (PDF, DOCX, TXT)</span>
                          )}
                        </div>
                        <input type="file" accept=".pdf,.docx,.txt" onChange={handleFileUpload} className="hidden" />
                      </label>
                    ) : (
                      <Input value={linkedinUrl} onChange={(e) => setLinkedinUrl(e.target.value)}
                        placeholder="https://linkedin.com/in/nom" className="h-8 text-sm" />
                    )}
                  </div>
                </div>

                {/* Row 2: Critères principaux */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <div>
                    <Label className="text-xs text-gray-600">Titre du poste</Label>
                    <Input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} placeholder="Product Owner" className="mt-0.5 h-8 text-sm" />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-600">Lieu</Label>
                    <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Paris" className="mt-0.5 h-8 text-sm" />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-600">Séniorité</Label>
                    <select value={seniority} onChange={(e) => setSeniority(e.target.value)} className="mt-0.5 w-full h-8 text-sm border rounded-md px-2">
                      <option value="">Tous</option>
                      <option value="junior">Junior</option>
                      <option value="confirmé">Confirmé</option>
                      <option value="senior">Senior</option>
                    </select>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-600">Récurrence</Label>
                    <select value={recurrence} onChange={(e) => setRecurrence(e.target.value as any)} className="mt-0.5 w-full h-8 text-sm border rounded-md px-2">
                      <option value="none">Une fois</option>
                      <option value="2days">/ 2 jours</option>
                      <option value="weekly">/ semaine</option>
                      <option value="monthly">/ mois</option>
                    </select>
                  </div>
                </div>

                {/* Row 3: Filtres toggle */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* Contrat */}
                  <div>
                    <Label className="text-xs text-gray-600">Type de contrat</Label>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {['CDI', 'CDD', 'Freelance', 'Stage'].map((type) => (
                        <button key={type} type="button"
                          onClick={() => setContractTypes(prev => prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type])}
                          className={`px-2 py-1 text-xs rounded border font-medium transition-all ${contractTypes.includes(type) ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                          {type}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Remote */}
                  <div>
                    <Label className="text-xs text-gray-600">Remote</Label>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {['On-site', 'Hybrid', 'Remote'].map((opt) => (
                        <button key={opt} type="button"
                          onClick={() => setRemoteOptions(prev => prev.includes(opt) ? prev.filter(o => o !== opt) : [...prev, opt])}
                          className={`px-2 py-1 text-xs rounded border font-medium transition-all ${remoteOptions.includes(opt) ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Date */}
                  <div>
                    <Label className="text-xs text-gray-600">Date de publication</Label>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {[{ v: 7, l: '-1 sem' }, { v: 14, l: '-2 sem' }, { v: 30, l: '-1 mois' }, { v: 31, l: '+1 mois' }, { v: 90, l: '+3 mois' }].map((opt) => (
                        <button key={opt.v} type="button" onClick={() => setMaxDaysOld(opt.v)}
                          className={`px-2 py-1 text-xs rounded border font-medium transition-all ${maxDaysOld === opt.v ? (opt.v >= 31 ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-indigo-500 bg-indigo-50 text-indigo-700') : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                          {opt.l}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Row 4: Brief + Options */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="md:col-span-2">
                    <Label className="text-xs text-gray-600">Brief / Compétences</Label>
                    <Input value={brief} onChange={(e) => setBrief(e.target.value)}
                      placeholder="React, TypeScript, AWS, startup..." className="mt-0.5 h-8 text-sm" />
                  </div>
                  <div className="flex items-end">
                    <label className="flex items-center gap-2 cursor-pointer text-sm">
                      <input type="checkbox" checked={excludeAgencies} onChange={(e) => setExcludeAgencies(e.target.checked)}
                        className="w-4 h-4 rounded border-gray-300 text-indigo-600" />
                      <span className="text-gray-700">Exclure cabinets</span>
                    </label>
                  </div>
                </div>

                {/* Error */}
                {error && <div className="p-2 bg-red-50 border border-red-200 rounded text-sm text-red-600">❌ {error}</div>}

                {/* Actions */}
                {!loading ? (
                  <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
                    <Button type="button" variant="outline" onClick={() => router.push('/searches')} className="h-10 px-6 rounded-lg">
                      Annuler
                    </Button>
                    <Button type="submit" disabled={extracting}
                      className="flex-1 h-10 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-lg">
                      🚀 Lancer l'analyse
                    </Button>
                    <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-600 whitespace-nowrap">
                      <input type="checkbox" checked={addToFavorites} onChange={(e) => setAddToFavorites(e.target.checked)}
                        className="w-4 h-4 rounded border-gray-300 text-amber-500" />
                      ⭐ Favoris
                    </label>
                  </div>
                ) : (
                  <div className="pt-2">
                    <div className="relative h-10 rounded-lg bg-gradient-to-r from-indigo-100 to-purple-100 overflow-hidden">
                      <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-lg transition-all duration-1000"
                        style={{ width: `${Math.min(((loadingMessageIndex + 1) / LOADING_MESSAGES.length) * 100, 90)}%` }} />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-sm font-medium text-white drop-shadow">
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
              <form onSubmit={handleLinkedInSubmit} className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-sm font-medium">Nom de la recherche *</Label>
                    <Input value={linkedinSearchName} onChange={(e) => setLinkedinSearchName(e.target.value)}
                      placeholder="Ex: PM Paris" className="mt-1 h-9" required />
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Mots-clés *</Label>
                    <Input value={linkedinKeywords} onChange={(e) => setLinkedinKeywords(e.target.value)}
                      placeholder="Product Manager, Chef de projet..." className="mt-1 h-9" required />
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <Label className="text-xs text-gray-600">Localisation</Label>
                    <Input value={linkedinLocation} onChange={(e) => setLinkedinLocation(e.target.value)}
                      placeholder="Paris" className="mt-0.5 h-8 text-sm" />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-600">Contrat</Label>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {['CDI', 'CDD', 'Freelance'].map((type) => (
                        <button key={type} type="button"
                          onClick={() => setLinkedinContractTypes(prev => prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type])}
                          className={`px-2 py-1 text-xs rounded border font-medium ${linkedinContractTypes.includes(type) ? 'border-[#0A66C2] bg-blue-50 text-[#0A66C2]' : 'border-gray-200 text-gray-600'}`}>
                          {type}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-600">Publié</Label>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {[{ v: '24h', l: '24h' }, { v: 'week', l: '7j' }, { v: 'month', l: '30j' }].map((opt) => (
                        <button key={opt.v} type="button" onClick={() => setLinkedinPostedWithin(opt.v)}
                          className={`px-2 py-1 text-xs rounded border font-medium ${linkedinPostedWithin === opt.v ? 'border-[#0A66C2] bg-blue-50 text-[#0A66C2]' : 'border-gray-200 text-gray-600'}`}>
                          {opt.l}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-end">
                    <label className="flex items-center gap-2 cursor-pointer text-sm">
                      <input type="checkbox" checked={linkedinExcludeAgencies} onChange={(e) => setLinkedinExcludeAgencies(e.target.checked)}
                        className="w-4 h-4 rounded border-gray-300" style={{ accentColor: '#0A66C2' }} />
                      <span className="text-gray-700">Exclure cabinets</span>
                    </label>
                  </div>
                </div>

                {error && <div className="p-2 bg-red-50 border border-red-200 rounded text-sm text-red-600">❌ {error}</div>}

                {!loading ? (
                  <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
                    <Button type="button" variant="outline" onClick={() => router.push('/searches')} className="h-10 px-6 rounded-lg">
                      Annuler
                    </Button>
                    <Button type="submit" className="flex-1 h-10 rounded-lg text-white shadow-lg" style={{ backgroundColor: '#0A66C2' }}>
                      🔍 Lancer la recherche
                    </Button>
                  </div>
                ) : (
                  <div className="pt-2">
                    <div className="relative h-10 rounded-lg overflow-hidden" style={{ backgroundColor: '#E7F0F9' }}>
                      <div className="absolute inset-y-0 left-0 rounded-lg transition-all duration-1000"
                        style={{ backgroundColor: '#0A66C2', width: `${Math.min(((loadingMessageIndex + 1) / LOADING_MESSAGES.length) * 100, 90)}%` }} />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-sm font-medium text-white drop-shadow">
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
