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

// Messages de chargement - Recherche standard
const LOADING_MESSAGES_STANDARD = [
  { text: "Analyse du profil avec l'IA...", icon: "🧠" },
  { text: "Connexion aux jobboards...", icon: "🔌" },
  { text: "Recherche sur LinkedIn...", icon: "💼" },
  { text: "Recherche sur Indeed...", icon: "🏢" },
  { text: "Recherche sur Glassdoor...", icon: "🔍" },
  { text: "Recherche sur WTTJ...", icon: "🌴" },
  { text: "Analyse des offres trouvées...", icon: "📊" },
  { text: "Filtrage des cabinets de recrutement...", icon: "🚫" },
  { text: "Scoring des meilleures offres avec l'IA...", icon: "🤖" },
  { text: "Préparation de vos résultats...", icon: "✨" },
]

// Messages de chargement - Recherche LinkedIn Posts
const LOADING_MESSAGES_LINKEDIN_POSTS = [
  { text: "Connexion à LinkedIn...", icon: "🔗" },
  { text: "Recherche des offres...", icon: "🔍" },
  { text: "Analyse des résultats...", icon: "📊" },
  { text: "Filtrage des cabinets de recrutement...", icon: "🚫" },
  { text: "Préparation de vos résultats...", icon: "✨" },
]

