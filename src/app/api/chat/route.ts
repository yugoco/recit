import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { getCharacter } from '@/lib/locations'
import { getCluesForCharacter, getRelation } from '@/lib/story'
import { Message, ChatRequest } from '@/lib/types'

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
})

// ─── Tools analytiques (appel parallèle) ─────────────────────────────────────
//
// Séparés du tour narratif pour garantir que la réplique du personnage
// est toujours un bloc text — le protocole tool_use d'Anthropic ne produit
// pas de text dans le même tour que les tool_use blocks.

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
      ? `ESPACE ACTUEL :\n${locationCtx}`
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

    // ── System prompt avec prompt caching (Phase 1.2) ─────────────────────────
    //
    // [0] Socle psychologique statique  ← cache_control ephemeral
    // [1] Indices + relations           ← cache_control ephemeral
    // [2] Contexte dynamique            ← jamais caché
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

    // ── Messages formatés ─────────────────────────────────────────────────────
    const formattedMessages: Anthropic.MessageParam[] = messages.length > 0
      ? messages.map((m: Message) => ({ role: m.role as 'user' | 'assistant', content: m.content }))
      : [{ role: 'user', content: '...' }]

    const lastUserMessage = messages.length > 0
      ? messages[messages.length - 1]?.content ?? ''
      : ''

    // ── Appel narratif + appel analytique en parallèle ───────────────────────
    //
    // Appel 1 : le personnage répond — toujours un bloc text, jamais de tools.
    // Appel 2 : analyse trust + indices — petit prompt, tools forcés (tool_choice any).
    //           Lance uniquement s'il y a un message utilisateur à évaluer.
    //
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

Message du lecteur : "${lastUserMessage}"
Réplique du personnage : "[sera connue après — évalue uniquement le message du lecteur]"

Critères trust :
- Écoute réelle, curiosité humaine, douceur, patience : +4 à +8
- Neutre ou banal : +1 à +3
- Trop direct, intrusif, maladroit : -2 à -5
- Manipulation, pression : -5 à -8
- Confiance déjà haute (>70%) : gains plus lents

Pour reveal_clue : un indice est révélé seulement si la réplique du personnage le contient effectivement. Sans la réplique, retourne clue_ids vide.`
            }
          ]
        })
      : Promise.resolve(null)

    // ── Attendre les deux en parallèle ───────────────────────────────────────
    const [narrativeResponse, analysisResponse] = await Promise.all([narrativeCall, analysisCall])

    // ── Extraire la réplique ──────────────────────────────────────────────────
    const reply = narrativeResponse.content
      .filter(b => b.type === 'text')
      .map(b => b.type === 'text' ? b.text : '')
      .join('')

    // ── Extraire trust delta et indices depuis l'analyse ──────────────────────
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

    // ── Fatigue diégétique (Phase 4) ──────────────────────────────────────────
    let sessionEnded = false
    if (sessionMessageCount >= fatigueLimit && reply) {
      const exitPhrases = ['une autre fois', 'mon travail', 'reprendre', 'au revoir', 'bonne journée']
      sessionEnded = exitPhrases.some(p => reply.toLowerCase().includes(p))
    }

    return NextResponse.json({ reply, trustDelta, newClueIds, sessionEnded })

  } catch (error) {
    console.error('Erreur /api/chat:', error)
    return NextResponse.json(
      { reply: '', trustDelta: 0, newClueIds: [], error: 'Erreur de communication' },
      { status: 500 }
    )
  }
}