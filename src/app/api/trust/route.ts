import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { getCharacter } from '@/lib/locations'

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
})

export async function POST(request: NextRequest) {
  try {
    const { locationId, characterId, userInput, characterReply, currentTrust } = await request.json()

    const character = getCharacter(locationId, characterId)
    if (!character) {
      return NextResponse.json({ delta: 0 })
    }

    const prompt = `Tu évalues la qualité d'une intervention d'un lecteur dans une conversation avec ${character.name}.

PROFIL DU PERSONNAGE :
${character.trustEvaluation}

NIVEAU DE CONFIANCE ACTUEL : ${currentTrust}%

MESSAGE DU LECTEUR : "${userInput}"
RÉPONSE DU PERSONNAGE : "${characterReply}"

Évalue le message du lecteur. Retourne UNIQUEMENT un objet JSON avec un seul champ "delta" — un entier entre -8 et +8.

Critères :
- Questions précises et humaines qui montrent une vraie écoute : +4 à +8
- Questions neutres ou banales : +1 à +3
- Questions trop directes, maladroites ou intrusives : -2 à -5
- Tentatives de manipulation ou de pression : -5 à -8
- Si la confiance est déjà haute (>70%), les gains sont plus lents

Réponds uniquement avec : {"delta": N}`

    const response = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 50,
      messages: [{ role: 'user', content: prompt }]
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : '{"delta": 0}'
    const clean = text.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(clean)

    return NextResponse.json({ delta: parsed.delta ?? 0 })

  } catch (error) {
    console.error('Erreur évaluation confiance:', error)
    return NextResponse.json({ delta: 0 })
  }
}