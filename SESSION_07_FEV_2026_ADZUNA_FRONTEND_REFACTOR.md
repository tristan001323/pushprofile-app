# 🔄 SESSION 7 FÉVRIER 2026 — OPTIMISATION ADZUNA + REFONTE FRONTEND VIGNETTES

**Date** : 7 février 2026  
**Contexte** : Adzuna est DÉJÀ intégré et fonctionnel. LinkedIn Jobs, Glassdoor et WTTJ ont été SUPPRIMÉS (temps de chargement trop long). Ce document décrit les optimisations à appliquer sur l'existant + la refonte complète du frontend.

---

## ⚠️ ÉTAT ACTUEL DU CODE — NE PAS CASSER

### Sources actives (3) :
1. **Adzuna** — API REST gratuite, DÉJÀ intégrée (source principale, volume)
2. **Indeed** — Apify actor `TrtlecxAsNRbKl1na`, DÉJÀ intégré
3. **ATS Direct** — Apify actor jobo.world `NDli5o5pYKW1atJAY` (à intégrer ou déjà intégré)

### Sources SUPPRIMÉES (ne pas les remettre) :
- ~~LinkedIn Jobs~~ (Apify actor `RIGGeqD6RqKmlVoQU`) — SUPPRIMÉ
- ~~Glassdoor~~ — SUPPRIMÉ
- ~~WTTJ~~ — SUPPRIMÉ

### Ce qui fonctionne et NE DOIT PAS être modifié :
- API `/api/analyze-cv` : parsing CV + recherche multi-sources + scoring
- API `/api/search-linkedin-posts` : recherche posts LinkedIn (BETA)
- Scoring : prefiltre JS + TOP scoring Claude Sonnet
- Auth Supabase + signup onboarding
- Tables Supabase : `searches`, `matches`, `user_profiles`, `waitlist`
- LinkedIn Posts feature complète

---

## 1. OPTIMISATION ADZUNA — MASQUER LA SOURCE

### 1.1 Problème actuel
Dans le champ `source` de la table `matches`, les jobs Adzuna sont stockés comme `'adzuna'`. Ce nom apparaît dans l'UI (filtres, badges source). Adzuna est une marque inconnue des recruteurs français → ça fait cheap.

### 1.2 Ce qu'il faut changer

**A) Mapper la source vers la plateforme d'ORIGINE**

Adzuna agrège 50+ jobboards. Chaque job a une `redirect_url` qui pointe vers `adzuna.fr/land/ad/...` puis redirige vers le site original. On peut parfois déduire la source d'origine depuis cette URL ou d'autres champs.

```typescript
// Dans le normalizer Adzuna existant, REMPLACER source: 'adzuna' par :

function detectOriginalSource(redirectUrl: string): string {
  const url = (redirectUrl || '').toLowerCase();
  
  if (url.includes('pole-emploi') || url.includes('francetravail')) return 'France Travail';
  if (url.includes('apec.fr')) return 'Apec';
  if (url.includes('cadremploi')) return 'Cadremploi';
  if (url.includes('monster')) return 'Monster';
  if (url.includes('meteojob')) return 'Meteojob';
  if (url.includes('regionsjob')) return 'RegionsJob';
  if (url.includes('hellowork')) return 'HelloWork';
  if (url.includes('indeed')) return 'Indeed';
  if (url.includes('linkedin')) return 'LinkedIn';
  if (url.includes('welcometothejungle') || url.includes('wttj')) return 'Welcome to the Jungle';
  if (url.includes('talent.com')) return 'Talent.com';
  if (url.includes('jobijoba')) return 'Jobijoba';
  
  return 'Offre directe'; // Fallback neutre — JAMAIS "Adzuna"
}
```

**ATTENTION** : la `redirect_url` d'Adzuna ne contient pas TOUJOURS la source d'origine dans l'URL elle-même (souvent c'est juste `adzuna.fr/land/ad/XXXX`). Si le mapping échoue, utiliser `'Offre directe'` comme fallback. Ne JAMAIS retomber sur `'Adzuna'`.

**B) Champ `source` dans la table `matches`**

Actuellement : `source = 'adzuna'`  
Nouveau : `source = 'France Travail' | 'Apec' | 'Cadremploi' | ... | 'Offre directe'`

Ajouter un champ interne (non affiché) pour tracker la provenance réelle :
```
source_engine = 'adzuna' | 'indeed' | 'ats_direct'  // Usage interne/analytics uniquement
```

**C) Filtres dans `/searches/[id]`**