export default function NewSearchPage() {
  const router = useRouter()

  // Onglet principal
  const [activeTab, setActiveTab] = useState<'standard' | 'linkedin'>('standard')

  // États du formulaire standard
  const [searchTitle, setSearchTitle] = useState('')
  const [excludeAgencies, setExcludeAgencies] = useState(true)

  // Champs de recherche
  const [jobTitle, setJobTitle] = useState('')
  const [location, setLocation] = useState('')
  const [contractTypes, setContractTypes] = useState<string[]>([])
  const [remoteOptions, setRemoteOptions] = useState<string[]>([])
  const [seniority, setSeniority] = useState('')
  const [brief, setBrief] = useState('')

  // Champs CV
  const [cvText, setCvText] = useState('')
  const [cvBase64, setCvBase64] = useState<string | null>(null) // PDF en base64 pour Claude
  const [cvMediaType, setCvMediaType] = useState<string | null>(null)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [extracting, setExtracting] = useState(false)

  // LinkedIn URL (pour profil dans recherche standard)
  const [linkedinUrl, setLinkedinUrl] = useState('')
  const [inputMode, setInputMode] = useState<'cv' | 'linkedin'>('cv')

  // Récurrence
  const [recurrence, setRecurrence] = useState<'none' | '2days' | 'weekly' | 'monthly'>('none')

  // États LinkedIn Posts
  const [linkedinKeywords, setLinkedinKeywords] = useState('')
  const [linkedinLocation, setLinkedinLocation] = useState('')
  const [linkedinContractTypes, setLinkedinContractTypes] = useState<string[]>([])
  const [linkedinPostedWithin, setLinkedinPostedWithin] = useState<string>('week')
  const [linkedinSearchName, setLinkedinSearchName] = useState('')
  const [linkedinExcludeAgencies, setLinkedinExcludeAgencies] = useState(true)

  // États UI
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0)

  // Get the appropriate loading messages based on active tab
  const currentLoadingMessages = activeTab === 'linkedin'
    ? LOADING_MESSAGES_LINKEDIN_POSTS
    : LOADING_MESSAGES_STANDARD

  // Cycle through loading messages
  useEffect(() => {
    if (!loading) {
      setLoadingMessageIndex(0)
      return
    }

    const interval = setInterval(() => {
      setLoadingMessageIndex(prev =>
        prev < currentLoadingMessages.length - 1 ? prev + 1 : prev
      )
    }, 4000)

    return () => clearInterval(interval)
  }, [loading, currentLoadingMessages.length])

  // Extraction texte PDF - Algorithme intelligent avec détection de colonnes
  const extractPdfText = async (file: File): Promise<string> => {
    const pdfjsLib = await import('pdfjs-dist')
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`
    const arrayBuffer = await file.arrayBuffer()
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise

    let fullText = ''

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      const textContent = await page.getTextContent()
      const viewport = page.getViewport({ scale: 1 })
      const pageWidth = viewport.width
      const pageHeight = viewport.height

      // Extraire les items avec leurs positions
      const items: { text: string; x: number; y: number; width: number; height: number; fontSize: number }[] = []

      for (const item of textContent.items as any[]) {
        if (!item.str || item.str.trim() === '') continue

        const tx = item.transform
        const x = tx[4]
        const y = pageHeight - tx[5] // Inverser Y (PDF a l'origine en bas)
        const fontSize = Math.sqrt(tx[0] * tx[0] + tx[1] * tx[1])

        items.push({
          text: item.str,
          x,
          y,
          width: item.width || 0,
          height: fontSize,
          fontSize
        })
      }

      if (items.length === 0) continue

      // Détecter si le CV a 2 colonnes
      const xPositions = items.map(it => it.x)
      const midPoint = pageWidth / 2
      const leftItems = items.filter(it => it.x < midPoint - 50)
      const rightItems = items.filter(it => it.x >= midPoint - 50)
      const hasColumns = leftItems.length > 10 && rightItems.length > 10

      // Grouper les éléments en lignes (items avec Y similaire)
      const lineThreshold = 8 // pixels de tolérance
      const groupIntoLines = (elements: typeof items) => {
        const lines: typeof items[] = []
        const sorted = [...elements].sort((a, b) => a.y - b.y)

        for (const item of sorted) {
          const existingLine = lines.find(line =>
            Math.abs(line[0].y - item.y) < lineThreshold
          )
          if (existingLine) {
            existingLine.push(item)
          } else {
            lines.push([item])
          }
        }

        // Trier chaque ligne par X (gauche à droite)
        for (const line of lines) {
          line.sort((a, b) => a.x - b.x)
        }

        // Trier les lignes par Y
        lines.sort((a, b) => a[0].y - b[0].y)

        return lines
      }

      // Convertir les lignes en texte
      const linesToText = (lines: typeof items[]) => {
        const result: string[] = []
        let prevY = 0
        let prevFontSize = 0

        for (const line of lines) {
          const lineText = line.map(it => it.text).join(' ').trim()
          if (!lineText) continue

          const currentY = line[0].y
          const currentFontSize = Math.max(...line.map(it => it.fontSize))
          const gap = currentY - prevY

          // Détecter les sections (gros texte ou grand espace)
          const isSection = currentFontSize > 12 && (
            lineText.toUpperCase() === lineText ||
            /^(EXPÉRIENCE|EXPERIENCE|FORMATION|EDUCATION|COMPÉTENCES|SKILLS|PROFIL|CONTACT|LANGUES|LANGUAGES|CERTIFICATIONS|PROJETS|PROJECTS)/i.test(lineText)
          )

          // Ajouter des sauts de ligne pour la lisibilité
          if (prevY > 0 && gap > 20) {
            result.push('') // Ligne vide pour les grands espaces
          }

          if (isSection) {
            result.push('') // Ligne vide avant les sections
            result.push(`### ${lineText}`)
          } else {
            result.push(lineText)
          }

          prevY = currentY
          prevFontSize = currentFontSize
        }

        return result.join('\n')
      }

      if (hasColumns) {
        // CV à 2 colonnes : traiter séparément puis combiner intelligemment
        const leftLines = groupIntoLines(leftItems)
        const rightLines = groupIntoLines(rightItems)

        // Généralement : colonne gauche = infos perso/compétences, droite = expérience
        // On met la colonne droite (expérience) en premier car c'est le plus important
        const rightText = linesToText(rightLines)
        const leftText = linesToText(leftLines)

        // Déterminer l'ordre optimal basé sur le contenu
        const rightHasExperience = /expérience|experience|emploi|poste/i.test(rightText)
        const leftHasExperience = /expérience|experience|emploi|poste/i.test(leftText)

        if (rightHasExperience && !leftHasExperience) {
          fullText += leftText + '\n\n---\n\n' + rightText + '\n'
        } else {
          fullText += rightText + '\n\n---\n\n' + leftText + '\n'
        }
      } else {
        // CV à 1 colonne : lecture normale
        const lines = groupIntoLines(items)
        fullText += linesToText(lines) + '\n'
      }

      if (i < pdf.numPages) {
        fullText += '\n--- Page suivante ---\n\n'
      }
    }

    // Nettoyage final
    fullText = fullText
      .replace(/\n{4,}/g, '\n\n\n') // Max 3 sauts de ligne
      .replace(/[ \t]+/g, ' ') // Espaces multiples
      .replace(/^\s+|\s+$/g, '') // Trim

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

  // Convertir fichier en base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = () => {
        const result = reader.result as string
        // Enlever le préfixe "data:application/pdf;base64,"
        const base64 = result.split(',')[1]
        resolve(base64)
      }
      reader.onerror = reject
    })
  }

  // Handler upload fichier
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadedFile(file)
    setExtracting(true)
    setError('')
    setCvBase64(null)
    setCvMediaType(null)

    try {
      // Pour les PDFs : envoyer directement à Claude (meilleure qualité)
      if (file.type === 'application/pdf') {
        const base64 = await fileToBase64(file)
        setCvBase64(base64)
        setCvMediaType('application/pdf')
        setCvText('') // Pas besoin du texte extrait, Claude lira le PDF
      }
      // Pour DOCX : extraire le texte
      else if (
        file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        file.name.endsWith('.docx')
      ) {
        const text = await extractDocxText(file)
        setCvText(text)
      }
      // Pour TXT : lire directement
      else if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
        const text = await extractTxtText(file)
        setCvText(text)
      } else {
        throw new Error('Format non supporté. Utilisez PDF, DOCX ou TXT.')
      }
    } catch (err: any) {
      setError(err.message || 'Erreur lors du traitement du fichier')
      setUploadedFile(null)
      setCvBase64(null)
    } finally {
      setExtracting(false)
    }
  }

  // Supprimer le fichier uploadé
  const removeFile = () => {
    setUploadedFile(null)
    setCvText('')
    setCvBase64(null)
    setCvMediaType(null)
  }

  // Validation LinkedIn URL
  const isValidLinkedInUrl = (url: string): boolean => {
    const pattern = /^https?:\/\/(www\.)?linkedin\.com\/in\/[\w-]+\/?(\?.*)?$/
    return pattern.test(url)
  }

  // Validation formulaire
  const validateForm = (): boolean => {
    if (!searchTitle.trim()) {
      setError('Le titre de la recherche est obligatoire')
      return false
    }

    // Check if we have at least one valid input source
    const hasCV = (cvText && cvText.trim().length > 0) || cvBase64
    const hasLinkedIn = linkedinUrl && linkedinUrl.trim().length > 0
    const hasManualCriteria = jobTitle || location || brief

    if (!hasCV && !hasLinkedIn && !hasManualCriteria) {
      setError('Remplissez au moins un champ (CV, URL LinkedIn, ou critères de recherche)')
      return false
    }

    // Validate LinkedIn URL format if provided
    if (hasLinkedIn && !isValidLinkedInUrl(linkedinUrl)) {
      setError('URL LinkedIn invalide. Format attendu: https://linkedin.com/in/nom-prenom')
      return false
    }

    return true
  }

  // Soumission du formulaire
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

      // Determine input type
      const hasLinkedIn = linkedinUrl && linkedinUrl.trim().length > 0
      const hasCVText = cvText && cvText.trim().length > 0
      const hasCVPdf = cvBase64 !== null
      const hasCV = hasCVText || hasCVPdf
      const inputType = hasLinkedIn ? 'linkedin' : hasCV ? 'cv' : 'manual'

      const response = await fetch('/api/analyze-cv', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: searchTitle,
          search_type: 'both',
          input_type: inputType,
          exclude_agencies: excludeAgencies,

          job_title: jobTitle || null,
          location: location || null,
          contract_types: contractTypes.length > 0 ? contractTypes : null,
          remote_options: remoteOptions.length > 0 ? remoteOptions : null,
          seniority: seniority || null,
          brief: brief || null,

          cv_text: cvText || null,
          cv_base64: cvBase64 || null,        // PDF en base64 pour lecture directe
          cv_media_type: cvMediaType || null, // Type MIME du fichier
          linkedin_url: linkedinUrl || null,

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

  // Soumission du formulaire LinkedIn Posts
  const handleLinkedInPostsSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!linkedinSearchName.trim()) {
      setError('Le nom de la recherche est obligatoire')
      return
    }

    if (!linkedinKeywords.trim()) {
      setError('Les mots-clés sont obligatoires')
      return
    }

    setLoading(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setError('Vous devez être connecté pour lancer une recherche')
        setLoading(false)
        return
      }

      // For LinkedIn posts search, we use the same API but with specific parameters
      const response = await fetch('/api/analyze-cv', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: linkedinSearchName,
          search_type: 'both',
          input_type: 'manual',
          exclude_agencies: linkedinExcludeAgencies,

          job_title: linkedinKeywords,
          location: linkedinLocation || null,
          contract_types: linkedinContractTypes.length > 0 ? linkedinContractTypes : null,
          remote_options: null,
          seniority: null,
          brief: `Recherche LinkedIn - Publié: ${linkedinPostedWithin}`,

          cv_text: null,
          linkedin_url: null,
          recurrence: null,

          user_id: session.user.id,
          filename: null,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erreur lors de la recherche')
      }

      router.push(`/searches/${data.search_id}`)

    } catch (err: any) {
      setError(err.message || 'Une erreur est survenue')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AppLayout>
      <div className="p-4 md:p-8">
        <div className="max-w-4xl mx-auto">

          {/* Page Header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Nouvelle Recherche</h1>
              <p className="text-gray-500">
                Trouvez les meilleures opportunites sur LinkedIn, Indeed, Glassdoor et WTTJ
              </p>
            </div>
          </div>

          {/* Segmented Control - Main tabs */}
          <div className="flex bg-gray-100 rounded-xl p-1 mb-6">
            <button
              type="button"
              onClick={() => setActiveTab('standard')}
              className={`flex-1 py-3 px-4 rounded-lg text-sm font-semibold transition-all duration-300 ${
                activeTab === 'standard'
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Recherche standard
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('linkedin')}
              className={`flex-1 py-3 px-4 rounded-lg text-sm font-semibold transition-all duration-300 flex items-center justify-center gap-2 ${
                activeTab === 'linkedin'
                  ? 'bg-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
              style={activeTab === 'linkedin' ? { color: '#0A66C2' } : {}}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
              </svg>
              Recherche LinkedIn
            </button>
          </div>

          {/* Card unique avec accent top border */}
          <div className={`bg-white/80 backdrop-blur-xl rounded-2xl p-4 md:p-8 shadow-xl border border-white/50 border-t-4 ${activeTab === 'standard' ? 'border-t-indigo-500' : 'border-t-[#0A66C2]'}`}>

            {/* ==================== FORMULAIRE STANDARD ==================== */}
            {activeTab === 'standard' && (
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

                {/* Profil du candidat : CV ou LinkedIn */}
                <div className="p-5 bg-gradient-to-br from-gray-50 to-gray-100/50 rounded-xl border border-gray-200/50">
                <div className="flex items-center gap-2 mb-4">
                  <h3 className="font-semibold text-base text-gray-900">Profil du candidat</h3>
                  <span className="text-xs text-gray-400">- optionnel</span>
                </div>

                {/* Tabs CV / LinkedIn */}
                <div className="flex bg-gray-100 rounded-xl p-1 mb-4">
                  <button
                    type="button"
                    onClick={() => setInputMode('cv')}
                    className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all duration-200 ${
                      inputMode === 'cv'
                        ? 'bg-white text-indigo-600 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    📄 Upload CV
                  </button>
                  <button
                    type="button"
                    onClick={() => setInputMode('linkedin')}
                    className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-2 ${
                      inputMode === 'linkedin'
                        ? 'bg-white shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                    style={inputMode === 'linkedin' ? { color: '#0A66C2' } : {}}
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                    </svg>
                    URL LinkedIn
                  </button>
                </div>

                {/* CV Upload Mode */}
                {inputMode === 'cv' && (
                  <>
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
                  </>
                )}

                {/* LinkedIn URL Mode */}
                {inputMode === 'linkedin' && (
                  <div>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg className="w-5 h-5 text-gray-400" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                        </svg>
                      </div>
                      <Input
                        value={linkedinUrl}
                        onChange={(e) => setLinkedinUrl(e.target.value)}
                        placeholder="https://linkedin.com/in/jean-dupont"
                        className="pl-10"
                      />
                    </div>
                    <p className="text-xs text-muted mt-2">
                      Collez l'URL du profil LinkedIn du candidat. PushProfile extraira automatiquement les compétences, expériences et critères de recherche.
                    </p>
                    {linkedinUrl && !isValidLinkedInUrl(linkedinUrl) && (
                      <p className="text-xs text-red-500 mt-1">
                        ⚠️ Format invalide. Ex: https://linkedin.com/in/jean-dupont
                      </p>
                    )}
                    {linkedinUrl && isValidLinkedInUrl(linkedinUrl) && (
                      <p className="text-xs text-green-600 mt-1">
                        ✓ URL valide
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Critères de recherche */}
              <div className="p-5 bg-gradient-to-br from-gray-50 to-gray-100/50 rounded-xl border border-gray-200/50 space-y-4">
                <h3 className="font-semibold text-base text-gray-900">Criteres de recherche (optionnel)</h3>

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
              <div className="flex items-center space-x-3 p-4 bg-gradient-to-br from-gray-50 to-gray-100/50 rounded-xl border border-gray-200/50">
                <input
                  type="checkbox"
                  id="excludeAgencies"
                  checked={excludeAgencies}
                  onChange={(e) => setExcludeAgencies(e.target.checked)}
                  className="w-5 h-5 text-indigo-600 rounded-lg focus:ring-2 focus:ring-indigo-500 border-gray-300"
                />
                <label htmlFor="excludeAgencies" className="text-sm">
                  <span className="font-medium text-gray-900">Exclure les cabinets de recrutement</span>
                  <span className="text-gray-400 block text-xs mt-1">
                    (Michael Page, Robert Half, Hays, etc.)
                  </span>
                </label>
              </div>

              {/* Récurrence */}
              <div className="p-5 bg-gradient-to-br from-indigo-50/50 to-purple-50/50 rounded-xl border border-indigo-200/50">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-base text-gray-900">Recherche recurrente</h3>
                    <p className="text-sm text-gray-500">Relancer automatiquement cette recherche</p>
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

              {/* Boutons submit OU Barre de progression */}
              {!loading ? (
                <div className="flex flex-col sm:flex-row gap-4 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.push('/searches')}
                    disabled={extracting}
                    className="h-12 rounded-xl border-gray-200 hover:bg-gray-50"
                  >
                    Annuler
                  </Button>
                  <Button
                    type="submit"
                    disabled={extracting}
                    className="flex-1 h-12 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-lg shadow-indigo-500/30 transition-all duration-300"
                  >
                    Lancer l'analyse
                  </Button>
                </div>
              ) : (
                <div className="pt-4 space-y-4">
                  {/* Progress bar qui remplace le bouton */}
                  <div className="relative h-14 rounded-xl bg-gradient-to-r from-indigo-100 to-purple-100 overflow-hidden shadow-inner">
                    <div
                      className="absolute inset-y-0 left-0 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-xl transition-all duration-1000 ease-out"
                      style={{
                        width: `${Math.min(((loadingMessageIndex + 1) / currentLoadingMessages.length) * 100, 85)}%`
                      }}
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="flex items-center gap-3">
                        <div className="text-2xl animate-bounce">
                          {currentLoadingMessages[loadingMessageIndex]?.icon || "⏳"}
                        </div>
                        <span className="font-semibold text-white drop-shadow-md">
                          {currentLoadingMessages[loadingMessageIndex]?.text || "Chargement..."}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Etapes en dessous */}
                  <div className="flex justify-center gap-2">
                    {currentLoadingMessages.map((_, index) => (
                      <div
                        key={index}
                        className={`w-2.5 h-2.5 rounded-full transition-all duration-500 ${
                          index <= loadingMessageIndex
                            ? 'bg-gradient-to-r from-indigo-500 to-purple-500 scale-125 shadow-lg shadow-indigo-500/50'
                            : 'bg-gray-200'
                        }`}
                      />
                    ))}
                  </div>

                  <p className="text-center text-sm text-gray-500">
                    Un instant, on trouve les meilleures offres pour vous...
                  </p>
                </div>
              )}
              </form>
            )}

            {/* ==================== FORMULAIRE LINKEDIN POSTS ==================== */}
            {activeTab === 'linkedin' && (
              <form onSubmit={handleLinkedInPostsSubmit} className="space-y-6">

                {/* Nom de la recherche */}
                <div>
                  <Label htmlFor="linkedinSearchName" className="text-lg font-semibold">
                    Nom de la recherche <span className="text-accent">*</span>
                  </Label>
                  <Input
                    id="linkedinSearchName"
                    value={linkedinSearchName}
                    onChange={(e) => setLinkedinSearchName(e.target.value)}
                    placeholder="Ex: Recherche Product Manager Paris"
                    className="mt-2"
                    required
                  />
                </div>

                {/* Mots-clés */}
                <div>
                  <Label htmlFor="linkedinKeywords" className="text-lg font-semibold">
                    Mots-clés <span className="text-accent">*</span>
                  </Label>
                  <Input
                    id="linkedinKeywords"
                    value={linkedinKeywords}
                    onChange={(e) => setLinkedinKeywords(e.target.value)}
                    placeholder="Ex: Product Manager, Chef de projet digital, PM..."
                    className="mt-2"
                    required
                  />
                  <p className="text-xs text-muted mt-1">
                    Entrez les termes qui correspondent au poste recherché
                  </p>
                </div>

                {/* Localisation */}
                <div>
                  <Label htmlFor="linkedinLocation">Localisation</Label>
                  <Input
                    id="linkedinLocation"
                    value={linkedinLocation}
                    onChange={(e) => setLinkedinLocation(e.target.value)}
                    placeholder="Ex: Paris, Lyon, Remote..."
                    className="mt-1"
                  />
                </div>

                {/* Type de contrat */}
                <div>
                  <Label>Type de contrat</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {['CDI', 'CDD', 'Freelance', 'Stage'].map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => {
                          setLinkedinContractTypes(prev =>
                            prev.includes(type)
                              ? prev.filter(t => t !== type)
                              : [...prev, type]
                          )
                        }}
                        className={`px-3 py-1.5 text-sm rounded-lg border-2 font-medium transition-all ${
                          linkedinContractTypes.includes(type)
                            ? 'border-[#0A66C2] bg-blue-50 text-[#0A66C2]'
                            : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Publié il y a */}
                <div>
                  <Label>Publié il y a</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {[
                      { value: '24h', label: '24 heures' },
                      { value: 'week', label: '7 jours' },
                      { value: 'month', label: '30 jours' },
                      { value: 'any', label: 'Toutes' },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setLinkedinPostedWithin(opt.value)}
                        className={`px-3 py-1.5 text-sm rounded-lg border-2 font-medium transition-all ${
                          linkedinPostedWithin === opt.value
                            ? 'border-[#0A66C2] bg-blue-50 text-[#0A66C2]'
                            : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Exclure cabinets */}
                <div className="flex items-center space-x-3 p-4 bg-gradient-to-br from-blue-50/50 to-blue-100/30 rounded-xl border border-blue-200/50">
                  <input
                    type="checkbox"
                    id="linkedinExcludeAgencies"
                    checked={linkedinExcludeAgencies}
                    onChange={(e) => setLinkedinExcludeAgencies(e.target.checked)}
                    className="w-5 h-5 rounded-lg focus:ring-2 focus:ring-blue-500 border-gray-300"
                    style={{ accentColor: '#0A66C2' }}
                  />
                  <label htmlFor="linkedinExcludeAgencies" className="text-sm">
                    <span className="font-medium text-gray-900">Exclure les cabinets de recrutement</span>
                    <span className="text-gray-400 block text-xs mt-1">
                      (Michael Page, Robert Half, Hays, etc.)
                    </span>
                  </label>
                </div>

                {/* Messages d'erreur */}
                {error && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-600">{error}</p>
                  </div>
                )}

                {/* Boutons submit OU Barre de progression */}
                {!loading ? (
                  <div className="flex flex-col sm:flex-row gap-4 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => router.push('/searches')}
                      className="h-12 rounded-xl border-gray-200 hover:bg-gray-50"
                    >
                      Annuler
                    </Button>
                    <Button
                      type="submit"
                      className="flex-1 h-12 rounded-xl text-white shadow-lg shadow-blue-500/30 transition-all duration-300 hover:opacity-90"
                      style={{ backgroundColor: '#0A66C2' }}
                    >
                      Lancer la recherche
                    </Button>
                  </div>
                ) : (
                  <div className="pt-4 space-y-4">
                    {/* Progress bar qui remplace le bouton - style LinkedIn */}
                    <div className="relative h-14 rounded-xl overflow-hidden shadow-inner" style={{ backgroundColor: '#E7F0F9' }}>
                      <div
                        className="absolute inset-y-0 left-0 rounded-xl transition-all duration-1000 ease-out"
                        style={{
                          backgroundColor: '#0A66C2',
                          width: `${Math.min(((loadingMessageIndex + 1) / currentLoadingMessages.length) * 100, 85)}%`
                        }}
                      >
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
                      </div>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="flex items-center gap-3">
                          <div className="text-2xl animate-bounce">
                            {currentLoadingMessages[loadingMessageIndex]?.icon || "⏳"}
                          </div>
                          <span className="font-semibold text-white drop-shadow-md">
                            {currentLoadingMessages[loadingMessageIndex]?.text || "Chargement..."}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Etapes en dessous */}
                    <div className="flex justify-center gap-2">
                      {currentLoadingMessages.map((_, index) => (
                        <div
                          key={index}
                          className={`w-2.5 h-2.5 rounded-full transition-all duration-500 ${
                            index <= loadingMessageIndex
                              ? 'scale-125 shadow-lg'
                              : 'bg-gray-200'
                          }`}
                          style={index <= loadingMessageIndex ? { backgroundColor: '#0A66C2', boxShadow: '0 4px 6px -1px rgba(10, 102, 194, 0.5)' } : {}}
                        />
                      ))}
                    </div>

                    <p className="text-center text-sm text-gray-500">
                      Un instant, on recherche sur LinkedIn...
                    </p>
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
