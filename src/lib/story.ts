/**
 * src/lib/story.ts
 *
 * Le cœur du récit — "Les recettes du Sud-Ouest"
 * Montréal, Sud-Ouest, 2007.
 *
 * STRUCTURE NARRATIVE COMPLÈTE — 6 lieux, 12 personnages, 5 chapitres + épilogue
 *
 * Ch.1 — Le canal          : canal-lachine              [Martine]
 * Ch.2 — Le quartier       : cafe-monk                  [Théo, Carole]
 *                            chez-gilles                 [Gilles, Roger]
 * Ch.3 — La bibliothèque   : bibliotheque-saint-henri   [Lucette, Rémi]
 * Ch.4 — Le parc           : parc-marguerite-bourgeoys  [Fernande, Normand]
 * Ch.5 — L'église          : eglise-saint-irenee        [Père Anselme, Agathe]
 * Épilogue                 : canal-lachine-nuit          [Carole — version finale]
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

Les quatre vrais coupables :
— Armand Trottier, directeur financier de l'usine Viau
— Rosaire Gendron, avocat d'affaires, conseiller juridique du syndicat
— Marcel Lepage, comptable de la caisse syndicale (époux de Fernande Lepage)
— Paul-Émile Auger, président du conseil d'administration

Tous quatre sont morts. Leurs familles vivent sur la fortune accumulée.

Fernand savait. Il a tout consigné dans son cahier de notes syndicales —
celui qu'il trimbalait partout, que tout le monde prenait pour un simple carnet de travail.
Ce cahier contient les noms, les dates, les montants détournés.
C'est ce que Martine appelle, sans le savoir, son "livre de recettes".

Fernand allait s'asseoir à l'église Saint-Irénée tous les mardis pendant ses dernières années.
Agathe, la femme de ménage, l'a vu écrire dans son cahier. La semaine avant sa mort,
il avait une enveloppe. Cette enveloppe contenait la clé de sa case postale
ainsi qu'une lettre d'instruction — adressée au Père Anselme,
avec consigne de la remettre à Carole et seulement à Carole, à sa mort.

Le Père Anselme détient cette enveloppe. Il attend.`,

    involvedCharacters: ['martine', 'carole', 'lucette', 'fernande', 'anselme', 'agathe'],
    when: '1973 — et 2007',
    where: 'Sud-Ouest de Montréal — canal Lachine, Saint-Henri, Verdun, Ville-Émard',

    whyHidden: `Fernand s'est tu pour protéger Martine et Carole — il craignait des représailles.
Les quatre hommes avaient du pouvoir, des avocats, des contacts.
Après sa condamnation, briser le silence aurait signifié recommencer un procès
qu'il savait perdu d'avance. Il a choisi de garder le carnet comme une dernière
forme de dignité — la preuve qu'il savait, même si personne d'autre ne le savait.

Seule précaution finale : l'enveloppe remise au Père Anselme.
Fernand espérait que Carole comprendrait quoi faire du cahier.
Il ne lui a jamais expliqué pourquoi il avait gardé le silence.`,

    characterVersions: [
      {
        characterId: 'martine',
        believes: 'Fernand était innocent. Le livre de recettes est un cahier de cuisine. Carole "a ses affaires".',
        conceals: 'Rien volontairement. Elle ne sait pas ce qu\'elle cache.',
        ignores: 'La vraie nature du carnet. Les noms des quatre hommes. L\'hostilité réelle de Carole. Le fait que Fernand est mort hier.',
      },
      {
        characterId: 'carole',
        believes: 'Son père était peut-être innocent — un doute né de la fouille des affaires après sa mort. Pas une certitude.',
        conceals: 'Ce qu\'elle a trouvé dans les affaires de Fernand : une vieille adresse à Verdun, une mention de case postale sans numéro.',
        ignores: 'Que le Père Anselme détient une enveloppe pour elle. Que Fernande Lepage sait tout.',
      },
      {
        characterId: 'fernande',
        believes: 'Marcel était coupable. Fernand l\'était peut-être aussi à sa façon — il aurait pu parler et n\'a pas choisi de le faire.',
        conceals: 'Les noms des quatre hommes. Ce que son mari lui a dit avant de mourir.',
        ignores: 'Que Fernand a tout consigné dans un cahier. Que la vérité est encore accessible.',
      },
      {
        characterId: 'lucette',
        believes: 'Le procès était truqué. Elle ne sait pas par qui exactement — elle a des noms mais pas de certitude.',
        conceals: 'Qu\'elle a lu des documents qui ne lui étaient pas destinés en 1973. Qu\'elle a vu les quatre noms.',
        ignores: 'Que Fernand avait un cahier contenant les preuves. Que la clé existe encore.',
      },
    ],

    parts: [
      {
        // Chapitre 1 — toujours visible
        id: 'part-1',
        title: 'Le canal',
        unlockedByDefault: true,
        requiredClues: [],
      },
      {
        // Chapitre 2 — débloqué quand Martine révèle que Carole est au Café Monk
        id: 'part-2',
        title: 'Le quartier',
        unlockedByDefault: false,
        requiredClues: ['clue-martine-5'],
      },
      {
        // Chapitre 3 — débloqué quand Roger confirme l'existence du cahier noir
        id: 'part-3',
        title: 'La bibliothèque',
        unlockedByDefault: false,
        requiredClues: ['clue-voisin-3a'],
      },
      {
        // Chapitre 4 — débloqué quand Lucette nomme les familles impliquées
        id: 'part-4',
        title: 'Le parc',
        unlockedByDefault: false,
        requiredClues: ['clue-lucette-2'],
      },
      {
        // Chapitre 5 — débloqué quand Fernande confirme que Fernand "savait" et craignait son cahier
        id: 'part-5',
        title: "L'église",
        unlockedByDefault: false,
        requiredClues: ['clue-fernande-3'],
      },
      {
        // Épilogue — déclenché quand Agathe révèle l'enveloppe adressée au curé
        id: 'part-epilogue',
        title: 'Le canal, la nuit',
        unlockedByDefault: false,
        requiredClues: ['clue-agathe-2'],
        isEpilogue: true,
      },
    ],

    narrativeNodes: [
      // ── Chapitre 1 — Martine ─────────────────────────────────────────────────
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
        description: "Fernand gardait le livre en dehors de la maison — détail qui contredit l'idée d'un simple cahier de cuisine.",
        involvedCharacters: ['martine'],
        unlockedByClues: ['clue-martine-1b'],
      },
      {
        id: 'node-delegue-syndical',
        type: 'pivotDetail',
        description: "Fernand était délégué syndical dans les usines du Sud-Ouest.",
        involvedCharacters: ['martine'],
        unlockedByClues: ['clue-martine-2a'],
      },
      {
        id: 'node-usines-sud-ouest',
        type: 'pivotDetail',
        description: "Fernand travaillait dans les usines du Sud-Ouest de Montréal.",
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
        description: "Carole va au Café Monk. Débloque le chapitre 2.",
        involvedCharacters: ['martine', 'carole'],
        unlockedByClues: ['clue-martine-5'],
      },

      // ── Chapitre 2 — Carole (café) + Chez Gilles ────────────────────────────
      {
        id: 'node-carole-succession',
        type: 'pivotDetail',
        description: "Carole est revenue à Montréal après la mort de Fernand pour régler la succession.",
        involvedCharacters: ['carole'],
        unlockedByClues: ['clue-carole-1'],
      },
      {
        id: 'node-chez-gilles',
        type: 'pivotDetail',
        description: "Fernand allait chez un barbier à Verdun — le salon Chez Gilles. Débloque le lieu.",
        involvedCharacters: ['carole'],
        unlockedByClues: ['clue-carole-2a'],
      },
      {
        id: 'node-homme-lotion',
        type: 'pivotDetail',
        description: "Un homme sentant la lotion de rasage venait à la maison quand Carole était petite.",
        involvedCharacters: ['carole'],
        unlockedByClues: ['clue-carole-2b'],
      },
      {
        id: 'node-fernand-ne-cuisinait-pas',
        type: 'contradiction',
        description: "Fernand ne cuisinait jamais — le livre de recettes de Martine ne peut pas être un livre de cuisine.",
        involvedCharacters: ['voisin', 'martine'],
        unlockedByClues: ['clue-voisin-2'],
      },
      {
        id: 'node-cahier-notes',
        type: 'keyQuestion',
        description: "Fernand trimbalait partout un cahier noir — couverture noire, crayon avec un élastique. Débloque le chapitre 3.",
        involvedCharacters: ['voisin'],
        unlockedByClues: ['clue-voisin-3a'],
      },
      {
        id: 'node-cahier-contenu',
        type: 'pivotDetail',
        description: "Fernand notait dans son cahier les griefs des gens qu'il représentait au syndicat.",
        involvedCharacters: ['voisin'],
        unlockedByClues: ['clue-voisin-3b'],
      },

      // ── Chapitre 3 — Lucette + Rémi ─────────────────────────────────────────
      {
        id: 'node-proces-bizarre',
        type: 'contradiction',
        description: "Le procès de 1973 était bizarre — les preuves contre Fernand étaient trop propres, trop rapides.",
        involvedCharacters: ['lucette'],
        unlockedByClues: ['clue-lucette-1'],
      },
      {
        id: 'node-quatre-noms',
        type: 'keyQuestion',
        description: "Lucette a tapé des documents en 1973 avec quatre noms : Trottier, Gendron, Lepage, Auger. Débloque le chapitre 4.",
        involvedCharacters: ['lucette'],
        unlockedByClues: ['clue-lucette-2'],
      },
      {
        id: 'node-fonds-detournes-avant',
        type: 'pivotDetail',
        description: "Les fonds de pension ont été détournés avant la fermeture des usines — pas à cause d'elle.",
        involvedCharacters: ['lucette'],
        unlockedByClues: ['clue-lucette-3'],
      },
      {
        id: 'node-remi-enquete',
        type: 'pivotDetail',
        description: "Rémi enquête sur les fermetures d'usines depuis deux ans. Il a des noms mais pas de preuves.",
        involvedCharacters: ['remi'],
        unlockedByClues: ['clue-remi-1'],
      },
      {
        id: 'node-remi-lepage',
        type: 'pivotDetail',
        description: "Rémi sait que Marcel Lepage a eu un enrichissement inexpliqué après 1973. Sa veuve vit encore dans le quartier.",
        involvedCharacters: ['remi'],
        unlockedByClues: ['clue-remi-2'],
      },

      // ── Chapitre 4 — Fernande + Normand ─────────────────────────────────────
      {
        id: 'node-fernande-identite',
        type: 'pivotDetail',
        description: "Fernande est la veuve de Marcel Lepage, l'un des quatre hommes qui ont commis la fraude.",
        involvedCharacters: ['fernande'],
        unlockedByClues: ['clue-fernande-1'],
      },
      {
        id: 'node-fernande-aveu-mari',
        type: 'keyQuestion',
        description: "Marcel a dit à Fernande avant de mourir : Fernand savait. Il avait tout noté quelque part.",
        involvedCharacters: ['fernande'],
        unlockedByClues: ['clue-fernande-2'],
      },
      {
        id: 'node-fernande-peur-cahier',
        type: 'keyQuestion',
        description: "Marcel avait peur du cahier de Fernand — si Fernand l'avait encore, tout pouvait ressortir. Débloque le chapitre 5.",
        involvedCharacters: ['fernande'],
        unlockedByClues: ['clue-fernande-3'],
      },
      {
        id: 'node-normand-fortune',
        type: 'pivotDetail',
        description: "Normand évoque sans le savoir l'origine floue de la fortune familiale héritée de son père.",
        involvedCharacters: ['normand'],
        unlockedByClues: ['clue-normand-1'],
      },
      {
        id: 'node-normand-maison-verdun',
        type: 'pivotDetail',
        description: "Normand mentionne que son père recevait des hommes dans le sous-sol quand il était enfant. Il n'a jamais su pourquoi.",
        involvedCharacters: ['normand'],
        unlockedByClues: ['clue-normand-2'],
      },

      // ── Chapitre 5 — Père Anselme + Agathe ──────────────────────────────────
      {
        id: 'node-fernand-venait-eglise',
        type: 'pivotDetail',
        description: "Fernand venait s'asseoir à l'église tous les mardis. Pas pour prier — pour écrire.",
        involvedCharacters: ['anselme', 'agathe'],
        unlockedByClues: ['clue-anselme-1'],
      },
      {
        id: 'node-enveloppe-curé',
        type: 'keyQuestion',
        description: "Le Père Anselme détient quelque chose que Fernand lui a confié — à remettre à Carole uniquement.",
        involvedCharacters: ['anselme'],
        unlockedByClues: ['clue-anselme-2'],
      },
      {
        id: 'node-agathe-cahier-vu',
        type: 'pivotDetail',
        description: "Agathe a vu Fernand écrire dans un cahier noir tous les mardis, pendant des années.",
        involvedCharacters: ['agathe'],
        unlockedByClues: ['clue-agathe-1'],
      },
      {
        id: 'node-agathe-enveloppe',
        type: 'keyQuestion',
        description: "La dernière fois qu'Agathe l'a vu, Fernand avait une enveloppe adressée au Père Anselme. Débloque l'épilogue.",
        involvedCharacters: ['agathe'],
        unlockedByClues: ['clue-agathe-2'],
      },
    ],

    epilogueMessage: `Fernand est mort hier.
Il avait gardé le secret pendant trente-quatre ans.

Martine cherchait son livre de recettes.
Ce livre n'a jamais existé — du moins pas sous cette forme.
Ce que Fernand trimbalait partout, c'était son cahier de notes syndicales.
Ce qu'il y avait consigné, personne ne le savait encore.

Il y a une enveloppe chez un notaire, rue Notre-Dame Ouest.
Elle attend Carole Beausoleil.
Elle a jusqu'à la fin de la semaine.`,
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
