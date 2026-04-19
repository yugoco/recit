import { locations } from './locations'

export interface Clue {
    id: string
    revealedBy: string // characterId
    content: string    // ce que le lecteur a appris
    trustRequired: number
}

export interface Part {
    id: string
    title: string
    unlockedByDefault: boolean
    requiredClues: string[] // ids des indices nécessaires pour débloquer la partie suivante
}

export interface CharacterRelation {
    knowsAbout: string[]
    sharedEvents: string[]
    canReactTo: Record<string, string> // characterId → instruction pour le system prompt
}

export interface Story {
    truth: string
    parts: Part[]
    clues: Clue[]
    characterRelations: Record<string, CharacterRelation>
}

export const story: Story = {

    truth: `[PLACEHOLDER — vérité centrale]
  Ceci est ce qui s'est réellement passé. Cette version n'est jamais montrée 
  directement au lecteur — elle est la mesure contre laquelle on évalue 
  ce que le lecteur a découvert.`,

    parts: [
        {
            id: 'part-1',
            title: 'Les apparences',
            unlockedByDefault: true,
            requiredClues: ['clue-1', 'clue-2']
        },
        {
            id: 'part-2',
            title: 'Les fissures',
            unlockedByDefault: false,
            requiredClues: ['clue-3', 'clue-4']
        },
        {
            id: 'part-3',
            title: 'Le cœur',
            unlockedByDefault: false,
            requiredClues: []
        }
    ],

    clues: [
        {
            id: 'clue-1',
            revealedBy: 'elise',
            content: `[PLACEHOLDER] Élise mentionne une erreur ancienne sans la nommer.`,
            trustRequired: 40
        },
        {
            id: 'clue-2',
            revealedBy: 'elise',
            content: `[PLACEHOLDER] Élise parle de Marie pour la première fois.`,
            trustRequired: 65
        },
        {
            id: 'clue-3',
            revealedBy: 'thomas',
            content: `[PLACEHOLDER] Thomas donne sa version de 1947.`,
            trustRequired: 50
        },
        {
            id: 'clue-4',
            revealedBy: 'thomas',
            content: `[PLACEHOLDER] Thomas contredit ce qu'Élise a dit.`,
            trustRequired: 70
        }
    ],

    characterRelations: {
        elise: {
            knowsAbout: ['thomas'],
            sharedEvents: ['evenement-1947'],
            canReactTo: {
                thomas: `Tu connais Thomas — vous étiez tous les deux présents en 1947. 
Tu ne l'aimes pas particulièrement, mais tu le respectes. 
Si le lecteur mentionne quelque chose que Thomas lui a dit, 
tu réagis avec une légère tension — surtout si c'est une version 
différente de la tienne. Tu ne l'attaques pas directement, 
mais tu corriges avec précision.`
            }
        },
        thomas: {
            knowsAbout: ['elise'],
            sharedEvents: ['evenement-1947'],
            canReactTo: {
                elise: `Tu connais Élise depuis longtemps. Tu la respectes en tant que médecin,
mais tu crois qu'elle se ment à elle-même sur ce qui s'est passé en 1947.
Si le lecteur mentionne ce qu'Élise lui a dit, tu écoutes attentivement
avant de donner ta version — plus factuelle, moins chargée émotionnellement.`
            }
        }
    }
}

export function getCluesForCharacter(characterId: string): Clue[] {
    return story.clues.filter(c => c.revealedBy === characterId)
}

export function getRelation(characterId: string): CharacterRelation | undefined {
    return story.characterRelations[characterId]
}

/**
 * Détecte quels personnages sont mentionnés dans le message du lecteur.
 * On matche sur le nom affiché du personnage (ex: "Thomas"), pas sur l'ID technique.
 * On vérifie aussi que le match est un mot entier (pas une sous-chaîne accidentelle).
 */
export function detectMentionedCharacters(userInput: string): string[] {
    const mentioned: string[] = []
    const input = userInput.toLowerCase()

    Object.keys(story.characterRelations).forEach(charId => {
        // Trouver le nom affiché du personnage dans toutes les locations
        let displayName: string | undefined
        for (const location of locations) {
            const character = location.characters.find(c => c.id === charId)
            if (character) {
                displayName = character.name
                break
            }
        }

        if (!displayName) return

        // Matcher sur le nom affiché, mot entier, insensible à la casse et aux accents
        const nameNormalized = displayName.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
        const inputNormalized = input.normalize('NFD').replace(/[\u0300-\u036f]/g, '')

        // \b assure un match sur mot entier — évite "marc" dans "remarque"
        const regex = new RegExp(`\\b${nameNormalized}\\b`)
        if (regex.test(inputNormalized)) {
            mentioned.push(charId)
        }
    })

    return mentioned
}

/**
 * Vérifie si une partie narrative est débloquée.
 * La logique est centralisée ici — detectClues dans page.tsx doit appeler cette fonction.
 */
export function isPartUnlocked(partId: string, discoveredClues: string[]): boolean {
    const part = story.parts.find(p => p.id === partId)
    if (!part) return false
    if (part.unlockedByDefault) return true

    const partIndex = story.parts.findIndex(p => p.id === partId)
    if (partIndex === 0) return true
    const previousPart = story.parts[partIndex - 1]
    return previousPart.requiredClues.every(clueId => discoveredClues.includes(clueId))
}

/**
 * Calcule quelles parties passent de verrouillées à débloquées
 * suite à l'ajout de nouveaux indices.
 */
export function computeNewlyUnlockedParts(
    completedParts: string[],
    discoveredClues: string[]
): string[] {
    const newlyUnlocked: string[] = []
    story.parts.forEach(part => {
        if (
            !part.unlockedByDefault &&
            !completedParts.includes(part.id) &&
            isPartUnlocked(part.id, discoveredClues)
        ) {
            newlyUnlocked.push(part.id)
        }
    })
    return newlyUnlocked
}
