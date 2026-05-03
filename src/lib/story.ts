/**
 * src/lib/story.ts
 *
 * Le cœur du récit — "Les recettes du Sud-Ouest"
 * Montréal, Sud-Ouest, contemporain.
 */

import { locations } from './locations'

// ─── Types ────────────────────────────────────────────────────────────────────

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
Il est mort hier. Sauf peut-être à Carole, sa fille, qui a retrouvé
des documents après sa mort.`,

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
        believes: 'Fernand était innocent. Le livre de recettes est un cahier de cuisine. Carole "a ses affaires".',
        conceals: 'Rien volontairement. Elle ne sait pas ce qu\'elle cache.',
        ignores: 'La vraie nature du carnet. Les noms des quatre hommes. L\'hostilité réelle de Carole.',
      },
    ],

    parts: [
      {
        id: 'part-1',
        title: 'Le canal',
        unlockedByDefault: true,
        requiredClues: [],
      },
      {
        // Débloqué quand Martine révèle l'indice difficile :
        // — Carole est souvent au Café Monk (clue-martine-5)
        // → débloque le lieu : Café Monk
        id: 'part-2',
        title: 'Le Café Monk',
        unlockedByDefault: false,
        requiredClues: ['clue-martine-5'],
      },
      {
        // Débloqué quand Carole révèle un indice sur le quartier (Verdun, le barbier)
        // → débloque le lieu : Chez Gilles
        id: 'part-3',
        title: 'Chez Gilles',
        unlockedByDefault: false,
        requiredClues: ['clue-carole-1'],
      },
      {
        id: 'part-4',
        title: 'L\'argent',
        unlockedByDefault: false,
        requiredClues: [], // à compléter avec les clues du chapitre 3
      },
      {
        id: 'part-5',
        title: 'Les mains propres',
        unlockedByDefault: false,
        requiredClues: [], // à compléter avec les clues du chapitre 4-5
        isEpilogue: true,
      },
    ],

    narrativeNodes: [
      {
        id: 'node-livre-recettes',
        type: 'pivotDetail',
        description: 'Martine cherche activement le livre de recettes de Fernand — elle en parle dès le premier échange.',
        involvedCharacters: ['martine'],
        unlockedByClues: ['clue-martine-1'],
      },
      {
        id: 'node-delegue-syndical',
        type: 'pivotDetail',
        description: 'Fernand était délégué syndical — un détail qui donne au "livre de recettes" une tout autre portée possible.',
        involvedCharacters: ['martine'],
        unlockedByClues: ['clue-martine-2'],
      },
      {
        id: 'node-mort-fernand',
        type: 'keyQuestion',
        description: 'Fernand est mort hier. Martine le sait dans un coin de sa tête, mais sa démence douce brouille la chronologie.',
        involvedCharacters: ['martine'],
        unlockedByClues: ['clue-martine-3'],
      },
      {
        id: 'node-fille-carole',
        type: 'keyQuestion',
        description: "Martine a une fille, Carole. Elle \"a ses affaires\" — une distance floue que Martine ne comprend plus vraiment.",
        involvedCharacters: ['martine', 'carole'],
        unlockedByClues: ['clue-martine-4'],
      },
      {
        id: 'node-cafe-carole',
        type: 'keyQuestion',
        description: "Carole fréquente le Café Monk, rue Monk à Ville-Émard. Martine le sait mais n'y va plus.",
        involvedCharacters: ['martine', 'carole'],
        unlockedByClues: ['clue-martine-5'],
      },
    ],

    epilogueMessage: `Vous avez reconstitué ce que Fernand Beausoleil n'a jamais pu dire.
Les noms sur les plaques de rue ne changeront pas.
Mais vous savez maintenant ce qu'ils recouvrent.`,
  },

  clues: [],
  characterRelations: {},
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
  // Une part sans requiredClues n'est pas encore écrite — elle reste verrouillée.
  // [].every() retourne true en JS, ce qui déclencherait l'épilogue prématurément.
  if (part.requiredClues.length === 0) return false
  return part.requiredClues.every(clueId => discoveredClues.includes(clueId))
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


