/**
 * src/lib/characters.ts
 *
 * Template structuré pour la conception des personnages de Récit.
 * Le systemPrompt reste manuel (champ `systemPrompt` dans CharacterBlueprint).
 * Tous les autres champs utilisés par l'application (trustEvaluation, clues,
 * characterRelations) sont générés automatiquement par buildCharacter().
 */

import { Character } from './types'
import { Clue, CharacterRelation } from './story'

export interface CharacterIdentity {
  name: string
  age: number
  profession: string
  location: string
  era: string
  appearance: string
  speechStyle: string
}

export interface CharacterInner {
  consciousDesire: string
  unconsciousNeed: string
  foundingWound: string
  pride: string
  regret: string
}

export interface CharacterSecret {
  fullTruth: string
  perceivedTruth: string
  silenceReason: string
  breakingPoint: string
}

export interface ResistanceLayers {
  low: string
  medium: string
  high: string
  rare: string
}

export interface InvoluntaryClues {
  avoidedSubject: string
  telltaleReaction: string
  contradiction: string
  betrayingDetail: string
}

export interface CharacterBond {
  characterId: string
  subjectiveView: string
  sharedEvents: string[]
  reactionIfMentioned: string
  ignoredFact?: string
}

export interface CharacterBlueprint {
  id: string
  locationId: string
  identity: CharacterIdentity
  inner: CharacterInner
  secret: CharacterSecret
  resistanceLayers: ResistanceLayers
  involuntaryClues: InvoluntaryClues
  relations: CharacterBond[]
  clues: Array<{
    id: string
    content: string
    trustRequired: number
  }>
  systemPrompt: string
  intro: string
  // Description courte affichée dans la carte personnage (page lieu)
  // Si absent, utilise identity.profession comme fallback
  displayDescription?: string
  // Profil de réception affective — utilisé par Haiku pour évaluer le trust.
  // Décrit comment ce personnage réagit au contact humain brut, indépendamment
  // du contenu narratif. Chaque personnage a des dispositions différentes.
  // Ex : Martine (démence douce, cherche compagnie) vs Carole (méfiante, fermée).
  trustProfile: string
  pronoun: 'elle' | 'il'
  available?: boolean
  unavailableReason?: string
  sessionMessageLimit?: number
  locationContext?: Record<string, string>
  schedule?: {
    openHour: number
    closeHour: number
    closedMessage?: string
  }
}

export function buildCharacter(bp: CharacterBlueprint): {
  character: Character
  clues: Clue[]
  relation: { characterId: string; data: CharacterRelation }
} {
  const pronoun   = bp.pronoun
  const subject   = pronoun === 'elle' ? 'Elle'    : 'Il'
  const object    = pronoun === 'elle' ? 'la'      : 'le'
  const reflexive = pronoun === 'elle' ? 'qu\'elle' : 'qu\'il'

  const trustEvaluation = `${bp.identity.name} est ${bp.identity.profession}.
${bp.identity.speechStyle}

PROFIL AFFECTIF (priorité sur les critères généraux) :
${bp.trustProfile}

${subject} apprécie : ${bp.resistanceLayers.low} (niveau de base), et s'ouvre progressivement avec la confiance.
${subject} se ferme face à : les approches trop directes, la flatterie détectée, la pression.

COUCHES DE RÉSISTANCE :
- Confiance basse (0–30%) : ${bp.resistanceLayers.low}
- Confiance moyenne (30–60%) : ${bp.resistanceLayers.medium}
- Confiance haute (60–80%) : ${bp.resistanceLayers.high}
- Confiance rare (80%+) : ${bp.resistanceLayers.rare}

INDICES INVOLONTAIRES :
- Sujet évité : ${bp.involuntaryClues.avoidedSubject}
- Réaction révélatrice : ${bp.involuntaryClues.telltaleReaction}
- Contradiction : ${bp.involuntaryClues.contradiction}
- Détail trahissant : ${bp.involuntaryClues.betrayingDetail}

Ce qui pourrait ${object} faire parler : ${bp.secret.breakingPoint}`

  const clues: Clue[] = bp.clues.map(c => ({
    id: c.id,
    revealedBy: bp.id,
    content: c.content,
    trustRequired: c.trustRequired,
  }))

  const canReactTo: Record<string, string> = {}
  const knowsAbout: string[] = []
  const sharedEvents: string[] = []

  bp.relations.forEach(bond => {
    knowsAbout.push(bond.characterId)
    bond.sharedEvents.forEach(e => {
      if (!sharedEvents.includes(e)) sharedEvents.push(e)
    })
    canReactTo[bond.characterId] = `${bp.identity.name} connaît ce personnage.
Point de vue subjectif : ${bond.subjectiveView}
${bond.ignoredFact ? `Ce ${reflexive} ignore que l'autre sait : ${bond.ignoredFact}` : ''}
Si le lecteur le mentionne : ${bond.reactionIfMentioned}`
  })

  const character: Character = {
    id: bp.id,
    name: bp.identity.name,
    description: bp.displayDescription ?? bp.identity.profession,
    available: bp.available ?? true,
    intro: bp.intro,
    systemPrompt: bp.systemPrompt,
    trustEvaluation,
    trustProfile: bp.trustProfile,
    pronoun: bp.pronoun,
    locationContext: bp.locationContext,
    schedule: bp.schedule,
    unavailableReason: bp.unavailableReason,
    sessionMessageLimit: bp.sessionMessageLimit ?? 40,
  }

  return { character, clues, relation: { characterId: bp.id, data: { knowsAbout, sharedEvents, canReactTo } } }
}
