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
  // Éléments factuels qui doivent TOUS avoir été évoqués dans la conversation
  // avant que cet indice puisse être détecté. Si absent ou vide, pas de pré-requis.
  triggerElements?: string[]
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

Fernand savait qui avait commis la fraude. Il a tout consigné dans son cahier de notes
syndicales — celui qu'il trimbalait partout, que tout le monde prenait pour un simple
carnet de travail. Ce cahier contient les noms, les dates, les montants.
C'est ce que Martine appelle son "livre de recettes".

Les vrais coupables sont morts. Leurs descendants vivent sur la fortune accumulée.
La vérité complète n'émergera qu'au terme des cinq chapitres.`,

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
        // Débloqué quand Martine révèle que Carole est au Café Monk (clue-martine-5)
        id: 'part-2',
        title: 'Le Café Monk',
        unlockedByDefault: false,
        requiredClues: ['clue-martine-5'],
      },
      {
        // Débloqué quand Carole mentionne le salon Chez Gilles (clue-carole-2a)
        id: 'part-3',
        title: 'Chez Gilles',
        unlockedByDefault: false,
        requiredClues: ['clue-carole-2a'],
      },
      {
        id: 'part-4',
        title: "L'argent",
        unlockedByDefault: false,
        requiredClues: [],
      },
      {
        id: 'part-5',
        title: 'Les mains propres',
        unlockedByDefault: false,
        requiredClues: [],
      },
      {
        // Épilogue de la démo — déclenché par le punch final de Roger
        id: 'part-demo-end',
        title: 'Fin de la démo',
        unlockedByDefault: false,
        requiredClues: ['clue-voisin-3a'],
        isEpilogue: true,
      },
    ],

    narrativeNodes: [
      {
        id: 'node-livre-recettes',
        type: 'pivotDetail',
        description: "Martine cherche le livre de recettes de Fernand — le moteur initial du récit.",
        involvedCharacters: ['martine'],
        unlockedByClues: ['clue-martine-1a'],
      },
      {
        id: 'node-livre-hors-maison',
        type: 'pivotDetail',
        description: "Fernand gardait le livre en dehors de la maison — detail qui contredit l'idée d'un simple cahier de cuisine.",
        involvedCharacters: ['martine'],
        unlockedByClues: ['clue-martine-1b'],
      },
      {
        id: 'node-delegue-syndical',
        type: 'pivotDetail',
        description: "Fernand était délégué syndical.",
        involvedCharacters: ['martine'],
        unlockedByClues: ['clue-martine-2a'],
      },
      {
        id: 'node-usines-sud-ouest',
        type: 'pivotDetail',
        description: "Fernand travaillait dans les usines du Sud-Ouest.",
        involvedCharacters: ['martine'],
        unlockedByClues: ['clue-martine-2b'],
      },
      {
        id: 'node-mort-fernand',
        type: 'keyQuestion',
        description: "Fernand est mort hier.",
        involvedCharacters: ['martine'],
        unlockedByClues: ['clue-martine-3'],
      },
      {
        id: 'node-fille-carole',
        type: 'keyQuestion',
        description: "Martine a une fille, Carole. Elles sont distantes.",
        involvedCharacters: ['martine', 'carole'],
        unlockedByClues: ['clue-martine-4a', 'clue-martine-4b'],
      },
      {
        id: 'node-cafe-monk',
        type: 'keyQuestion',
        description: "Carole va au Café Monk. Débloque le lieu.",
        involvedCharacters: ['martine', 'carole'],
        unlockedByClues: ['clue-martine-5'],
      },
      {
        id: 'node-chez-gilles',
        type: 'pivotDetail',
        description: "Fernand allait chez Gilles à Verdun. Débloque le lieu.",
        involvedCharacters: ['carole'],
        unlockedByClues: ['clue-carole-2a'],
      },
      {
        id: 'node-homme-lotion',
        type: 'pivotDetail',
        description: "Un homme sentant la lotion de rasage venait à la maison quand Carole était petite.",
        involvedCharacters: ['carole', 'voisin'],
        unlockedByClues: ['clue-carole-2b'],
      },
      {
        id: 'node-fernand-ne-cuisinait-pas',
        type: 'contradiction',
        description: "Fernand ne cuisinait jamais — ce que Martine appelle le livre de recettes ne peut pas être un livre de cuisine.",
        involvedCharacters: ['voisin', 'martine'],
        unlockedByClues: ['clue-voisin-2'],
      },
      {
        id: 'node-cahier-notes',
        type: 'keyQuestion',
        description: "Fernand trimbalait partout un cahier de notes syndicales — couverture noire, crayon avec un élastique. Déclenche la fin de la démo.",
        involvedCharacters: ['voisin'],
        unlockedByClues: ['clue-voisin-3a'],
      },
      {
        id: 'node-cahier-contenu',
        type: 'pivotDetail',
        description: "Fernand notait dans son cahier les griefs des gens qu'il représentait.",
        involvedCharacters: ['voisin'],
        unlockedByClues: ['clue-voisin-3b'],
      },
    ],
    epilogueMessage: `Vous venez de compléter la démo de Récit.

Martine cherchait le livre de recettes de Fernand.
Ce livre n'existe pas — du moins pas sous cette forme.
Ce que Fernand trimbalait partout, c'était son cahier de notes syndicales.
Ce qu'il avait mis dedans, personne ne le sait encore.

La suite arrive.`,
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


