/**
 * Convert LinkedIn Profile to CV Data format
 *
 * This allows LinkedIn profiles to use the same pipeline as uploaded CVs.
 * The output matches the ParsedCV interface used in analyze-cv/route.ts
 */

import { LinkedInProfileOutput } from './apify'

export interface ParsedCV {
  target_roles: string[]
  skills: string[]
  experience_years: number
  location: string
  seniority: string
  education: string
  languages: string[]
}

export interface LinkedInCvData extends ParsedCV {
  // Extra LinkedIn-specific fields
  name: string
  linkedin_url: string
  profile_picture: string | null
  headline: string
  current_company: string | null
}

/**
 * Calculate years of experience from the oldest work experience
 */
function calculateExperienceYears(experiences: LinkedInProfileOutput['experience']): number {
  if (!experiences || experiences.length === 0) return 0

  // Find the earliest start date
  let earliestYear: number | null = null

  for (const exp of experiences) {
    if (exp.startDate?.year) {
      if (earliestYear === null || exp.startDate.year < earliestYear) {
        earliestYear = exp.startDate.year
      }
    }
  }

  if (!earliestYear) return 0

  const currentYear = new Date().getFullYear()
  return Math.max(0, currentYear - earliestYear)
}

/**
 * Determine seniority level from years of experience
 */
function determineSeniority(years: number): string {
  if (years <= 2) return 'Junior'
  if (years <= 5) return 'Confirmé'
  if (years <= 10) return 'Senior'
  return 'Expert'
}

/**
 * Extract target roles from headline and recent experiences
 */
function extractTargetRoles(profile: LinkedInProfileOutput): string[] {
  const roles = new Set<string>()

  // 1. Extract from headline (e.g., "Senior React Developer at Doctolib")
  if (profile.headline) {
    // Remove "at Company" or "chez Company" suffixes
    const title = profile.headline
      .split(' at ')[0]
      .split(' chez ')[0]
      .split(' | ')[0]
      .split(' - ')[0]
      .trim()

    if (title && title.length > 2) {
      roles.add(title)
    }
  }

  // 2. Extract from current position
  if (profile.currentPosition?.[0]?.companyName && profile.experience?.[0]?.position) {
    roles.add(profile.experience[0].position.split(' | ')[0].trim())
  }

  // 3. Extract from recent experiences (last 3)
  if (profile.experience) {
    for (const exp of profile.experience.slice(0, 3)) {
      if (exp.position) {
        // Clean up position title (remove company-specific suffixes)
        const cleanTitle = exp.position
          .split(' | ')[0]
          .split(' - ')[0]
          .trim()

        if (cleanTitle && cleanTitle.length > 2) {
          roles.add(cleanTitle)
        }
      }
    }
  }

  return Array.from(roles).slice(0, 5) // Max 5 roles
}

/**
 * Extract skills from profile
 */
function extractSkills(profile: LinkedInProfileOutput): string[] {
  const skills = new Set<string>()

  // 1. From skills section
  if (profile.skills) {
    for (const skill of profile.skills.slice(0, 30)) {
      if (skill.name) {
        skills.add(skill.name)
      }
    }
  }

  // 2. From topSkills string (e.g., "React • TypeScript • Node.js")
  if (profile.topSkills) {
    const topSkillsList = profile.topSkills.split(/[•,|]/).map(s => s.trim()).filter(Boolean)
    for (const skill of topSkillsList) {
      skills.add(skill)
    }
  }

  // 3. From experience skills
  if (profile.experience) {
    for (const exp of profile.experience.slice(0, 3)) {
      if (exp.skills) {
        for (const skill of exp.skills.slice(0, 10)) {
          skills.add(skill)
        }
      }
    }
  }

  return Array.from(skills)
}

/**
 * Extract location from profile
 */
function extractLocation(profile: LinkedInProfileOutput): string {
  if (profile.location?.parsed?.city) {
    return profile.location.parsed.city
  }
  if (profile.location?.linkedinText) {
    // Extract city from "Paris, Île-de-France, France"
    const parts = profile.location.linkedinText.split(',')
    return parts[0]?.trim() || 'France'
  }
  return 'France'
}

/**
 * Extract highest education
 */
function extractEducation(profile: LinkedInProfileOutput): string {
  if (!profile.education || profile.education.length === 0) {
    return ''
  }

  // Get the most recent or most prestigious education
  const edu = profile.education[0]
  const parts = []

  if (edu.degree) parts.push(edu.degree)
  if (edu.fieldOfStudy) parts.push(edu.fieldOfStudy)
  if (edu.schoolName) parts.push(`(${edu.schoolName})`)

  return parts.join(' ') || edu.schoolName || ''
}

/**
 * Extract languages from profile
 */
function extractLanguages(profile: LinkedInProfileOutput): string[] {
  if (!profile.languages || profile.languages.length === 0) {
    return ['Français'] // Default
  }

  return profile.languages.map(l => l.name).filter(Boolean)
}

/**
 * Convert LinkedIn Profile to ParsedCV format
 * This is the main function used by the API route
 */
export function linkedInProfileToCvData(profile: LinkedInProfileOutput): LinkedInCvData {
  const experienceYears = calculateExperienceYears(profile.experience)

  // Get current company
  const currentCompany = profile.currentPosition?.[0]?.companyName
    || profile.experience?.find(e => !e.endDate || e.endDate.text === 'Present')?.companyName
    || null

  return {
    // Standard ParsedCV fields (same as Claude CV parsing output)
    target_roles: extractTargetRoles(profile),
    skills: extractSkills(profile),
    experience_years: experienceYears,
    location: extractLocation(profile),
    seniority: determineSeniority(experienceYears),
    education: extractEducation(profile),
    languages: extractLanguages(profile),

    // LinkedIn-specific extras
    name: `${profile.firstName} ${profile.lastName}`.trim(),
    linkedin_url: profile.linkedinUrl,
    profile_picture: profile.photo || null,
    headline: profile.headline || '',
    current_company: currentCompany,
  }
}