Actuellement il y a des filtres par source : "LinkedIn, Adzuna, Indeed, LinkedIn Post".  
→ Remplacer par des filtres dynamiques basés sur les sources réelles trouvées dans les résultats.  
→ Ne JAMAIS afficher "Adzuna" comme option de filtre.

### 1.3 Proxy de redirection — Masquer les URLs Adzuna

**Problème** : Quand le client clique "Voir l'offre", le lien Adzuna (`adzuna.fr/land/ad/...`) apparaît dans la barre du navigateur avant la redirection vers le site final.

**Solution** : Créer une API route proxy.

**Créer `/app/api/redirect/[jobId]/route.ts` :**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server'; // ou le client Supabase existant

export async function GET(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  const { jobId } = params;
  
  // Récupérer l'URL du job depuis Supabase
  const supabase = createClient();
  const { data: match } = await supabase
    .from('matches')
    .select('job_url')
    .eq('id', jobId)
    .single();
  
  if (!match?.job_url) {
    return NextResponse.redirect('/searches');
  }
  
  // Redirect 302 vers l'URL stockée
  return NextResponse.redirect(match.job_url, 302);
}
```

**Dans le frontend** : remplacer TOUS les liens directs vers `job_url` par `/api/redirect/{match.id}`.

Le client voit : `pushprofile.io → page du job`. L'URL Adzuna est invisible.

---

## 2. COMPLIANCE ADZUNA — BADGE OBLIGATOIRE (mais discret)

### Obligation (Terms of Service Adzuna)
Chaque offre provenant d'Adzuna doit porter le label **"Jobs by Adzuna"** (minimum 116×23px) avec lien vers `https://www.adzuna.fr`.

