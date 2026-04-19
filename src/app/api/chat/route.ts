import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { getCharacter } from '@/lib/locations'
import { getCluesForCharacter, getRelation } from '@/lib/story'
import { Message, ChatRequest } from '@/lib/types'

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
})

// ─── Tools (Phase 1 — unification) ───────────────────────────────────────────

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'update_trust',
    description: `Évalue la qualité de l'intervention du lecteur et retourne un delta de confiance.
Appelle cet outil UNE FOIS par réponse, après avoir formulé ta réplique.
Le delta reflète la qualité de présence, d'écoute et d'empathie du lecteur — pas sa curiosité brute.`,
    input_schema: {
      type: 'object' as const,
      properties: {
        delta: {
          type: 'integer',
          description: 'Variation de confiance entre -8 et +8. 0 si neutre.'
        },
        reason: {
          type: 'string',
          description: 'Justification interne (2-5 mots, usage debug uniquement)'
        }
      },
      required: ['delta']
    }
  },
  {
    name: 'reveal_clue',
    description: `Déclare les indices narratifs révélés dans ta réponse.
N'appelle cet outil QUE si ta réplique contient effectivement l'information décrite dans l'indice — même de façon voilée.
Ne révèle jamais un indice que tu n'as pas réellement exprimé.`,
    input_schema: {
      type: 'object' as const,
      properties: {
        clue_ids: {
          type: 'array',
          items: { type: 'string' },
          description: "IDs des indices révélés dans cette réponse. Tableau vide si aucun."
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
      currentLocationName,
      sessionMessageCount = 0
    } = body

    const character = getCharacter(locationId, characterId)
    if (!character) {
      return NextResponse.json({ reply: '', trustDelta: 0, newClueIds: [], error: 'Personnage introuvable' }, { status: 404 })
    }

    // ── Bloc contexte dernière rencontre ──────────────────────────────────────
    const lastContextBlock = lastContext
      ? openingMessage
        ? `RENCONTRE PRÉCÉDENTE :\n${lastContext}\n\nTu retrouves cette personne. Ouvre la conversation avec une phrase naturelle qui montre que tu te souviens — un détail, une remarque, un regard. Comme si le temps s'était écoulé.`
        : `RENCONTRE PRÉCÉDENTE :\n${lastContext}\n\nTu peux faire une référence naturelle et subtile à la dernière fois si c'est pertinent.`
      : ''

    // ── Contexte d'absence (Phase 3) ──────────────────────────────────────────
    const absenceBlock = absenceContext ?? ''

    // ── Contexte du lieu courant (Phase 2) ────────────────────────────────────
    const locationCtx = character.locationContext?.[locationId] ?? ''
    const locationBlock = locationCtx
      ? `ESPACE ACTUEL (${currentLocationName ?? locationId}) :\n${locationCtx}`
      : ''

    // ── Indices déverrouillés ─────────────────────────────────────────────────
    const availableClues = getCluesForCharacter(characterId).filter(clue =>
      trustLevel >= clue.trustRequired &&
      !discoveredClues?.includes(clue.id)
    )
    const cluesBlock = availableClues.length > 0
      ? `SUJETS QUE TU PEUX ABORDER (seulement si la conversation y mène naturellement) :\n${availableClues.map(c => `- [ID:${c.id}] ${c.content}`).join('\n')}\nTu n'abordes pas ces sujets spontanément. Si le lecteur y dirige la conversation, tu peux t'ouvrir.`
      : ''

    // ── Relations inter-personnages ───────────────────────────────────────────
    const relation = getRelation(characterId)
    const reactionsBlock = mentionedCharacters?.length > 0 && relation
      ? `RÉACTIONS AUX PERSONNAGES MENTIONNÉS :\n${mentionedCharacters
          .filter((id: string) => relation.canReactTo[id])
          .map((id: string) => relation.canReactTo[id])
          .join('\n')}`
      : ''

    // ── Fatigue diégétique (Phase 4) ──────────────────────────────────────────
    const fatigueLimit = character.sessionMessageLimit ?? 40
    const fatigueBlock = sessionMessageCount >= fatigueLimit
      ? `FATIGUE : tu as répondu de nombreuses fois lors de cette session. Si la conversation piétine, prends naturellement congé.`
      : ''

    // ── Construction du system prompt avec prompt caching (Phase 1.2) ─────────
    //
    // Structure en 3 blocs :
    //   [0] Socle psychologique statique ← cache_control ephemeral (lourd, ne change pas)
    //   [1] Indices + relations          ← cache_control ephemeral (change peu)
    //   [2] Contexte dynamique           ← jamais caché (trust, absence, fatigue…)
    //
    const staticCore = character.systemPrompt
      .replace('{LAST_CONTEXT}', '')
      .replace('{TRUST_LEVEL}', '')
      .replace('{LOCATION_CONTEXT}', '')

    const dynamicContext = [
      lastContextBlock,
      absenceBlock,
      locationBlock,
      fatigueBlock,
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

    // ── Messages ──────────────────────────────────────────────────────────────
    const formattedMessages: Anthropic.MessageParam[] = messages.length > 0
      ? messages.map((m: Message) => ({ role: m.role as 'user' | 'assistant', content: m.content }))
      : [{ role: 'user', content: '...' }]

    // ── Appel API unifié ──────────────────────────────────────────────────────
    const response = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 600,
      system: systemBlocks,
      tools: TOOLS,
      tool_choice: { type: 'auto' },
      messages: formattedMessages,
      // Active le prompt caching beta
      betas: ['prompt-caching-2024-07-31']
    } as Anthropic.MessageCreateParamsNonStreaming)

    // ── Extraction des résultats ──────────────────────────────────────────────
    let reply       = ''
    let trustDelta  = 0
    let newClueIds: string[] = []
    let sessionEnded = false

    for (const block of response.content) {
      if (block.type === 'text') {
        reply = block.text
      } else if (block.type === 'tool_use') {
        if (block.name === 'update_trust') {
          const input = block.input as { delta?: number }
          if (typeof input.delta === 'number') {
            trustDelta = Math.max(-8, Math.min(8, input.delta))
          }
        } else if (block.name === 'reveal_clue') {
          const input = block.input as { clue_ids?: string[] }
          if (Array.isArray(input.clue_ids)) {
            // Valider que les IDs existent et ne sont pas déjà découverts
            newClueIds = input.clue_ids.filter(
              id => availableClues.some(c => c.id === id)
            )
          }
        }
      }
    }

    // Détecter si le personnage a mis fin à la session (fatigue diégétique)
    if (sessionMessageCount >= fatigueLimit && reply) {
      const exitPhrases = ['une autre fois', 'mon travail', 'reprendre', 'au revoir', 'bonne journée']
      sessionEnded = exitPhrases.some(p => reply.toLowerCase().includes(p))
    }

    return NextResponse.json({ reply, trustDelta, newClueIds, sessionEnded })

  } catch (error) {
    console.error('Erreur /api/chat:', error)
    return NextResponse.json({ reply: '', trustDelta: 0, newClueIds: [], error: 'Erreur de communication' }, { status: 500 })
  }
}
