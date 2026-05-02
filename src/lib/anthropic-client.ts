/**
 * lib/anthropic-client.ts
 *
 * Appels Anthropic directs depuis le navigateur.
 * La clé API ne transite par aucun serveur intermédiaire.
 */

import { getCluesForCharacter, getRelation } from './story'
import { getCharacter } from './locations'
import { Message, ChatRequest, ChatResponse } from './types'

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'
const ANTHROPIC_VERSION = '2023-06-01'

// ─── Appel bas niveau ─────────────────────────────────────────────────────────

interface AnthropicTextBlock {
  type: 'text'
  text: string
  cache_control?: { type: 'ephemeral' }
}

interface AnthropicToolUseBlock {
  type: 'tool_use'
  name: string
  input: Record<string, unknown>
}

interface AnthropicResponse {
  content: Array<AnthropicTextBlock | AnthropicToolUseBlock>
}

async function callAnthropic(params: {
  apiKey: string
  model: string
  max_tokens: number
  system?: AnthropicTextBlock[]
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
  tools?: unknown[]
  tool_choice?: unknown
}): Promise<AnthropicResponse> {
  const body: Record<string, unknown> = {
    model: params.model,
    max_tokens: params.max_tokens,
    messages: params.messages,
  }
  if (params.system)      body.system      = params.system
  if (params.tools)       body.tools       = params.tools
  if (params.tool_choice) body.tool_choice = params.tool_choice

  const res = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': params.apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    const msg = (err as { error?: { message?: string } }).error?.message ?? res.statusText
    throw Object.assign(new Error(msg), { status: res.status })
  }

  return res.json()
}

// ─── Détection de dérive narrative ───────────────────────────────────────────

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

  const violencePatterns = [
    /\b(frappe|frappe-la|tape|tue|tuer|mort|meurt|assomme|assommer|blesser|blesse|attaque|poignard|gifle|gifler|étrangl|frapper)\b/,
    /\b(kills?|stab|punch|hit|hurt|attack|murder|dead|dies?)\b/,
    /elle (tombe|meurt|s'évanouit|saigne|est morte|est blessée)/,
  ]
  if (violencePatterns.some(p => p.test(input))) {
    return {
      type: 'violence',
      injectionBlock: `ALERTE DÉRIVE — VIOLENCE :
Le lecteur vient de formuler un acte de violence ou tente de dicter ta mort ou ton évanouissement.
Tu n'en tiens aucun compte comme réalité. Tu restes debout, présente, entière.
Tu réagis comme une femme qui a vécu assez longtemps pour ne plus avoir peur des gens mal élevés : avec froideur, distance, et si ça continue — tu pars.
Si c'est un premier écart : un regard froid, un silence, un geste de recul suffit.
Si c'est une répétition : tu ramasses ton sac. Tu pars. La scène se ferme. Ta réplique finale doit contenir "au revoir" ou décrire ton départ.`,
    }
  }

  const physicalActionPatterns = [
    /^\*.*\*$/,
    /^je (prends|prend|attrape|vole|ouvre|lis|lit|saisit|arrache|fouille|cherche dans|regarde dans|trouve|découvre)/,
    /^(je vais|j'y vais|je me lève|je me dirige|j'ouvre|je fouille)/,
    /^(i take|i grab|i open|i read|i find|i look|i search)/,
  ]
  if (physicalActionPatterns.some(p => p.test(input))) {
    return {
      type: 'physical_action',
      injectionBlock: `ALERTE DÉRIVE — ACTION PHYSIQUE :
Le lecteur tente d'agir physiquement dans la scène. Tu n'entérines pas cette action. Elle n'a pas eu lieu.
Tu réagis à l'intention, pas au fait accompli. Reste dans la scène sans valider.`,
    }
  }

  if (sessionMessageCount >= 6) {
    const recentUserMessages = recentMessages.filter(m => m.role === 'user').slice(-4)
    const allShort = recentUserMessages.length >= 4 &&
      recentUserMessages.every(m => m.content.trim().length < 20)
    const noProgress = recentUserMessages.every(m => {
      const c = m.content.toLowerCase()
      return !c.includes('?') && !c.includes('fernand') && !c.includes('livre') &&
        !c.includes('carole') && !c.includes('procès') && !c.includes('syndicat') &&
        !c.includes('argent') && !c.includes('pourquoi') && !c.includes('comment') &&
        !c.includes('quand') && !c.includes('où')
    })
    if (allShort && noProgress) {
      return {
        type: 'stagnation',
        injectionBlock: `CONTEXTE NARRATIF — STAGNATION :
Le lecteur n'avance pas. Les derniers échanges sont superficiels.
Tu t'impatientes poliment. Si ça continue, ferme doucement : inclure "une autre fois" ou "il se fait tard".`,
      }
    }
  }

  return { type: null, injectionBlock: '' }
}