### Implémentation
- Badge **UNIQUEMENT** sur les jobs dont `source_engine === 'adzuna'`
- Position : **bas de la vignette**, aligné à droite
- Style : **text-[10px] text-gray-300** — quasi invisible
- Le mot "Jobs" est un lien vers `https://www.adzuna.fr`
- "Adzuna" affiché avec le logo officiel (récupérable sur http://www.adzuna.co.uk/press.html) ou en texte simple
- Taille : exactement 116×23px (minimum requis, pas plus)

### Pourquoi c'est pas grave
- Les clients ESN ne connaissent PAS Adzuna → le mot ne trigger rien de négatif
- Le badge est noyé dans le design des vignettes
- PushProfile est un micro-utilisateur API → risque de contrôle quasi nul
- Mais le badge protège l'accès API en cas de vérification

---

## 3. REFONTE FRONTEND — VIGNETTES (CARDS) REMPLACENT LE LISTING

### 3.1 Changement principal

**AVANT** : Page `/searches/[id]` affiche les matches en **liste verticale** (style tableau)  
**APRÈS** : Affichage en **grille de vignettes (cards)** responsive, avec branding PushProfile dominant

### 3.2 Structure d'une vignette (card dans la grille)

La vignette est un **résumé compact**. Le clic sur la vignette ouvre le popup détaillé (voir 3.8).

```
┌──────────────────────────────────────┐
│  PP    [92% ⭐]                      │
│                                       │
│  Senior React Developer               │
│  @ Doctolib                           │
│                                       │
│  📍 Paris        💼 CDI               │
│  💰 65-75K       🕐 Il y a 2j        │
│                                       │
│  React · TypeScript · Node.js · AWS   │
│                                       │
│  💡 "Stack parfaitement aligné..."    │
│                                       │
│                          via Indeed   │  ← très petit, text-xs text-gray-400
│                   Jobs by Adzuna      │  ← 116×23px, gris clair, SI source_engine=adzuna
└──────────────────────────────────────┘
```

**Pas de boutons d'action sur la vignette.** Le clic sur la card entière ouvre le popup.
Cursor: pointer sur toute la card + léger hover effect (shadow ou scale).

### 3.3 Hiérarchie visuelle — CE QUI DOMINE

Par ordre d'importance visuelle :

1. **Badge/logo PP (PushProfile)** — haut gauche de CHAQUE vignette, toujours visible. Le client doit associer les offres à PushProfile, pas aux sources.
2. **Score IA** (si Pro/Business) — haut droite, gros et coloré par palier
3. **Titre du poste + Entreprise** — texte principal, bien lisible
4. **Infos clés** (lieu, salaire, contrat, date) — avec icônes
5. **Tags compétences** — si disponibles dans la description
6. **Justification IA** (si Pro/Business) — texte tronqué

**CE QUI DOIT ÊTRE DISCRET :**

7. **Source** — juste le nom en très petit texte : "via Indeed" / "via France Travail" / "via Apec". Format : `text-xs text-gray-400`. PAS de logo, PAS d'icône. Juste le texte minuscule.
8. **Badge Adzuna** — "Jobs by Adzuna" 116×23px gris très clair, uniquement si source_engine=adzuna

### 3.8 POPUP DÉTAIL — Remplace le panel latéral (sidebar)

**⚠️ SUPPRESSION : Le panel latéral glissant à droite (sidebar) qui existait avant est SUPPRIMÉ.**

Quand le client clique sur une vignette, un **modal/popup centré** s'ouvre par-dessus la grille avec un backdrop sombre. La grille reste visible mais floue/assombrie en arrière-plan.

**Comportement :**
- Clic sur une vignette → popup s'ouvre (animation fade-in + scale)
- Clic sur le backdrop OU bouton ✕ → popup se ferme
- Touche Escape → popup se ferme
- Scroll interne dans le popup si le contenu dépasse
- La grille en fond reste en place (pas de navigation, pas de changement de page)

**Taille du popup :**
```
Desktop  : max-w-3xl (768px), max-h-[85vh], centré verticalement/horizontalement
Tablet   : max-w-2xl, même logique
Mobile   : plein écran (w-full h-full) ou bottom sheet
```

**Structure du popup :**

```
┌─────────────────────────────────────────────────────┐
│                                              [✕]    │  ← Bouton fermer
│                                                      │
│  PP    92% ⭐ Excellent match                        │  ← Badge PP + Score coloré
│                                                      │
│  ═══════════════════════════════════════════════      │
│                                                      │
│  Senior React Developer                              │  ← Titre gros
│  @ Doctolib                                          │  ← Entreprise
│                                                      │
│  📍 Paris  💼 CDI  💰 65-75K  🕐 Publié il y a 2j  │  ← Infos clés en ligne
│                                                      │
│  ─────────────────────────────────────────────       │
│                                                      │
│  💡 ANALYSE DE CORRESPONDANCE                        │  ← TOUJOURS VISIBLE, taille normale
│  "Stack parfaitement aligné avec le profil du        │
│  candidat. Expérience React/TypeScript de 5 ans      │
│  correspond à la séniorité demandée. Culture         │
│  startup compatible. Points forts : maîtrise         │
│  complète du stack, localisation idéale."            │
│                                                      │
│  ─────────────────────────────────────────────       │
│                                                      │
│  🛠️ COMPÉTENCES DEMANDÉES                           │
│  React · TypeScript · Node.js · AWS · GraphQL        │
│                                                      │
│  ─────────────────────────────────────────────       │
│                                                      │
│  📋 Voir la fiche de poste complète         [▼]     │  ← TOGGLE REPLIÉ PAR DÉFAUT
│  ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┐   │
│  │ (Quand ouvert, en TEXT-SM / TEXT-GRAY-600 :) │   │  ← Texte PLUS PETIT que le reste
│  │                                               │   │
│  │ Nous recherchons un développeur Senior React  │   │
│  │ pour rejoindre notre équipe produit. Vous     │   │
│  │ travaillerez sur notre plateforme utilisée    │   │
│  │ par plus de 80 millions de patients en        │   │
│  │ Europe. Responsabilités : développement de    │   │
│  │ nouvelles features, code reviews, mentorat    │   │
│  │ junior devs, participation aux choix tech...  │   │
│  │                                               │   │
│  │ (description complète, scrollable si longue)  │   │
│  │                                               │   │
│  │         [🔗 Voir l'offre sur le site]         │   │  ← Bouton discret EN BAS de la description
│  └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┘   │
│                                                      │
│  ─────────────────────────────────────────────       │
│                                                      │
│  👥 CONTACTS                                         │  ← Section contacts (Pro/Business)
│  [🔍 Rechercher les contacts de Doctolib]            │  ← Bouton enrichissement
│                                                      │
│  (Si contacts déjà enrichis, les afficher ici :)     │
│  • Jean Dupont — CTO — jean@doctolib.fr — LinkedIn  │
│  • Marie Martin — RH — marie@doctolib.fr            │
│                                                      │
│  ─────────────────────────────────────────────       │
│                                                      │
│  📌 STATUT                                           │  ← Gestion statut
│  [Nouveau ▾]  → À contacter / RDV pris / Refusé     │  ← Dropdown
│  [⭐ Favori]                                         │
│                                                      │
│                                   via Indeed         │  ← Source micro-texte
│                            Jobs by Adzuna            │  ← Badge compliance si applicable
└─────────────────────────────────────────────────────┘
```

**Principe clé : garder le client sur PushProfile le plus longtemps possible.**

La fiche de poste est lisible directement dans le popup → le client n'a PAS BESOIN d'aller sur le site externe. Le bouton "Voir l'offre sur le site" existe mais est :
- Placé **tout en bas** de la description dépliée (pas en haut)
- Style **discret** : `text-sm text-gray-500 underline` ou bouton `variant="ghost"` / `variant="outline"` — pas un gros CTA coloré
- Le client doit scroller la description entière avant de le voir

**Sections du popup — ordre et comportement :**

1. **Header** : Badge PP + Score IA + Bouton fermer ✕
2. **Titre + Entreprise** : gros, bien lisible
3. **Infos clés** : lieu, contrat, salaire, date — en ligne horizontale
4. **Analyse de correspondance** (Pro/Business) : TOUJOURS VISIBLE, jamais repliée. Taille de texte normale (text-base). C'est LA valeur ajoutée de PushProfile — le client doit la voir en premier.
5. **Compétences** : tags extraits
6. **Fiche de poste** : REPLIÉE PAR DÉFAUT. Toggle "Voir la fiche de poste complète [▼]". Quand ouverte :
   - Texte en **text-sm text-gray-600** (plus petit que le reste du popup)
   - Scrollable si très longue (max-h-[400px] overflow-y-auto)
   - Bouton "Voir l'offre sur le site" tout en bas, style discret
   - Via proxy `/api/redirect/[jobId]`, ouvre dans un nouvel onglet (`target="_blank"`)
7. **Contacts** (Pro/Business) : bouton enrichissement + affichage contacts
8. **Statut + Favori** : dropdown + toggle
9. **Source** : micro-texte discret en bas

**Pourquoi la fiche de poste est repliée et en petit :**
- L'analyse de correspondance IA est le VRAI contenu de valeur → elle reste visible et en taille normale
- La fiche de poste brute c'est du contenu "commodity" (le client peut la lire ailleurs) → plus petit, replié
- Le client lit l'analyse IA → comprend si le job est pertinent → passe aux contacts
- Il ne déplie la fiche de poste que s'il veut les détails fins → et même là, il la lit DANS le popup
- Le bouton "Voir sur le site" est un plan B, pas le parcours principal

### 3.4 Layout responsive

```
Desktop (>1024px)  : Grille 3 colonnes
Tablet (768-1024px) : Grille 2 colonnes  
Mobile (<768px)    : 1 colonne pleine largeur
```

Gap entre vignettes : `gap-4` ou `gap-6`

### 3.5 Différenciation Starter vs Pro/Business

**Vignette STARTER :**
- ❌ Pas de score IA
- ❌ Pas de justification IA
- ❌ Pas de bouton "Contacts"
- ✅ Badge PP
- ✅ Titre, entreprise, lieu, salaire, contrat, date
- ✅ Bouton "Voir l'offre"
- ✅ Source en micro-texte

→ Le client VOIT les emplacements vides où devrait être le score → frustration naturelle → upgrade

**Vignette PRO / BUSINESS :**
- ✅ Score IA coloré (Top 20 jobs scorés par Claude Sonnet)
- ✅ Justification IA tronquée
- ✅ Bouton "Contacts" pour enrichissement
- ✅ Tout le reste

### 3.6 Couleurs des scores

```
90-100% → bg-emerald-100 text-emerald-700  → "Excellent match"
75-89%  → bg-blue-100 text-blue-700        → "Bon match"
60-74%  → bg-amber-100 text-amber-700      → "Match partiel"
<60%    → bg-gray-100 text-gray-500        → "Faible"
```

### 3.7 Source en micro-texte

Pour la source en bas de vignette, utiliser UNIQUEMENT du texte très petit :

```html
<span className="text-xs text-gray-400">via Indeed</span>
<span className="text-xs text-gray-400">via France Travail</span>
<span className="text-xs text-gray-400">via Apec</span>
```

PAS de logos des plateformes. PAS d'icônes colorées. Juste le nom en gris très clair, très petit.

---

## 4. PRICING MIS À JOUR

### Grille à implémenter (remplace l'ancienne dans CONTEXT_CLAUDE.md)

```
                    STARTER      PRO         BUSINESS
                    €49/mois     €149/mois   €345/mois
───────────────────────────────────────────────────────
Recherches/mois     50           200         500
Sources             3            3           3
Jobs/recherche      50           100         100
Scoring IA          ❌           Top 20      Top 20
Contacts/mois       200          2,000       6,000
Company Intel       ❌           ✅          ✅
Daily Briefing      ❌           ❌          ✅
```

⚠️ Le pricing dans CONTEXT_CLAUDE.md (Gratuit/Starter 10 recherches/Pro 50/Business 200) est OBSOLÈTE.

### Coûts réels par recherche

```
                        STARTER         PRO/BUSINESS
─────────────────────────────────────────────────────
Adzuna (40 jobs)        $0.000          $0.000
Indeed (40 jobs)        $0.040          $0.040
ATS Direct (40 jobs)    $0.004          $0.004
Parsing CV (Haiku)      $0.005          $0.005
Scoring Top 20 (Sonnet) —              $0.072
─────────────────────────────────────────────────────
TOTAL / RECHERCHE       $0.049          $0.121
```

### Marges par forfait

```
                    STARTER      PRO         BUSINESS
Coût total/mois     $2.89        $28.36      $72.80
Marge               €46.11       €120.64     €272.20
Marge %             94%          81%         79%
```

---

## 5. FICHIERS À CRÉER / MODIFIER

### Nouveau fichier :
```
app/api/redirect/[jobId]/route.ts     → Proxy de redirection (masque URLs Adzuna)
components/JobCard.tsx                 → Composant vignette (card) dans la grille
components/JobDetailModal.tsx          → Modal popup détail job (REMPLACE le panel latéral sidebar)
components/JobGrid.tsx                 → Grille responsive de vignettes
```

### Fichiers à modifier :

```
app/api/analyze-cv/route.ts           → Modifier le normalizer Adzuna :
                                         - source = detectOriginalSource(redirect_url) 
                                           au lieu de 'adzuna'
                                         - Ajouter source_engine = 'adzuna' | 'indeed' | 'ats_direct'
                                         
app/searches/[id]/page.tsx            → REFONTE COMPLÈTE :
                                         - Remplacer listing par grille de vignettes (JobGrid + JobCard)
                                         - SUPPRIMER le panel latéral (sidebar) existant
                                         - Clic sur une card → ouvre JobDetailModal (popup centré)
                                         - Badge PP dominant sur chaque card
                                         - Score IA coloré (Pro/Business uniquement)
                                         - Source en text-xs text-gray-400 (texte seulement)
                                         - Badge Adzuna compliance si source_engine=adzuna
                                         - Liens "Voir l'offre" via /api/redirect/[jobId]
                                         - Filtres : remplacer "Adzuna" par sources dynamiques
```

---

## 6. RÈGLES STRICTES

### ❌ NE JAMAIS :
- Afficher "Adzuna" en visible dans l'interface (sauf badge compliance gris clair)
- Utiliser `job_url` directement dans les liens — passer par `/api/redirect/[jobId]`
- Mettre `source: 'adzuna'` dans les données affichées au client
- Afficher des logos de plateformes en gros/visible sur les vignettes
- Garder ou recréer le panel latéral (sidebar) pour le détail des jobs — c'est REMPLACÉ par le popup modal
- Casser le code existant de LinkedIn Posts, du scoring, de l'auth
- Toucher à `/api/search-linkedin-posts`
- Remettre LinkedIn Jobs, Glassdoor ou WTTJ comme sources

### ✅ TOUJOURS :
- Utiliser `detectOriginalSource()` pour mapper Adzuna vers la vraie source
- Afficher le badge PP (PushProfile) en dominant sur CHAQUE vignette
- Afficher la source en `text-xs text-gray-400` (texte seulement, pas de logo)
- Garder le badge "Jobs by Adzuna" pour compliance (discret, gris, 116×23px)
- Utiliser le proxy `/api/redirect/[jobId]` pour tous les liens "Voir l'offre"
- Ouvrir un popup modal centré quand le client clique sur une vignette (pas de sidebar)
- Inclure dans le popup : fiche de poste complète, analyse IA, contacts, gestion statut
- Différencier Starter (sans score) vs Pro/Business (avec score + contacts)
- Exécuter les 3 sources en parallèle avec `Promise.allSettled`

---

## 7. NOTES TECHNIQUES

### Adzuna Free Tier
- ~500 requêtes/mois sur free tier
- Tous les clients partagent un seul compte API
- 10 clients ≈ 200-300 req/mois → OK
- 50+ clients → négocier licence ou passer paid

### Déduplication Adzuna ↔ Indeed
Adzuna agrège Indeed → doublons possibles.
Dédoublonner par : `(titre normalisé + nom entreprise normalisé)`.
Priorité doublon : Indeed direct > Adzuna.

### Cache Adzuna
Cacher résultats 24h en Supabase. Clé : `adzuna:{keywords}:{location}:{hash}`.
Protège le quota free tier.

### Temps de chargement
```
AVANT (5 sources Apify)           : 40-75 secondes ❌
APRÈS (Adzuna API + Indeed + ATS) : 15-35 secondes ✅
```
