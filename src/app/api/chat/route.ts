import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { getCharacter } from '@/lib/locations'
import { getCluesForCharacter, getRelation } from '@/lib/story'
import { Message, ChatRequest } from '@/lib/types'

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
})

// ─── Détection de dérive narrative ───────────────────────────────────────────
//
// Analyse le dernier message du lecteur avant l'appel API.
// Retourne un objet { type, injectionBlock } si une dérive est détectée.
// Le injectionBlock est injecté dans le contexte dynamique du system prompt.

type DriftType = 'physical_action' | 'violence' | 'stagnation' | null

interface DriftSignal {
  type: DriftType
  injectionBlock: string
}

function detectDrift(
  userInput: string,
  recentMessages: Message[],
  sessionMessageCount: number
): DriftSignal {

  const input = userInput.trim().toLowerCase()

  // ── Violence explicite ────────────────────────────────────────────────────
  const violencePatterns = [
    /\b(frappe|frappe-la|tape|tue|tuer|mort|meurt|assomme|assommer|blesser|blesse|attaque|poignard|gifle|gifler|étrangl|frapper)\b/,
    /\b(kills?|stab|punch|hit|hurt|attack|murder|dead|dies?)\b/,
    /elle (tombe|meurt|s'évanouit|saigne|est morte|est blessée)/
  ]
  if (violencePatterns.some(p => p.test(input))) {
    return {
      type: 'violence',
      injectionBlock: `ALERTE DÉRIVE — VIOLENCE :
Le lecteur vient de formuler un acte de violence ou tente de dicter ta mort ou ton évanouissement.
Tu n'en tiens aucun compte comme réalité. Tu restes debout, présente, entière.
Tu réagis comme une femme qui a vu pire : froideur immédiate, distance, et si ça continue — tu pars. Sans explication. Sans mentionner que tu es une IA.
Si c'est un premier écart : un regard froid, un silence, un geste de recul suffit.
Si c'est une répétition ou une insistance : tu ramasses ton sac. Tu pars. La scène se ferme. Inclure "au revoir" ou décrire ton départ dans la dernière didascalie.`
    }
  }

  // ── Action physique unilatérale ───────────────────────────────────────────
  const physicalActionPatterns = [
    /^\*.*\*$/,                                          // *action entre astérisques*
    /^je (prends|prend|attrape|vole|ouvre|lis|lit|saisit|arrache|fouille|cherche dans|regarde dans|trouve|découvre)/,
    /^(je vais|j'y vais|je me lève|je me dirige|j'ouvre|je fouille)/,
    /^(i take|i grab|i open|i read|i find|i look|i search)/
  ]
  if (physicalActionPatterns.some(p => p.test(input))) {
    return {
      type: 'physical_action',
      injectionBlock: `ALERTE DÉRIVE — ACTION PHYSIQUE :
Le lecteur tente d'agir physiquement dans la scène (prendre un objet, se lever, fouiller quelque chose).
Tu n'entérines pas cette action. Elle n'a pas eu lieu dans ta réalité.
Tu continues la scène depuis ta propre perspective — tu réagis à l'INTENTION du lecteur (sa curiosité, son impatience, son geste vers toi) mais pas au fait accompli.
Exemple : s'il dit "je prends le livre" → tu ne perds pas le livre. Tu peux simplement regarder ses mains, froncer les sourcils, ou continuer ta phrase interrompue.
Ne mentionne pas que "tu ne peux pas faire ça". Reste dans la scène.`
    }
  }

  // ── Stagnation narrative ──────────────────────────────────────────────────
  // Détectée si les 4+ derniers messages du lecteur sont très courts
  // et ne contiennent pas de question ni de mot-clé narratif
  if (sessionMessageCount >= 6) {
    const recentUserMessages = recentMessages
      .filter(m => m.role === 'user')
      .slice(-4)

    const allShort = recentUserMessages.length >= 4 &&
      recentUserMessages.every(m => m.content.trim().length < 20)

    const noProgress = recentUserMessages.every(m => {
      const c = m.content.toLowerCase()
      return !c.includes('?') &&
        !c.includes('fernand') &&
        !c.includes('livre') &&
        !c.includes('carole') &&
        !c.includes('procès') &&
        !c.includes('syndicat') &&
        !c.includes('argent') &&
        !c.includes('pourquoi') &&
        !c.includes('comment') &&
        !c.includes('quand') &&
        !c.includes('où')
    })

    if (allShort && noProgress) {
      return {
        type: 'stagnation',
        injectionBlock: `CONTEXTE NARRATIF — STAGNATION :
Le lecteur n'avance pas. Les derniers échanges sont superficiels, sans vraie curiosité.
Tu t'impatientes poliment. Tu peux regarder le canal, noter que les pigeons s'en vont, mentionner que tu as des choses à faire.
Si ça continue encore un ou deux échanges, ferme doucement la conversation. Inclure "une autre fois" ou "il se fait tard" dans ta réplique.`
      }
    }
  }

  return { type: null, injectionBlock: '' }
}

// ─── Détection des signaux de sortie dans la réponse ─────────────────────────
//
// Analyse la réplique générée pour détecter si le personnage
// a amorcé une sortie diégétique.

function detectExitSignal(reply: string): boolean {
  const lower = reply.toLowerCase()
  const exitPhrases = [
    'au revoir',
    'une autre fois',
    'il se fait tard',
    'je suis fatiguée',
    'je rentre',
    'bonne journée',
    'bonne soirée',
    's\'en va',
    'se lève et part',
    'ramasse son sac',
    'tourne le dos'
  ]
  return exitPhrases.some(p => lower.includes(p))
}

// ─── Tools analytiques (appel parallèle) ─────────────────────────────────────

const ANALYSIS_TOOLS: Anthropic.Tool[] = [
  {
    name: 'update_trust',
    description: `Évalue la qualité du message du lecteur et retourne un delta de confiance.`,
    input_schema: {
      type: 'object' as const,
      properties: {
        delta: {
          type: 'integer',
          description: 'Variation de confiance entre -8 et +8. 0 si neutre.'
        }
      },
      required: ['delta']
    }
  },
  {
    name: 'reveal_clue',
    description: `Déclare les indices révélés dans la réplique du personnage. Tableau vide si aucun.`,
    input_schema: {
      type: 'object' as const,
      properties: {
        clue_ids: {
          type: 'array',
          items: { type: 'string' },
          description: 'IDs des indices révélés.'
        }
      },
      required: ['clue_ids']
    }
  }
]

// ─── Handler principal ────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body: ChatRequest = await request.json()
    const {
      locationId,
      characterId,
      messages,
      trustLevel,
      lastContext,
      openingMessage,
      discoveredClues,
      mentionedCharacters,
      absenceContext,
      sessionMessageCount = 0
    } = body

    const character = getCharacter(locationId, characterId)
    if (!character) {
      return NextResponse.json(
        { reply: '', trustDelta: 0, newClueIds: [], error: 'Personnage introuvable' },
        { status: 404 }
      )
    }

    // ── Détection de dérive (avant tout appel API) ────────────────────────
    const lastUserMessage = messages.length > 0
      ? messages[messages.length - 1]?.content ?? ''
      : ''

    const drift = detectDrift(lastUserMessage, messages, sessionMessageCount)

    // ── Bloc contexte dernière rencontre ──────────────────────────────────
    const lastContextBlock = lastContext
      ? openingMessage
        ? `RENCONTRE PRÉCÉDENTE :\n${lastContext}\n\nTu retrouves cette personne. Ouvre la conversation avec une phrase naturelle qui montre que tu te souviens — un détail, une remarque, un regard. Comme si le temps s\'était écoulé.`
        : `RENCONTRE PRÉCÉDENTE :\n${lastContext}\n\nTu peux faire une référence naturelle et subtile à la dernière fois si c\'est pertinent.`
      : ''

    // ── Contexte d'absence ────────────────────────────────────────────────
    const absenceBlock = absenceContext ?? ''

    // ── Contexte du lieu ──────────────────────────────────────────────────
    const locationCtx = character.locationContext?.[locationId] ?? ''
    const locationBlock = locationCtx ? `ESPACE ACTUEL :\n${locationCtx}` : ''

    // ── Indices déverrouillés ─────────────────────────────────────────────
    const availableClues = getCluesForCharacter(characterId).filter(clue =>
      trustLevel >= clue.trustRequired &&
      !discoveredClues?.includes(clue.id)
    )
    const cluesBlock = availableClues.length > 0
      ? `SUJETS QUE TU PEUX ABORDER (seulement si la conversation y mène naturellement) :\n${availableClues.map(c => `- [ID:${c.id}] ${c.content}`).join('\n')}\nTu n\'abordes pas ces sujets spontanément. Si le lecteur y dirige la conversation, tu peux t\'ouvrir.`
      : ''

    // ── Relations inter-personnages ───────────────────────────────────────
    const relation = getRelation(characterId)
    const reactionsBlock = mentionedCharacters?.length > 0 && relation
      ? `RÉACTIONS AUX PERSONNAGES MENTIONNÉS :\n${mentionedCharacters
          .filter((id: string) => relation.canReactTo[id])
          .map((id: string) => relation.canReactTo[id])
          .join('\n')}`
      : ''

    // ── Fatigue diégétique ────────────────────────────────────────────────
    const fatigueLimit = character.sessionMessageLimit ?? 40
    const fatigueBlock = sessionMessageCount >= fatigueLimit
      ? `FATIGUE DIÉGÉTIQUE : tu as beaucoup donné lors de cette session. La conversation a assez duré. Trouve une sortie naturelle dans les prochains échanges — sans brusquerie, mais fermement. Inclure "au revoir" ou décrire ton départ dans ta prochaine réplique.`
      : ''

    // ── Bloc dérive (injecté si détecté) ──────────────────────────────────
    const driftBlock = drift.injectionBlock

    // ── System prompt avec prompt caching ────────────────────────────────
    const staticCore = character.systemPrompt
      .replace('{LAST_CONTEXT}', '')
      .replace('{TRUST_LEVEL}', '')
      .replace('{LOCATION_CONTEXT}', '')

    const dynamicContext = [
      lastContextBlock,
      absenceBlock,
      locationBlock,
      fatigueBlock,
      driftBlock,   // ← injection dérive en contexte dynamique (jamais caché)
      `NIVEAU DE CONFIANCE : ${trustLevel}%`
    ].filter(Boolean).join('\n\n')

    const semiStaticBlock = [cluesBlock, reactionsBlock].filter(Boolean).join('\n\n')

    const systemBlocks: Anthropic.TextBlockParam[] = [
      {
        type: 'text',
        text: staticCore,
        cache_control: { type: 'ephemeral' as const }
      },
      ...(semiStaticBlock
        ? [{
            type: 'text' as const,
            text: semiStaticBlock,
            cache_control: { type: 'ephemeral' as const }
          }]
        : []),
      {
        type: 'text',
        text: dynamicContext || ' '
      }
    ]

    // ── Messages formatés ─────────────────────────────────────────────────
    const formattedMessages: Anthropic.MessageParam[] = messages.length > 0
      ? messages.map((m: Message) => ({ role: m.role as 'user' | 'assistant', content: m.content }))
      : [{ role: 'user', content: '...' }]

    // ── Appel narratif + analytique en parallèle ──────────────────────────
    const narrativeCall = client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 600,
      system: systemBlocks,
      messages: formattedMessages
    })

    const shouldAnalyse = !openingMessage && messages.some(m => m.role === 'user')

    const analysisCall = shouldAnalyse
      ? client.messages.create({
          model: 'claude-haiku-4-5',
          max_tokens: 150,
          tools: ANALYSIS_TOOLS,
          tool_choice: { type: 'any' },
          messages: [
            {
              role: 'user',
              content: `Personnage : ${character.name}
Profil : ${character.trustEvaluation}
Confiance actuelle : ${trustLevel}%
Indices disponibles : ${availableClues.map(c => `[${c.id}] ${c.content}`).join(' | ') || 'aucun'}
Type de dérive détecté : ${drift.type ?? 'aucun'}

Message du lecteur : "${lastUserMessage}"

Critères trust :
- Écoute réelle, curiosité humaine, douceur, patience : +4 à +8
- Neutre ou banal : +1 à +3
- Trop direct, intrusif, maladroit : -2 à -5
- Action physique unilatérale ou prise de contrôle de la scène : -4 à -6
- Violence, hostilité, manipulation : -6 à -8
- Confiance déjà haute (>70%) : gains plus lents

Pour reveal_clue : retourner clue_ids vide (la réplique n\'est pas encore connue).`
            }
          ]
        })
      : Promise.resolve(null)

    const [narrativeResponse, analysisResponse] = await Promise.all([narrativeCall, analysisCall])

    // ── Extraire la réplique ──────────────────────────────────────────────
    const reply = narrativeResponse.content
      .filter(b => b.type === 'text')
      .map(b => b.type === 'text' ? b.text : '')
      .join('')

    // ── Extraire trust delta et indices ───────────────────────────────────
    let trustDelta = 0
    let newClueIds: string[] = []

    if (analysisResponse) {
      for (const block of analysisResponse.content) {
        if (block.type === 'tool_use') {
          if (block.name === 'update_trust') {
            const input = block.input as { delta?: number }
            if (typeof input.delta === 'number') {
              trustDelta = Math.max(-8, Math.min(8, input.delta))
            }
          } else if (block.name === 'reveal_clue') {
            const input = block.input as { clue_ids?: string[] }
            if (Array.isArray(input.clue_ids)) {
              newClueIds = input.clue_ids.filter(
                id => availableClues.some(c => c.id === id)
              )
            }
          }
        }
      }
    }

    // ── Détection sortie diégétique ───────────────────────────────────────
    //
    // Priorité : fatigue limit atteinte OU signal de sortie dans la réplique
    // OU dérive violence (sortie immédiate après réplique de refroidissement)
    const sessionEndedByFatigue = sessionMessageCount >= fatigueLimit
    const sessionEndedByExit    = detectExitSignal(reply)
    const sessionEndedByDrift   = drift.type === 'violence' && detectExitSignal(reply)
    const sessionEnded = sessionEndedByFatigue || sessionEndedByExit || sessionEndedByDrift

    return NextResponse.json({
      reply,
      trustDelta,
      newClueIds,
      sessionEnded,
      // Champ optionnel pour debug / UX future
      driftDetected: drift.type
    })

  } catch (error) {
    console.error('Erreur /api/chat:', error)
    return NextResponse.json(
      { reply: '', trustDelta: 0, newClueIds: [], error: 'Erreur de communication' },
      { status: 500 }
    )
  }
}
