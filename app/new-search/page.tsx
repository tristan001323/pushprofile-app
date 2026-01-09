'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card } from '@/components/ui/card'

export default function NewSearchPage() {
  const router = useRouter()
  
  // États du formulaire
  const [searchTitle, setSearchTitle] = useState('')
  const [excludeAgencies, setExcludeAgencies] = useState(true)
  const [searchMode, setSearchMode] = useState<'cv' | 'standard' | 'both'>('cv')
  
  // Champs Standard (optionnels)
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
  
  // États UI
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Extraction texte PDF
  const extractPdfText = async (file: File): Promise<string> => {
    const pdfjsLib = await import('pdfjs-dist')

    // Configuration du worker (pdfjs-dist v5.x utilise .mjs)
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`
    
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

    // Au moins un champ doit être rempli
    if (!cvText && !jobTitle && !location && !brief) {
      setError('Remplissez au moins un champ (CV ou critères de recherche)')
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
      const response = await fetch(process.env.NEXT_PUBLIC_N8N_WEBHOOK_URL!, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: searchTitle,
          search_type: searchMode,
          exclude_agencies: excludeAgencies,
          
          // Champs Standard (optionnels)
          job_title: jobTitle || null,
          location: location || null,
          contract_types: contractTypes.length > 0 ? contractTypes : null,
          remote_options: remoteOptions.length > 0 ? remoteOptions : null,
          seniority: seniority || null,
          brief: brief || null,
          
          // CV
          cv_text: cvText || null,
          
          user_id: 'anonymous', // Temporaire, sera remplacé par auth
          filename: uploadedFile?.name || 'pasted_cv.txt',
        }),
      })

      if (!response.ok) {
        throw new Error('Erreur lors de l\'analyse')
      }

      const data = await response.json()
      
      // Redirection vers les résultats
      router.push(`/searches/${data.search_id}`)
      
    } catch (err: any) {
      setError(err.message || 'Une erreur est survenue')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto">
        <Card className="p-8">
          <h1 className="text-3xl font-bold text-text mb-2">Nouvelle Recherche</h1>
          <p className="text-muted mb-8">
            Trouvez les meilleures opportunités pour votre profil ou vos critères
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* TITRE DE LA RECHERCHE (OBLIGATOIRE) */}
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

            {/* TOGGLE EXCLURE CABINETS */}
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

            <div className="border-t pt-6" />

            {/* MODE DE RECHERCHE */}
            <div>
              <Label className="text-lg font-semibold mb-3 block">Mode de recherche</Label>
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant={searchMode === 'cv' ? 'default' : 'outline'}
                  onClick={() => setSearchMode('cv')}
                >
                  Recherche par CV
                </Button>
                <Button
                  type="button"
                  variant={searchMode === 'standard' ? 'default' : 'outline'}
                  onClick={() => setSearchMode('standard')}
                >
                  Recherche Standard
                </Button>
                <Button
                  type="button"
                  variant={searchMode === 'both' ? 'default' : 'outline'}
                  onClick={() => setSearchMode('both')}
                >
                  Les deux
                </Button>
              </div>
            </div>

            {/* SECTION STANDARD (si mode standard ou both) */}
            {(searchMode === 'standard' || searchMode === 'both') && (
              <div className="space-y-4 p-6 bg-secondary rounded-lg">
                <h3 className="font-semibold text-lg">Critères de recherche (optionnel)</h3>
                
                <div className="grid grid-cols-2 gap-4">
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

                  <div>
                    <Label>Type de contrat</Label>
                    <div className="flex gap-2 mt-1">
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
                          className={`px-3 py-1 text-sm rounded ${
                            contractTypes.includes(type)
                              ? 'bg-accent text-white'
                              : 'bg-gray-200'
                          }`}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <Label>Remote</Label>
                  <div className="flex gap-2 mt-1">
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
                        className={`px-3 py-1 text-sm rounded ${
                          remoteOptions.includes(option)
                            ? 'bg-accent text-white'
                            : 'bg-gray-200'
                        }`}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>

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
            )}

            {/* SECTION CV (si mode cv ou both) */}
            {(searchMode === 'cv' || searchMode === 'both') && (
              <div className="space-y-4 p-6 bg-secondary rounded-lg">
                <h3 className="font-semibold text-lg">CV (optionnel)</h3>
                <p className="text-sm text-muted">
                  Uploadez un fichier ou collez le texte de votre CV
                </p>

                {/* Upload fichier */}
                <div>
                  <Label htmlFor="fileUpload" className="cursor-pointer">
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-accent transition-colors">
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

                {/* OU séparateur */}
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-300"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-secondary text-muted">OU</span>
                  </div>
                </div>

                {/* Textarea fallback */}
                <div>
                  <Label htmlFor="cvText">Collez votre CV ici</Label>
                  <Textarea
                    id="cvText"
                    value={cvText}
                    onChange={(e) => setCvText(e.target.value)}
                    placeholder="Nom Prénom&#10;Titre du poste&#10;&#10;Expérience professionnelle...&#10;&#10;Compétences..."
                    rows={12}
                    className="mt-2 font-mono text-sm"
                  />
                </div>
              </div>
            )}

            {/* Messages d'erreur */}
            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600">❌ {error}</p>
              </div>
            )}

            {/* Bouton submit */}
            <div className="flex gap-4 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push('/searches')}
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
          </form>
        </Card>
      </div>
    </div>
  )
}
