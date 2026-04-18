import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { getCharacter } from '@/lib/locations'
import { Message } from '@/lib/types'

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
})

export async function POST(request: NextRequest) {
  try {
    const { locationId, characterId, messages, trustLevel, lastContext } = await request.json()

    const character = getCharacter(locationId, characterId)
    if (!character) {
      return NextResponse.json(
        { error: 'Personnage introuvable' },
        { status: 404 }
      )
    }

    const lastContextBlock = lastContext
      ? `DERNIÈRE RENCONTRE (souvenir) :\n${lastContext}\n\nTu peux faire une référence naturelle et subtile à cette dernière fois si c'est pertinent.`
      : ''

    const systemPrompt = character.systemPrompt
      .replace('{TRUST_LEVEL}', trustLevel.toString())
      .replace('{LAST_CONTEXT}', lastContextBlock)

    const formattedMessages = messages.map((m: Message) => ({
      role: m.role,
      content: m.content
    }))

    const response = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 400,
      system: systemPrompt,
      messages: formattedMessages
    })

    const reply = response.content[0].type === 'text'
      ? response.content[0].text
      : ''

    return NextResponse.json({ reply })

  } catch (error) {
    console.error('Erreur API:', error)
    return NextResponse.json(
      { error: 'Erreur de communication' },
      { status: 500 }
    )
  }
}