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

// ─── Identité de surface ──────────────────────────────────────────────────────

export interface CharacterIdentity {
  name: string
  age: number
  profession: string
  location: string           // ville / quartier / lieu de vie
  era: string                // ex. "Lyon, 1953"
  appearance: string         // première impression physique, en prose courte
  speechStyle: string        // registre, rythme, tics de langage — servira au systemPrompt
}

// ─── Intériorité ──────────────────────────────────────────────────────────────

export interface CharacterInner {
  consciousDesire: string    // ce qu'il croit vouloir
  unconsciousNeed: string    // ce dont il a réellement besoin
  foundingWound: string      // l'événement formateur
  pride: string              // ce dont il est fier
  regret: string             // ce qu'il regrette
}

// ─── Le secret ───────────────────────────────────────────────────────────────

export interface CharacterSecret {
  fullTruth: string          // version complète, jamais dite — correspond à la vérité de story.ts
  perceivedTruth: string     // ce que le personnage croit avoir fait (peut différer)
  silenceReason: string      // pourquoi il se tait
  breakingPoint: string      // ce qui pourrait le faire parler
}

// ─── Couches de résistance ────────────────────────────────────────────────────

export interface ResistanceLayers {
  low: string                // trust 0–30% : dit à n'importe qui
  medium: string             // trust 30–60% : laisse transparaître
  high: string               // trust 60–80% : admet à demi-mot
  rare: string               // trust 80%+ : ne dit qu'une fois
}

// ─── Indices involontaires ────────────────────────────────────────────────────

export interface InvoluntaryClues {
  avoidedSubject: string     // sujet systématiquement évité
  telltaleReaction: string   // réaction quand on approche la vérité
  contradiction: string      // écart entre ce qu'il dit et ce qu'il fait
  betrayingDetail: string    // objet, lieu ou nom qui le trahit
}

// ─── Relations ────────────────────────────────────────────────────────────────

export interface CharacterBond {
  characterId: string        // id de l'autre personnage
  subjectiveView: string     // ce que ce personnage pense de l'autre (biaisé)
  sharedEvents: string[]     // ids des événements communs (référencés dans story.ts)
  reactionIfMentioned: string // instruction pour le systemPrompt si le lecteur mentionne cet autre personnage
  ignoredFact?: string       // ce que ce personnage ignore que l'autre sait
}

// ─── Blueprint complet ────────────────────────────────────────────────────────

export interface CharacterBlueprint {
  // Identifiants techniques
  id: string
  locationId: string         // lieu principal d'apparition

  // Template narratif
  identity: CharacterIdentity
  inner: CharacterInner
  secret: CharacterSecret
  resistanceLayers: ResistanceLayers
  involuntaryClues: InvoluntaryClues
  relations: CharacterBond[]

  // Indices narratifs que ce personnage peut révéler
  // (trustRequired correspond aux seuils des ResistanceLayers)
  clues: Array<{
    id: string
    content: string
    trustRequired: number    // 40 → medium, 65 → high, 80 → rare
  }>

  // Champs manuels — voix et mise en scène
  systemPrompt: string       // prose complète, écrite à la main
  intro: string              // première réplique à la première visite

  // Champs techniques
  pronoun: 'elle' | 'il'    // obligatoire — pas de valeur par défaut silencieuse
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

// ─── Générateur ───────────────────────────────────────────────────────────────

/**
 * buildCharacter()
 *
 * Transforme un CharacterBlueprint en un objet compatible avec
 * l'interface Character de types.ts, et retourne également les
 * Clue[] et CharacterRelation à injecter dans story.ts.
 */
export function buildCharacter(bp: CharacterBlueprint): {
  character: Character
  clues: Clue[]
  relation: { characterId: string; data: CharacterRelation }
} {

  // ── Pronoms dérivés du blueprint ──────────────────────────────────────────
  const pronoun   = bp.pronoun
  const subject   = pronoun === 'elle' ? 'Elle'    : 'Il'        // Elle / Il
  const object    = pronoun === 'elle' ? 'la'      : 'le'        // la faire / le faire
  const reflexive = pronoun === 'elle' ? 'qu\'elle' : 'qu\'il'   // ce qu'elle ignore / ce qu'il ignore

  // ── trustEvaluation généré ────────────────────────────────────────────────
  const trustEvaluation = `${bp.identity.name} est ${bp.identity.profession}.
${bp.identity.speechStyle}

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

  // ── Clues générés ─────────────────────────────────────────────────────────
  const clues: Clue[] = bp.clues.map(c => ({
    id: c.id,
    revealedBy: bp.id,
    content: c.content,
    trustRequired: c.trustRequired
  }))

  // ── CharacterRelation générée ─────────────────────────────────────────────
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

  const relation: CharacterRelation = { knowsAbout, sharedEvents, canReactTo }

  // ── Character (compatible types.ts) ───────────────────────────────────────
  const character: Character = {
    id: bp.id,
    name: bp.identity.name,
    description: bp.identity.profession,
    available: bp.available ?? true,
    intro: bp.intro,
    systemPrompt: bp.systemPrompt,
    trustEvaluation,
    pronoun: bp.pronoun,
    locationContext: bp.locationContext,
    schedule: bp.schedule,
    unavailableReason: bp.unavailableReason,
    sessionMessageLimit: bp.sessionMessageLimit ?? 40
  }

  return { character, clues, relation: { characterId: bp.id, data: relation } }
}