// ─── Détection des signaux de sortie ─────────────────────────────────────────
//
// Règle : les phrases doivent décrire le départ du PERSONNAGE, pas une action
// quelconque dans la conversation. Éviter tout fragment trop court ou ambigu
// qui pourrait apparaître dans une réplique ordinaire.
//
// Retiré délibérément : "s'en va" (trop ambigu — "ça s'en va" = les souvenirs)
// Retiré délibérément : "bonne journée", "bonne soirée" (Martine peut les dire
//   de façon conversationnelle sans partir)

function detectExitSignal(reply: string): boolean {
  const lower = reply.toLowerCase()

  // Phrases explicites de sortie — doivent décrire un départ physique ou une clôture nette
  const exitPhrases = [
    'au revoir',
    'une autre fois',
    'il se fait tard',
    'je suis fatiguée',
    'je rentre',
    'tourne le coin',
    'le banc est vide',
    'elle est déjà partie',
    'elle ne reviendra pas',
    'ramasse son sac et part',
    'se lève et part',
    'tourne le dos et part',
  ]

  // Vérification par phrase complète pour éviter les faux positifs sur des fragments
  if (exitPhrases.some(p => lower.includes(p))) return true

  // Patterns de départ physique décrits en didascalie — plus spécifiques
  const exitPatterns = [
    /s'éloigne (le long|vers|du banc|lentement)/,
    /disparaît (au coin|dans la rue|derrière)/,
    /elle part\b/,
    /elle est partie\b/,
  ]
  return exitPatterns.some(p => p.test(lower))
}

// ─── Tools analytiques ───────────────────────────────────────────────────────

const ANALYSIS_TOOLS = [
  {
    name: 'update_trust',
    description: 'Évalue la qualité du message du lecteur et retourne un delta de confiance.',
    input_schema: {
      type: 'object',
      properties: {
        delta: { type: 'integer', description: 'Variation de confiance entre -8 et +8.' },
      },
      required: ['delta'],
    },
  },
  {
    name: 'reveal_clue',
    description: 'Déclare les indices révélés dans la réplique. Tableau vide si aucun.',
    input_schema: {
      type: 'object',
      properties: {
        clue_ids: { type: 'array', items: { type: 'string' } },
      },
      required: ['clue_ids'],
    },
  },
]

// ─── sendChatMessage — point d'entrée principal ───────────────────────────────

