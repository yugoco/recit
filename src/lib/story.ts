/**
 * src/lib/story.ts
 *
 * Le cœur du récit — "Les mains propres"
 * Montréal, Sud-Ouest, contemporain.
 *
 * Vérité centrale : la fraude des fonds de pension des années 70
 * n'a pas été commise par Fernand Beausoleil. Il a été le bouc émissaire
 * d'un réseau de notables dont les noms ornent aujourd'hui les plaques
 * de rue et les édifices municipaux du Sud-Ouest.
 */

import { locations } from './locations'

// ─── Types — Personnage ───────────────────────────────────────────────────────

export interface Clue {
  id: string
  revealedBy: string
  content: string
  trustRequired: number
}

export interface Part {
  id: string
  title: string
  unlockedByDefault: boolean
  requiredClues: string[]
  isEpilogue?: boolean
}

export interface CharacterRelation {
  knowsAbout: string[]
  sharedEvents: string[]
  canReactTo: Record<string, string>
}

// ─── Types — Cœur du récit ────────────────────────────────────────────────────

export interface CharacterVersion {
  characterId: string
  believes: string
  conceals: string
  ignores: string
}

export interface NarrativeNode {
  id: string
  type: 'contradiction' | 'pivotDetail' | 'keyQuestion'
  description: string
  involvedCharacters: string[]
  unlockedByClues?: string[]
}

export interface Heart {
  truth: string
  involvedCharacters: string[]
  when: string
  where: string
  whyHidden: string
  characterVersions: CharacterVersion[]
  parts: Part[]
  narrativeNodes: NarrativeNode[]
  epilogueMessage: string
}

export interface Story {
  heart: Heart
  clues: Clue[]
  characterRelations: Record<string, CharacterRelation>
}

// ─── Le cœur du récit ─────────────────────────────────────────────────────────

export const story: Story = {

  heart: {
    truth: `En 1973, la fermeture des usines du Sud-Ouest de Montréal s'est accompagnée 
d'une fraude massive sur les fonds de pension de plusieurs centaines de familles ouvrières. 
Fernand Beausoleil, délégué syndical respecté, a été accusé, jugé et emprisonné pour ce vol. 
Il n'en était pas l'auteur.

L'argent a été détourné par un réseau de quatre hommes : un avocat d'affaires, 
un comptable municipal, un promoteur immobilier et un conseiller politique. 
Ils ont utilisé les fonds pour acquérir à vil prix des terrains contaminés 
du Sud-Ouest — des terrains que personne ne voulait, que tout le monde fuyait. 
Ils ont attendu. Décontaminé discrètement. Revendu ou développé décennie après décennie.

Ces quatre hommes sont aujourd'hui morts. Leurs noms ornent des rues, 
des bibliothèques, des arénas du Sud-Ouest. Leurs enfants et petits-enfants 
vivent sur cette fortune sans en connaître l'origine.

Fernand Beausoleil a tout su. Il a gardé un carnet chiffré — qu'il appelait 
son "livre de recettes" — contenant les noms, les dates, les montants et 
les numéros de comptes. Une assurance-vie qu'il n'a jamais utilisée. 
Il est mort sans l'avoir transmise à personne. Sauf peut-être à Carole, 
sa fille, qui a retrouvé des documents après sa mort.`,

    involvedCharacters: ['martine', 'carole'],
    when: '1973 — et aujourd\'hui',
    where: 'Sud-Ouest de Montréal — usines, terrains, canal Lachine',
    whyHidden: `Fernand s'est tu pour protéger Martine et Carole — il craignait des représailles. 
Les quatre hommes avaient du pouvoir, des avocats, des contacts. 
Après sa condamnation, briser le silence aurait signifié recommencer un procès 
qu'il savait perdu d'avance. Il a choisi de garder le carnet comme une dernière 
forme de dignité — la preuve qu'il savait, même si personne d'autre ne le savait.`,

    characterVersions: [
      {
        characterId: 'martine',
        believes: 'Fernand était innocent — "tout le monde le savait dans le quartier". Le livre de recettes est un cahier de cuisine avec une recette de tourtière extraordinaire.',
        conceals: 'Rien volontairement. Elle ne sait pas ce qu\'elle cache.',
        ignores: 'La vraie nature du carnet. Les noms des quatre hommes. Le fait que Carole sait déjà quelque chose.'
      }
    ],

    parts: [
      {
        id: 'part-1',
        title: 'Le banc',
        unlockedByDefault: true,
        requiredClues: []
      },
      {
        id: 'part-2',
        title: 'Le quartier',
        unlockedByDefault: false,
        requiredClues: ['clue-martine-1', 'clue-martine-3']
      },
      {
        id: 'part-3',
        title: 'Les archives',
        unlockedByDefault: false,
        requiredClues: []   // à compléter avec les clues du chapitre 2
      },
      {
        id: 'part-4',
        title: 'L\'argent',
        unlockedByDefault: false,
        requiredClues: []   // à compléter avec les clues du chapitre 3
      },
      {
        id: 'part-5',
        title: 'Les mains propres',
        unlockedByDefault: false,
        requiredClues: [],  // à compléter avec les clues du chapitre 4-5
        isEpilogue: true
      }
    ],

    narrativeNodes: [
      {
        id: 'node-livre-dehors',
        type: 'pivotDetail',
        description: 'Martine mentionne que le livre était conservé "en dehors de la maison". Un cahier de cuisine ne se garde pas hors de chez soi.',
        involvedCharacters: ['martine'],
        unlockedByClues: ['clue-martine-1']
      },
      {
        id: 'node-phrase-fernand',
        type: 'keyQuestion',
        description: '"Ce livre-là, tu le donnes à personne." — la phrase que Fernand a dite à Martine. C\'est la première preuve que le carnet n\'est pas anodin.',
        involvedCharacters: ['martine'],
        unlockedByClues: ['clue-martine-2']
      },
      {
        id: 'node-carole-sait',
        type: 'contradiction',
        description: 'Martine dit que Carole "a jamais pardonné à son père". Mais Carole a retrouvé des documents. Sa colère n\'est peut-être pas ce qu\'elle semble être.',
        involvedCharacters: ['martine', 'carole'],
        unlockedByClues: ['clue-martine-3']
      }
    ],

    epilogueMessage: `Vous avez reconstitué ce que Fernand Beausoleil n'a jamais pu dire.
Les noms sur les plaques de rue ne changeront pas.
Mais vous savez maintenant ce qu'ils recouvrent.`
  },

  // Peuplés automatiquement par registerCharacter()
  clues: [],
  characterRelations: {}
}

