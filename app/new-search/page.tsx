'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card } from '@/components/ui/card'
import AppLayout from '@/components/AppLayout'
import { supabase } from '@/lib/supabase'

// Messages de chargement
const LOADING_MESSAGES = [
  { text: "Connexion aux jobboards...", icon: "🔌" },
  { text: "Recherche sur Adzuna...", icon: "🔍" },
  { text: "Recherche sur LinkedIn...", icon: "💼" },
  { text: "Recherche sur Indeed...", icon: "🏢" },
  { text: "Analyse des offres trouvées...", icon: "📊" },
  { text: "Filtrage des cabinets de recrutement...", icon: "🚫" },
  { text: "Scoring des meilleures offres avec l'IA...", icon: "🤖" },
  { text: "Préparation de vos résultats...", icon: "✨" },
]

const LINKEDIN_POSTS_LOADING_MESSAGES = [
  { text: "Construction des requêtes de recherche...", icon: "🔧" },
  { text: "Recherche de posts LinkedIn...", icon: "🔍" },
  { text: "Scraping des publications en cours...", icon: "📡" },
  { text: "Collecte des posts pertinents...", icon: "📥" },
  { text: "Analyse des publications avec l'IA...", icon: "📝" },
  { text: "Extraction des offres d'emploi...", icon: "🤖" },
  { text: "Identification des postes ouverts...", icon: "🎯" },
  { text: "Filtrage et scoring des résultats...", icon: "📊" },
  { text: "Encore quelques instants...", icon: "⏳" },
  { text: "Préparation de vos résultats...", icon: "✨" },
]

