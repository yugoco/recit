import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { getCharacter } from '@/lib/locations'
import { getCluesForCharacter, getRelation } from '@/lib/story'
import { Message, ChatRequest } from '@/lib/types'

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
})

export async function POST(request: NextRequest) {
  try {
    const {
      locationId,
      characterId,
      messages,
      trustLevel,
      lastContext,
      openingMessage,
      discoveredClues,
      mentionedCharacters
    }: ChatRequest = await request.json()

    const character = getCharacter(locationId, characterId)
    if (!character) {
      return NextResponse.json({ error: 'Personnage introuvable' }, { status: 404 })
    }

    // Bloc contexte dernière rencontre
    const lastContextBlock = lastContext
      ? openingMessage
        ? `RENCONTRE PRÉCÉDENTE :\n${lastContext}\n\nTu retrouves cette personne. Ouvre la conversation avec une phrase naturelle qui montre que tu te souviens de la dernière fois — sans expliquer, sans résumer, juste un détail, une remarque, un regard. Comme si le temps s'était écoulé.`
        : `RENCONTRE PRÉCÉDENTE :\n${lastContext}\n\nTu peux faire une référence naturelle et subtile à la dernière fois si c'est pertinent.`
      : ''

    // Indices déverrouillés par la confiance — le personnage PEUT en parler si le sujet vient
    const availableClues = getCluesForCharacter(characterId).filter(clue =>
      trustLevel >= clue.trustRequired &&
      !discoveredClues?.includes(clue.id)
    )

    const cluesBlock = availableClues.length > 0
      ? `SUJETS QUE TU PEUX ABORDER (seulement si la conversation y mène naturellement) :
${availableClues.map(c => `- ${c.content}`).join('\n')}
Tu n'abordes pas ces sujets spontanément. Mais si le lecteur dirige la conversation dans cette direction, tu peux t'ouvrir.`
      : ''

    // Relations avec autres personnages mentionnés par le lecteur
    const relation = getRelation(characterId)
    const reactionsBlock = mentionedCharacters?.length > 0 && relation
      ? `RÉACTIONS AUX AUTRES PERSONNAGES MENTIONNÉS :
${mentionedCharacters
  .filter((id: string) => relation.canReactTo[id])
  .map((id: string) => relation.canReactTo[id])
  .join('\n')}`
      : ''

    const systemPrompt = character.systemPrompt
      .replace('{TRUST_LEVEL}', trustLevel.toString())
      .replace('{LAST_CONTEXT}', lastContextBlock)
      + (cluesBlock ? `\n\n${cluesBlock}` : '')
      + (reactionsBlock ? `\n\n${reactionsBlock}` : '')

    const formattedMessages: { role: 'user' | 'assistant'; content: string }[] = messages.length > 0
      ? messages.map((m: Message) => ({ role: m.role as 'user' | 'assistant', content: m.content }))
      : [{ role: 'user', content: '...' }]

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
    return NextResponse.json({ error: 'Erreur de communication' }, { status: 500 })
  }
}