// ─── Injection depuis locations.ts ────────────────────────────────────────────

export function registerCharacter(
  clues: Clue[],
  relation: { characterId: string; data: CharacterRelation }
): void {
  clues.forEach(clue => {
    if (!story.clues.find(c => c.id === clue.id)) {
      story.clues.push(clue)
    }
  })
  story.characterRelations[relation.characterId] = relation.data
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function getCluesForCharacter(characterId: string): Clue[] {
  return story.clues.filter(c => c.revealedBy === characterId)
}

export function getRelation(characterId: string): CharacterRelation | undefined {
  return story.characterRelations[characterId]
}

export function detectMentionedCharacters(userInput: string): string[] {
  const mentioned: string[] = []
  const input = userInput.toLowerCase()

  Object.keys(story.characterRelations).forEach(charId => {
    let displayName: string | undefined
    for (const location of locations) {
      const character = location.characters.find(c => c.id === charId)
      if (character) { displayName = character.name; break }
    }
    if (!displayName) return

    const nameNormalized  = displayName.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    const inputNormalized = input.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    const regex = new RegExp(`\\b${nameNormalized}\\b`)
    if (regex.test(inputNormalized)) mentioned.push(charId)
  })

  return mentioned
}

export function isPartUnlocked(partId: string, discoveredClues: string[]): boolean {
  const part = story.heart.parts.find(p => p.id === partId)
  if (!part) return false
  if (part.unlockedByDefault) return true

  const partIndex = story.heart.parts.findIndex(p => p.id === partId)
  if (partIndex === 0) return true
  const previousPart = story.heart.parts[partIndex - 1]
  return previousPart.requiredClues.every(clueId => discoveredClues.includes(clueId))
}

export function computeNewlyUnlockedParts(
  completedParts: string[],
  discoveredClues: string[]
): string[] {
  return story.heart.parts
    .filter(part =>
      !part.unlockedByDefault &&
      !completedParts.includes(part.id) &&
      isPartUnlocked(part.id, discoveredClues)
    )
    .map(part => part.id)
}

export function checkStoryComplete(newlyUnlockedPartIds: string[]): boolean {
  return newlyUnlockedPartIds.some(id => {
    const part = story.heart.parts.find(p => p.id === id)
    return part?.isEpilogue === true
  })
}