export default function NewSearchPage() {
  const router = useRouter()

  // Onglet actif
  const [activeTab, setActiveTab] = useState<'standard' | 'linkedin'>('standard')

  // États du formulaire standard
  const [searchTitle, setSearchTitle] = useState('')
  const [excludeAgencies, setExcludeAgencies] = useState(true)

  // Champs Standard
  const [jobTitle, setJobTitle] = useState('')
  const [location, setLocation] = useState('')
  const [contractTypes, setContractTypes] = useState<string[]>([])
  const [remoteOptions, setRemoteOptions] = useState<string[]>([])
  const [seniority, setSeniority] = useState('')
  const [brief, setBrief] = useState('')

  // Champs CV
  const [cvText, setCvText] = useState('')
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [extracting, setExtracting] = useState(false)

  // Récurrence
  const [recurrence, setRecurrence] = useState<'none' | '2days' | 'weekly' | 'monthly'>('none')

  // LinkedIn Posts search
  const [lpSearchTitle, setLpSearchTitle] = useState('')
  const [lpKeywords, setLpKeywords] = useState('')
  const [lpLocation, setLpLocation] = useState('')
  const [lpContractTypes, setLpContractTypes] = useState<string[]>([])
  const [lpExcludeAgencies, setLpExcludeAgencies] = useState(true)
  const [lpPostedLimit, setLpPostedLimit] = useState<string>('week')
  const [lpLoading, setLpLoading] = useState(false)
  const [lpError, setLpError] = useState('')
  const [lpLoadingMessageIndex, setLpLoadingMessageIndex] = useState(0)

  // États UI
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0)

  // Cycle through loading messages
  useEffect(() => {
    if (!loading) {
      setLoadingMessageIndex(0)
      return
    }

    const interval = setInterval(() => {
      setLoadingMessageIndex(prev =>
        prev < LOADING_MESSAGES.length - 1 ? prev + 1 : prev
      )
    }, 4000)

    return () => clearInterval(interval)
  }, [loading])

  // Cycle through LinkedIn posts loading messages
  useEffect(() => {
    if (!lpLoading) {
      setLpLoadingMessageIndex(0)
      return
    }

    const interval = setInterval(() => {
      setLpLoadingMessageIndex(prev => {
        if (prev >= LINKEDIN_POSTS_LOADING_MESSAGES.length - 1) return 4
        return prev + 1
      })
    }, 10000)

    return () => clearInterval(interval)
  }, [lpLoading])

  // Extraction texte PDF
  const extractPdfText = async (file: File): Promise<string> => {
    const pdfjsLib = await import('pdfjs-dist')
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`
    const arrayBuffer = await file.arrayBuffer()
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
    let fullText = ''
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      const textContent = await page.getTextContent()
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ')
      fullText += pageText + '\n'
    }
    return fullText
  }

  // Extraction texte DOCX
  const extractDocxText = async (file: File): Promise<string> => {
    const mammoth = await import('mammoth')
    const arrayBuffer = await file.arrayBuffer()
    const result = await mammoth.extractRawText({ arrayBuffer })
    return result.value
  }

  // Extraction texte TXT
  const extractTxtText = async (file: File): Promise<string> => {
    return await file.text()
  }

  // Handler upload fichier
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadedFile(file)
    setExtracting(true)
    setError('')

    try {
      let text = ''

      if (file.type === 'application/pdf') {
        text = await extractPdfText(file)
      } else if (
        file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        file.name.endsWith('.docx')
      ) {
        text = await extractDocxText(file)
      } else if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
        text = await extractTxtText(file)
      } else {
        throw new Error('Format non supporté. Utilisez PDF, DOCX ou TXT.')
      }

      setCvText(text)
    } catch (err: any) {
      setError(err.message || 'Erreur lors de l\'extraction du texte')
      setUploadedFile(null)
    } finally {
      setExtracting(false)
    }
  }

  // Supprimer le fichier uploadé
  const removeFile = () => {
    setUploadedFile(null)
    setCvText('')
  }

  // Validation formulaire
  const validateForm = (): boolean => {
    if (!searchTitle.trim()) {
      setError('Le titre de la recherche est obligatoire')
      return false
    }

    if (!cvText && !jobTitle && !location && !brief) {
      setError('Remplissez au moins un champ (CV ou critères de recherche)')
      return false
    }

    return true
  }

  // Soumission LinkedIn Posts
  const handleLinkedInPostsSubmit = async () => {
    setLpError('')

    if (!lpKeywords.trim()) {
      setLpError('Les mots-clés sont obligatoires')
      return
    }

    setLpLoading(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setLpError('Vous devez être connecté pour lancer une recherche')
        setLpLoading(false)
        return
      }

      const response = await fetch('/api/search-linkedin-posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: lpSearchTitle || null,
          keywords: lpKeywords,
          location: lpLocation || null,
          contract_types: lpContractTypes.length > 0 ? lpContractTypes : null,
          posted_limit: lpPostedLimit,
          exclude_agencies: lpExcludeAgencies,
          user_id: session.user.id,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erreur lors de la recherche')
      }

      router.push(`/searches/${data.search_id}`)
    } catch (err: any) {
      setLpError(err.message || 'Une erreur est survenue')
    } finally {
      setLpLoading(false)
    }
  }

  // Soumission du formulaire standard
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!validateForm()) return

    setLoading(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setError('Vous devez être connecté pour lancer une recherche')
        setLoading(false)
        return
      }

      const response = await fetch('/api/analyze-cv', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: searchTitle,
          search_type: 'both',
          exclude_agencies: excludeAgencies,

          job_title: jobTitle || null,
          location: location || null,
          contract_types: contractTypes.length > 0 ? contractTypes : null,
          remote_options: remoteOptions.length > 0 ? remoteOptions : null,
          seniority: seniority || null,
          brief: brief || null,

          cv_text: cvText || null,

          recurrence: recurrence !== 'none' ? recurrence : null,

          user_id: session.user.id,
          filename: uploadedFile?.name || 'pasted_cv.txt',
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erreur lors de l\'analyse')
      }

      router.push(`/searches/${data.search_id}`)

    } catch (err: any) {
      setError(err.message || 'Une erreur est survenue')
    } finally {
      setLoading(false)
    }
  }

  const accentColor = activeTab === 'standard' ? '#6366F1' : '#0A66C2'

  return (
    <AppLayout>
      <div className="p-4 md:p-8">
        <div className="max-w-4xl mx-auto">

          {/* Page Header */}
          <h1 className="text-3xl font-bold text-text mb-2">Nouvelle Recherche</h1>
          <p className="mb-6" style={{ color: '#457B9D' }}>
            Trouvez les meilleures opportunités pour votre profil ou vos critères
          </p>

          {/* Segmented Control */}
          <div className="flex bg-gray-100 rounded-xl p-1.5 mb-6 gap-1">
            <button
              type="button"
              onClick={() => setActiveTab('standard')}
              className={`flex-1 flex flex-col items-center gap-1 py-3 px-4 rounded-lg transition-all duration-300 ${
                activeTab === 'standard'
                  ? 'bg-white shadow-sm'
                  : 'hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center gap-2">
                <svg className={`w-4 h-4 ${activeTab === 'standard' ? 'text-indigo-600' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <span className={`text-sm font-semibold ${activeTab === 'standard' ? 'text-indigo-600' : 'text-gray-500'}`}>
                  Recherche standard
                </span>
              </div>
              <span className={`text-xs ${activeTab === 'standard' ? 'text-gray-500' : 'text-gray-400'}`}>
                LinkedIn, Indeed et autres jobboards
              </span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('linkedin')}
              className={`flex-1 flex flex-col items-center gap-1 py-3 px-4 rounded-lg transition-all duration-300 ${
                activeTab === 'linkedin'
                  ? 'bg-white shadow-sm'
                  : 'hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center gap-2">
                <svg className={`w-4 h-4 ${activeTab === 'linkedin' ? '' : 'text-gray-400'}`} fill="currentColor" viewBox="0 0 24 24" style={activeTab === 'linkedin' ? { color: '#0A66C2' } : {}}>
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                </svg>
                <span className={`text-sm font-semibold`} style={activeTab === 'linkedin' ? { color: '#0A66C2' } : { color: '#9CA3AF' }}>
                  Posts LinkedIn
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white" style={{ backgroundColor: '#0A66C2' }}>BETA</span>
              </div>
              <span className={`text-xs ${activeTab === 'linkedin' ? 'text-gray-500' : 'text-gray-400'}`}>
                Offres publiees directement par les recruteurs
              </span>
            </button>
          </div>

          {/* Card unique avec accent top border */}
          <Card
            className="p-4 md:p-8 border-t-4 transition-colors duration-300"
            style={{ borderTopColor: accentColor }}
          >
            {activeTab === 'standard' ? (
              /* ========== FORMULAIRE STANDARD ========== */
              <form onSubmit={handleSubmit} className="space-y-6">

                {/* Titre de la recherche */}
                <div>
                  <Label htmlFor="searchTitle" className="text-lg font-semibold">
                    Titre de la recherche <span className="text-accent">*</span>
                  </Label>
                  <Input
                    id="searchTitle"
                    value={searchTitle}
                    onChange={(e) => setSearchTitle(e.target.value)}
                    placeholder="Ex: Dev React Senior - Janvier 2026"
                    className="mt-2"
                    required
                  />
                </div>

                {/* CV Upload */}
                <div className="p-5 bg-secondary rounded-lg">
                  <div className="flex items-center gap-2 mb-3">
                    <h3 className="font-semibold text-base">CV</h3>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-600">BETA</span>
                    <span className="text-xs text-muted">- optionnel</span>
                  </div>
                  <Label htmlFor="fileUpload" className="cursor-pointer">
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-accent transition-colors">
                      {uploadedFile ? (
                        <div className="space-y-2">
                          <p className="text-sm font-medium">✅ {uploadedFile.name}</p>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={removeFile}
                          >
                            Supprimer
                          </Button>
                        </div>
                      ) : (
                        <>
                          <p className="text-sm">
                            📁 <span className="text-accent underline">Parcourir</span> ou déposer un fichier ici
                          </p>
                          <p className="text-xs text-muted mt-1">
                            PDF, DOCX ou TXT (max 5MB)
                          </p>
                        </>
                      )}
                    </div>
                    <input
                      id="fileUpload"
                      type="file"
                      accept=".pdf,.docx,.doc,.txt"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </Label>

                  {extracting && (
                    <p className="text-sm text-muted mt-2">⏳ Extraction en cours...</p>
                  )}
                </div>

                {/* Critères de recherche */}
                <div className="p-5 bg-secondary rounded-lg space-y-4">
                  <h3 className="font-semibold text-base">Critères de recherche (optionnel)</h3>

                  {/* Grille 3 colonnes */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="jobTitle">Titre du job</Label>
                      <Input
                        id="jobTitle"
                        value={jobTitle}
                        onChange={(e) => setJobTitle(e.target.value)}
                        placeholder="Ex: Product Owner"
                        className="mt-1"
                      />
                    </div>

                    <div>
                      <Label htmlFor="location">Lieu</Label>
                      <Input
                        id="location"
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        placeholder="Ex: Paris"
                        className="mt-1"
                      />
                    </div>

                    <div>
                      <Label htmlFor="seniority">Séniorité</Label>
                      <select
                        id="seniority"
                        value={seniority}
                        onChange={(e) => setSeniority(e.target.value)}
                        className="mt-1 w-full px-3 py-2 border rounded-md"
                      >
                        <option value="">Choisir...</option>
                        <option value="junior">Junior (0-2 ans)</option>
                        <option value="confirmé">Confirmé (2-5 ans)</option>
                        <option value="senior">Senior (5+ ans)</option>
                        <option value="expert">Expert (10+ ans)</option>
                      </select>
                    </div>
                  </div>

                  {/* Type de contrat */}
                  <div>
                    <Label>Type de contrat</Label>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {['CDI', 'CDD', 'Freelance', 'Stage'].map((type) => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => {
                            setContractTypes(prev =>
                              prev.includes(type)
                                ? prev.filter(t => t !== type)
                                : [...prev, type]
                            )
                          }}
                          className={`px-3 py-1.5 text-sm rounded-lg border-2 font-medium transition-all ${
                            contractTypes.includes(type)
                              ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                              : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                          }`}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Remote */}
                  <div>
                    <Label>Remote</Label>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {['On-site', 'Hybrid', 'Full remote'].map((option) => (
                        <button
                          key={option}
                          type="button"
                          onClick={() => {
                            setRemoteOptions(prev =>
                              prev.includes(option)
                                ? prev.filter(o => o !== option)
                                : [...prev, option]
                            )
                          }}
                          className={`px-3 py-1.5 text-sm rounded-lg border-2 font-medium transition-all ${
                            remoteOptions.includes(option)
                              ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                              : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                          }`}
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Brief */}
                  <div>
                    <Label htmlFor="brief">Infos/Brief rapide (compétences, stacks...)</Label>
                    <Textarea
                      id="brief"
                      value={brief}
                      onChange={(e) => setBrief(e.target.value)}
                      placeholder="Ex: React, TypeScript, Node.js, expérience startup, etc."
                      rows={3}
                      className="mt-1"
                    />
                  </div>
                </div>

                {/* Exclure cabinets */}
                <div className="flex items-center space-x-3 p-4 bg-secondary rounded-lg">
                  <input
                    type="checkbox"
                    id="excludeAgencies"
                    checked={excludeAgencies}
                    onChange={(e) => setExcludeAgencies(e.target.checked)}
                    className="w-5 h-5 text-accent rounded focus:ring-2 focus:ring-accent"
                  />
                  <label htmlFor="excludeAgencies" className="text-sm">
                    <span className="font-medium">Exclure les cabinets de recrutement</span>
                    <span className="text-muted block text-xs mt-1">
                      (Michael Page, Robert Half, Hays, etc.)
                    </span>
                  </label>
                </div>

                {/* Récurrence */}
                <div className="p-5 bg-secondary rounded-lg">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: '#A8DADC' }}>
                      <span className="text-xl">🔄</span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-base">Recherche récurrente</h3>
                      <p className="text-sm text-muted">Relancer automatiquement cette recherche</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { value: 'none' as const, label: 'Une seule fois', sub: 'Pas de récurrence' },
                      { value: '2days' as const, label: 'Tous les 2 jours', sub: '~15/mois' },
                      { value: 'weekly' as const, label: 'Hebdomadaire', sub: '~4/mois' },
                      { value: 'monthly' as const, label: 'Mensuel', sub: '1/mois' },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setRecurrence(opt.value)}
                        className={`px-4 py-3 rounded-lg border-2 transition-all ${
                          recurrence === opt.value
                            ? 'border-accent bg-accent/10'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <p className="font-medium" style={{ color: recurrence === opt.value ? '#6366F1' : '#1D3557' }}>{opt.label}</p>
                        <p className="text-xs mt-1" style={{ color: '#457B9D' }}>{opt.sub}</p>
                      </button>
                    ))}
                  </div>

                  {recurrence !== 'none' && (
                    <p className="text-sm mt-4 p-3 rounded-lg" style={{ backgroundColor: '#FEF3C7', color: '#92400E' }}>
                      ⚡ Les nouvelles offres seront automatiquement ajoutées à cette recherche {
                        recurrence === '2days' ? 'tous les 2 jours' :
                        recurrence === 'weekly' ? 'chaque semaine' :
                        'chaque mois'
                      }.
                    </p>
                  )}
                </div>

                {/* Messages d'erreur */}
                {error && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-600">❌ {error}</p>
                  </div>
                )}

                {/* Boutons submit */}
                <div className="flex flex-col sm:flex-row gap-4 pt-4">
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
                    disabled={loading || extracting}
                    className="flex-1"
                  >
                    {loading ? '⏳ Analyse en cours...' : '🚀 Lancer l\'analyse'}
                  </Button>
                </div>

                {/* Barre de progression */}
                {loading && (
                  <div className="mt-6 p-6 rounded-xl bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100">
                    <div className="flex items-center gap-4 mb-4">
                      <div className="text-3xl animate-bounce">
                        {LOADING_MESSAGES[loadingMessageIndex].icon}
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-gray-800">
                          {LOADING_MESSAGES[loadingMessageIndex].text}
                        </p>
                        <p className="text-sm text-gray-500">
                          Un instant, on trouve les meilleures offres...
                        </p>
                      </div>
                    </div>

                    <div className="w-full h-2 bg-white rounded-full overflow-hidden shadow-inner">
                      <div
                        className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-full transition-all duration-700 ease-out relative overflow-hidden"
                        style={{
                          width: `${((loadingMessageIndex + 1) / LOADING_MESSAGES.length) * 100}%`
                        }}
                      >
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-pulse" />
                      </div>
                    </div>

                    <div className="flex justify-center gap-2 mt-4">
                      {LOADING_MESSAGES.map((_, index) => (
                        <div
                          key={index}
                          className={`w-2 h-2 rounded-full transition-all duration-300 ${
                            index <= loadingMessageIndex
                              ? 'bg-indigo-500 scale-110'
                              : 'bg-gray-300'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </form>
            ) : (
              /* ========== FORMULAIRE LINKEDIN ========== */
              <div className="space-y-6">
                {/* Header LinkedIn */}
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: '#0A66C2' }}>
                    <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-lg font-bold" style={{ color: '#1D3557' }}>Recherche LinkedIn</h2>
                    <p className="text-sm" style={{ color: '#457B9D' }}>
                      Scanne les posts LinkedIn pour trouver les personnes qui publient activement des offres d&apos;embauche (CDI, freelance, alternance...). Identifiez les opportunites avant tout le monde.
                    </p>
                  </div>
                </div>

                {/* Nom de la recherche */}
                <div>
                  <Label htmlFor="lpSearchTitle">Nom de la recherche</Label>
                  <Input
                    id="lpSearchTitle"
                    value={lpSearchTitle}
                    onChange={(e) => setLpSearchTitle(e.target.value)}
                    placeholder="Ex: Posts recruteurs React Paris"
                    className="mt-1"
                  />
                </div>

                {/* Mots-cles */}
                <div>
                  <Label htmlFor="lpKeywords">
                    Mots-cles / Titre du poste <span style={{ color: '#0A66C2' }}>*</span>
                  </Label>
                  <Input
                    id="lpKeywords"
                    value={lpKeywords}
                    onChange={(e) => setLpKeywords(e.target.value)}
                    placeholder="Ex: developpeur react, data engineer, product manager..."
                    className="mt-1"
                    required
                  />
                </div>

                {/* Localisation */}
                <div>
                  <Label htmlFor="lpLocation">Localisation</Label>
                  <Input
                    id="lpLocation"
                    value={lpLocation}
                    onChange={(e) => setLpLocation(e.target.value)}
                    placeholder="Ex: Paris, Lyon, Remote..."
                    className="mt-1"
                  />
                </div>

                {/* Type de contrat */}
                <div>
                  <Label>Type de contrat</Label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {['CDI', 'CDD', 'Freelance', 'Stage'].map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => {
                          setLpContractTypes(prev =>
                            prev.includes(type)
                              ? prev.filter(t => t !== type)
                              : [...prev, type]
                          )
                        }}
                        className={`px-3 py-1.5 text-sm rounded-lg border-2 font-medium transition-all ${
                          lpContractTypes.includes(type)
                            ? 'text-white'
                            : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                        }`}
                        style={lpContractTypes.includes(type) ? { borderColor: '#0A66C2', backgroundColor: '#0A66C2' } : {}}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Filtre date de publication */}
                <div>
                  <Label>Publie il y a</Label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {[
                      { value: '24h', label: '- 24h' },
                      { value: '3days', label: '- 3 jours' },
                      { value: 'week', label: '- 1 semaine' },
                      { value: 'older_week', label: '+ 1 semaine' },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setLpPostedLimit(opt.value)}
                        className={`px-3 py-1.5 text-sm rounded-lg border-2 font-medium transition-all ${
                          lpPostedLimit === opt.value
                            ? 'text-white'
                            : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                        }`}
                        style={lpPostedLimit === opt.value ? { borderColor: '#0A66C2', backgroundColor: '#0A66C2' } : {}}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Exclure cabinets */}
                <div className="flex items-center space-x-3 p-3 bg-secondary rounded-lg">
                  <input
                    type="checkbox"
                    id="lpExcludeAgencies"
                    checked={lpExcludeAgencies}
                    onChange={(e) => setLpExcludeAgencies(e.target.checked)}
                    className="w-5 h-5 rounded focus:ring-2"
                    style={{ accentColor: '#0A66C2' }}
                  />
                  <label htmlFor="lpExcludeAgencies" className="text-sm">
                    <span className="font-medium">Exclure les cabinets de recrutement</span>
                  </label>
                </div>

                {/* Error */}
                {lpError && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-600">{lpError}</p>
                  </div>
                )}

                {/* Submit button */}
                <Button
                  type="button"
                  onClick={handleLinkedInPostsSubmit}
                  disabled={lpLoading || !lpKeywords.trim()}
                  className="w-full"
                  style={{ backgroundColor: '#0A66C2', color: 'white' }}
                >
                  {lpLoading ? 'Recherche en cours...' : 'Lancer la recherche LinkedIn'}
                </Button>

                {/* Loading progress */}
                {lpLoading && (
                  <div className="p-6 rounded-xl border" style={{ backgroundColor: '#F0F7FF', borderColor: '#0A66C2' }}>
                    <div className="flex items-center gap-4 mb-4">
                      <div className="text-3xl animate-bounce">
                        {LINKEDIN_POSTS_LOADING_MESSAGES[lpLoadingMessageIndex].icon}
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-gray-800">
                          {LINKEDIN_POSTS_LOADING_MESSAGES[lpLoadingMessageIndex].text}
                        </p>
                        <p className="text-sm text-gray-500">
                          Analyse des posts LinkedIn...
                        </p>
                      </div>
                    </div>

                    <div className="w-full h-2 bg-white rounded-full overflow-hidden shadow-inner">
                      <div
                        className="h-full rounded-full transition-all duration-700 ease-out relative overflow-hidden"
                        style={{
                          backgroundColor: '#0A66C2',
                          width: `${((lpLoadingMessageIndex + 1) / LINKEDIN_POSTS_LOADING_MESSAGES.length) * 100}%`
                        }}
                      >
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-pulse" />
                      </div>
                    </div>

                    <div className="flex justify-center gap-2 mt-4">
                      {LINKEDIN_POSTS_LOADING_MESSAGES.map((_, index) => (
                        <div
                          key={index}
                          className={`w-2 h-2 rounded-full transition-all duration-300 ${
                            index <= lpLoadingMessageIndex
                              ? 'scale-110'
                              : 'bg-gray-300'
                          }`}
                          style={index <= lpLoadingMessageIndex ? { backgroundColor: '#0A66C2' } : {}}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>
      </div>
    </AppLayout>
  )
}