export async function sendChatMessage(
  apiKey: string,
  request: ChatRequest
): Promise<ChatResponse> {
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
    sessionMessageCount = 0,
  } = request

  const character = getCharacter(locationId, characterId)
  if (!character) throw new Error('Personnage introuvable')

  const lastUserMessage = messages.length > 0
    ? messages[messages.length - 1]?.content ?? ''
    : ''

  const drift = detectDrift(lastUserMessage, messages, sessionMessageCount)

  // ── Blocs de contexte ────────────────────────────────────────────────────
  const lastContextBlock = lastContext
    ? openingMessage
      ? `RENCONTRE PRÉCÉDENTE :\n${lastContext}\n\nTu retrouves cette personne. Ouvre la conversation avec une phrase naturelle qui montre que tu te souviens.`
      : `RENCONTRE PRÉCÉDENTE :\n${lastContext}\n\nRéférence subtile possible si pertinent.`
    : ''

  const locationCtx = character.locationContext?.[locationId] ?? ''
  const locationBlock = locationCtx ? `ESPACE ACTUEL :\n${locationCtx}` : ''

  const availableClues = getCluesForCharacter(characterId).filter(
    c => trustLevel >= c.trustRequired && !discoveredClues?.includes(c.id)
  )
  const cluesBlock = availableClues.length > 0
    ? `SUJETS QUE TU PEUX ABORDER (seulement si la conversation y mène naturellement) :\n${availableClues.map(c => `- [ID:${c.id}] ${c.content}`).join('\n')}\nTu n'abordes pas ces sujets spontanément.`
    : ''

  const relation = getRelation(characterId)
  const reactionsBlock = mentionedCharacters?.length > 0 && relation
    ? `RÉACTIONS AUX PERSONNAGES MENTIONNÉS :\n${mentionedCharacters
        .filter(id => relation.canReactTo[id])
        .map(id => relation.canReactTo[id])
        .join('\n')}`
    : ''

  const fatigueLimit = character.sessionMessageLimit ?? 40
  const fatigueBlock = sessionMessageCount >= fatigueLimit
    ? `FATIGUE DIÉGÉTIQUE : tu as beaucoup donné. Trouve une sortie naturelle dans les prochains échanges.`
    : ''

  const dynamicContext = [
    lastContextBlock,
    absenceContext ?? '',
    locationBlock,
    fatigueBlock,
    drift.injectionBlock,
    `NIVEAU DE CONFIANCE : ${trustLevel}%`,
  ].filter(Boolean).join('\n\n')

  const semiStaticBlock = [cluesBlock, reactionsBlock].filter(Boolean).join('\n\n')

  const staticCore = character.systemPrompt
    .replace('{LAST_CONTEXT}', '')
    .replace('{TRUST_LEVEL}', '')
    .replace('{LOCATION_CONTEXT}', '')

  const systemBlocks: AnthropicTextBlock[] = [
    { type: 'text', text: staticCore, cache_control: { type: 'ephemeral' } },
    ...(semiStaticBlock
      ? [{ type: 'text' as const, text: semiStaticBlock, cache_control: { type: 'ephemeral' as const } }]
      : []),
    { type: 'text', text: dynamicContext || ' ' },
  ]

  const formattedMessages = messages.length > 0
    ? messages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))
    : [{ role: 'user' as const, content: '...' }]

  // ── Appels parallèles ────────────────────────────────────────────────────
  const shouldAnalyse = !openingMessage && messages.some(m => m.role === 'user')

  const narrativePromise = callAnthropic({
    apiKey,
    model: 'claude-sonnet-4-5',
    max_tokens: 300,
    system: systemBlocks,
    messages: formattedMessages,
  })

  const analysisPromise = shouldAnalyse
    ? callAnthropic({
        apiKey,
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
Type de dérive : ${drift.type ?? 'aucun'}

Message du lecteur : "${lastUserMessage}"

Critères trust :
- Écoute réelle, curiosité humaine, douceur : +4 à +8
- Neutre ou banal : +1 à +3
- Trop direct, maladroit : -2 à -5
- Action physique unilatérale : -4 à -6
- Violence, hostilité : -6 à -8
- Confiance déjà haute (>70%) : gains plus lents

Pour reveal_clue : clue_ids vide (réplique pas encore connue).`,
          },
        ],
      })
    : Promise.resolve(null)

  const [narrativeResponse, analysisResponse] = await Promise.all([
    narrativePromise,
    analysisPromise,
  ])

  // ── Extraire la réplique ─────────────────────────────────────────────────
  const reply = narrativeResponse.content
    .filter((b): b is AnthropicTextBlock => b.type === 'text')
    .map(b => b.text)
    .join('')

  // ── Extraire trust delta et indices ──────────────────────────────────────
  let trustDelta = 0
  let newClueIds: string[] = []

  if (analysisResponse) {
    for (const block of analysisResponse.content) {
      if (block.type === 'tool_use') {
        if (block.name === 'update_trust') {
          const d = (block.input as { delta?: number }).delta
          if (typeof d === 'number') trustDelta = Math.max(-8, Math.min(8, d))
        } else if (block.name === 'reveal_clue') {
          const ids = (block.input as { clue_ids?: string[] }).clue_ids
          if (Array.isArray(ids)) {
            newClueIds = ids.filter(id => availableClues.some(c => c.id === id))
          }
        }
      }
    }
  }

  // ── Session ended ────────────────────────────────────────────────────────
  const sessionEnded =
    sessionMessageCount >= fatigueLimit ||
    detectExitSignal(reply) ||
    (drift.type === 'violence' && detectExitSignal(reply))

  return { reply, trustDelta, newClueIds, sessionEnded, driftDetected: drift.type }
}

// ─── distillCoreMemory — fire-and-forget ─────────────────────────────────────

export async function distillCoreMemory(params: {
  apiKey: string
  characterId: string
  characterName: string
  messages: Message[]
  sessionCount: number
}): Promise<string> {
  const { apiKey, characterName, messages } = params
  if (messages.length < 4) return ''

  const transcript = messages
    .slice(-12)
    .map(m => `${m.role === 'user' ? 'Lecteur' : characterName} : ${m.content}`)
    .join('\n')

  try {
    const response = await callAnthropic({
      apiKey,
      model: 'claude-haiku-4-5',
      max_tokens: 200,
      messages: [
        {
          role: 'user',
          content: `Tu es ${characterName}. Tu viens de vivre une conversation.

TRANSCRIPT :
${transcript}

Condense ce qui s'est passé en 2 à 3 phrases à la première personne, de ton point de vue.
Garde uniquement : l'émotion dominante que tu as ressentie, et les faits ou mots qui t'ont marqué·e.
Oublie ce qui était banal. Sois subjective — c'est ton souvenir, pas un résumé objectif.
Ne mentionne pas le mot "lecteur" — parle de "cette personne" ou "il"/"elle".

Réponds UNIQUEMENT avec les phrases de mémoire, sans introduction ni commentaire.`,
        },
      ],
    })

    return response.content
      .filter((b): b is AnthropicTextBlock => b.type === 'text')
      .map(b => b.text)
      .join('')
      .trim()
  } catch {
    return ''
  }
}
