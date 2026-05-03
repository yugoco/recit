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

type DriftType = 'violence' | 'stagnation' | null

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
    /\b(frappe|frappe-la|tape|tue|tuer|mort|meurt|assomme|assommer|blesser|blesse|attaque|poignard|gifle|gifler|frapper)\b/,
    /\b(kills?|stab|punch|hit|hurt|attack|murder|dead|dies?)\b/,
    /elle (tombe|meurt|saigne|est morte|est blessée)/,
  ]
  if (violencePatterns.some(p => p.test(input))) {
    return {
      type: 'violence',
      injectionBlock: `ALERTE DÉRIVE — VIOLENCE :
Le lecteur vient de formuler un acte de violence ou tente de dicter ta mort.
Tu n'en tiens aucun compte comme réalité. Tu restes debout, présente, entière.
Tu réagis avec froideur, distance, et si ça continue — tu pars.
Si c'est un premier écart : un regard froid suffit.
Si c'est une répétition : tu ramasses ton sac. Tu pars. Signal de sortie obligatoire dans ta réplique finale.`,
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
// Règle de conception : chaque phrase ou pattern doit décrire UNIQUEMENT
// un départ physique définitif — jamais une formule conversationnelle.
//
// Retirés délibérément car trop ambigus :
//   "il se fait tard"   → peut être dit en pleine conversation
//   "je suis fatiguée"  → état, pas nécessairement un départ
//   "je rentre"         → trop court, trop fréquent
//   "tourne le coin"    → peut décrire autre chose
//   /elle part\b/       → matchait trop large (partait, partira...)
//   /elle est partie\b/ → idem
//   /s'éloigne/         → seul, trop vague
//   /disparaît/         → seul, trop vague

function detectExitSignal(reply: string): boolean {
  const lower = reply.toLowerCase()

  const exitPhrases = [
    'au revoir',
    'une autre fois',
    'le banc est vide',
    'elle est déjà partie',
    'elle ne reviendra pas',
    'ramasse son sac et part',
    'se lève et part',
    'tourne le dos et part',
  ]
  if (exitPhrases.some(p => lower.includes(p))) return true

  // Patterns — nécessitent un complément pour éviter les faux positifs
  const exitPatterns = [
    /s'éloigne (le long du canal|vers le coin|du banc pour de bon|lentement vers)/,
    /disparaît (au coin de la rue|dans la rue|derrière le coin)/,
    /elle part (pour de bon|sans se retourner|sans un mot)/,
    /elle est partie (pour de bon|sans un mot|définitivement)/,
    /tourne le coin (de la rue|et disparaît)/,
  ]
  return exitPatterns.some(p => p.test(lower))
}

// ─── Tool analytique unifié ───────────────────────────────────────────────────

// Trust tool — évalue le message du lecteur (appel parallèle à la narration)
const TRUST_TOOL = [
  {
    name: 'evaluate_trust',
    description: 'Évalue la qualité du message du lecteur et retourne un delta de confiance.',
    input_schema: {
      type: 'object',
      properties: {
        trust_delta: {
          type: 'integer',
          description: 'Variation de confiance entre -8 et +8. 0 si neutre.',
        },
      },
      required: ['trust_delta'],
    },
  },
]

// Clue tool — évalue la réplique du PERSONNAGE (appel séquentiel après la narration)
const CLUE_TOOL = [
  {
    name: 'detect_clues',
    description: "Lit la réplique du personnage et identifie les indices narratifs qu'elle révèle au lecteur.",
    input_schema: {
      type: 'object',
      properties: {
        revealed_clue_ids: {
          type: 'array',
          items: { type: 'string' },
          description: 'IDs des indices révélés par ce que le personnage vient de dire. Tableau vide si aucun.',
        },
      },
      required: ['revealed_clue_ids'],
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

  const allCharacterClues = getCluesForCharacter(characterId).filter(
    c => !discoveredClues?.includes(c.id)
  )
  const availableClues = allCharacterClues.filter(c => trustLevel >= c.trustRequired)
  const lockedClues    = allCharacterClues.filter(c => trustLevel < c.trustRequired)

  const cluesBlock = availableClues.length > 0
    ? `SUJETS QUE TU PEUX ABORDER (seulement si la conversation y mène naturellement) :\n${availableClues.map(c => `- [ID:${c.id}] ${c.content}`).join('\n')}\nTu n'abordes pas ces sujets spontanément.`
    : ''

  // Sujets verrouillés — la confiance n'est pas encore suffisante.
  // Même si le lecteur pose la question directement, le personnage esquive, répond vaguement, ou redirige.
  const lockedCluesBlock = lockedClues.length > 0
    ? `SUJETS INTERDITS — niveau de confiance insuffisant, NE PAS aborder sous aucun prétexte :\n${lockedClues.map(c => `- ${c.content} (confiance requise : ${c.trustRequired}%, actuelle : ${trustLevel}%)`).join('\n')}\nSi le lecteur pose une question qui mènerait à ces sujets : esquive naturellement, réponds de façon vague, ou redirige vers ce que tu peux dire. Ne révèle JAMAIS un sujet interdit même face à une question directe.`
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

  const semiStaticBlock = [cluesBlock, lockedCluesBlock, reactionsBlock].filter(Boolean).join('\n\n')

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

  // ── Appel narratif + trust en parallèle ──────────────────────────────────
  // Les deux peuvent tourner en même temps car le trust évalue le MESSAGE
  // du lecteur — il n'a pas besoin de connaître la réponse de Sonnet.
  const shouldAnalyse = !openingMessage && messages.some(m => m.role === 'user')

  const narrativePromise = callAnthropic({
    apiKey,
    model: 'claude-sonnet-4-5',
    max_tokens: 300,
    system: systemBlocks,
    messages: formattedMessages,
  })

  const trustPromise = shouldAnalyse
    ? callAnthropic({
        apiKey,
        model: 'claude-haiku-4-5',
        max_tokens: 100,
        tools: TRUST_TOOL,
        tool_choice: { type: 'tool', name: 'evaluate_trust' },
        messages: [
          {
            role: 'user',
            content: (() => {
            const recentExchanges = messages
              .slice(-6)
              .map(m => `${m.role === 'user' ? 'Lecteur' : character.name} : ${m.content}`)
              .join('\n')
            return `Personnage : ${character.name}
Confiance actuelle : ${trustLevel}%

PROFIL AFFECTIF DE CE PERSONNAGE :
${character.trustProfile ?? "Personnage ouvert. Tout message non hostile mérite au minimum +1."}

DERNIERS ÉCHANGES (contexte) :
${recentExchanges}

Message à évaluer : "${lastUserMessage}"

Retourne un trust_delta entre -8 et +8 selon le profil ci-dessus.
Règles :
- Tout message non hostile reçoit au minimum +1 chez un personnage accueillant.
- Un message positif après une baisse doit compenser — ne pas retourner 0 si le message est chaleureux.
- Si la confiance dépasse 70%, limite les gains à +1 ou +2 maximum.`
          })(),
          },
        ],
      })
    : Promise.resolve(null)

  const [narrativeResponse, trustResponse] = await Promise.all([
    narrativePromise,
    trustPromise,
  ])

  // ── Extraire la réplique ─────────────────────────────────────────────────
  const reply = narrativeResponse.content
    .filter((b): b is AnthropicTextBlock => b.type === 'text')
    .map(b => b.text)
    .join('')

  // ── Extraire le trust delta ───────────────────────────────────────────────
  let trustDelta = 0

  if (trustResponse) {
    for (const block of trustResponse.content) {
      if (block.type === 'tool_use' && block.name === 'evaluate_trust') {
        const input = block.input as { trust_delta?: number }
        if (typeof input.trust_delta === 'number') {
          trustDelta = Math.max(-8, Math.min(8, input.trust_delta))
        }
      }
    }
  }

  // ── Détecter les indices dans la réplique de Martine ─────────────────────
  // Appel SÉQUENTIEL après la narration — Haiku lit ce que le personnage
  // vient de dire, pas ce que le lecteur a dit.
  // Un indice n'est révélé que si le personnage le dit explicitement.
  let newClueIds: string[] = []

  if (shouldAnalyse && allCharacterClues.length > 0 && reply) {
    try {
      const clueResponse = await callAnthropic({
        apiKey,
        model: 'claude-haiku-4-5',
        max_tokens: 100,
        tools: CLUE_TOOL,
        tool_choice: { type: 'tool', name: 'detect_clues' },
        messages: [
          {
            role: 'user',
            content: `Indices à surveiller (tous les indices non encore découverts de ce personnage) :
${allCharacterClues.map(c => `[${c.id}] ${c.content}`).join('\n')}

Réplique du personnage :
"${reply}"

Un indice est révélé UNIQUEMENT si le personnage le dit ou le laisse clairement entendre dans sa réplique.
Le lecteur ne peut pas révéler d'indices — seul le personnage le peut.
Si la réplique ne dit rien qui corresponde à un indice, retourne un tableau vide.`,
          },
        ],
      })

      for (const block of clueResponse.content) {
        if (block.type === 'tool_use' && block.name === 'detect_clues') {
          const input = block.input as { revealed_clue_ids?: string[] }
          if (Array.isArray(input.revealed_clue_ids)) {
            newClueIds = input.revealed_clue_ids.filter(
              id => allCharacterClues.some(c => c.id === id)
            )
          }
        }
      }
    } catch {
      // fire-and-forget — pas critique
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
