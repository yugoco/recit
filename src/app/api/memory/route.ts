import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { findCharacterGlobally } from '@/lib/locations'

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
})

/**
 * POST /api/memory
 *
 * Appelé en fire-and-forget depuis saveAndLeave().
 * Condense les derniers échanges en une "Core Memory" subjective
 * via claude-haiku — rapide et peu coûteux.
 *
 * Body : { characterId, messages: Message[], sessionCount: number }
 * Response : { coreMemory: string }
 */
export async function POST(request: NextRequest) {
  try {
    const { characterId, messages, sessionCount } = await request.json()

    if (!characterId || !messages?.length) {
      return NextResponse.json({ coreMemory: '' })
    }

    const found = findCharacterGlobally(characterId)
    if (!found) {
      return NextResponse.json({ coreMemory: '' })
    }

    const { character } = found

    // Prendre les 12 derniers échanges pour la distillation
    const recentMessages = messages.slice(-12)
    const transcript = recentMessages
      .map((m: { role: string; content: string }) =>
        `${m.role === 'user' ? 'Lecteur' : character.name} : ${m.content}`
      )
      .join('\n')

    const prompt = `Tu es ${character.name}. Tu viens de vivre une conversation.

TRANSCRIPT :
${transcript}

Condense ce qui s'est passé en 2 à 3 phrases à la première personne, de ton point de vue.
Garde uniquement : l'émotion dominante que tu as ressentie, et les faits ou mots qui t'ont marqué·e.
Oublie ce qui était banal. Sois subjective — c'est ton souvenir, pas un résumé objectif.
Ne mentionne pas le mot "lecteur" — parle de "cette personne" ou "il"/"elle".

Réponds UNIQUEMENT avec les phrases de mémoire, sans introduction ni commentaire.`

    const response = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 200,
      messages: [{ role: 'user', content: prompt }]
    })

    const coreMemory = response.content[0].type === 'text'
      ? response.content[0].text.trim()
      : ''

    return NextResponse.json({
      coreMemory,
      characterId,
      sessionCount,
      createdAt: Date.now()
    })

  } catch (error) {
    console.error('Erreur /api/memory:', error)
    return NextResponse.json({ coreMemory: '' })
  }
}
