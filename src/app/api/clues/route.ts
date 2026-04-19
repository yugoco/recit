import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { getCluesForCharacter } from '@/lib/story'

const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY
})

export async function POST(request: NextRequest) {
    try {
        const { characterId, characterReply, currentTrust, alreadyDiscovered } = await request.json()

        const availableClues = getCluesForCharacter(characterId).filter(clue =>
            currentTrust >= clue.trustRequired &&
            !alreadyDiscovered.includes(clue.id)
        )

        if (availableClues.length === 0) {
            return NextResponse.json({ discoveredClueIds: [] })
        }

        const clueList = availableClues.map(c => `- ID: ${c.id} | Contenu: ${c.content}`).join('\n')

        const prompt = `Tu analyses la réponse d'un personnage dans une conversation narrative.

INDICES POTENTIELLEMENT RÉVÉLABLES (confiance suffisante, pas encore découverts) :
${clueList}

RÉPONSE DU PERSONNAGE :
"${characterReply}"

Un indice est révélé si la réponse du personnage contient clairement l'information décrite dans cet indice — même de façon implicite ou voilée. Un indice n'est PAS révélé si le personnage tourne autour sans vraiment le dire.

Retourne UNIQUEMENT un objet JSON :
{"discoveredClueIds": ["clue-id-1", "clue-id-2"]}

Si aucun indice n'est révélé, retourne :
{"discoveredClueIds": []}`

        const response = await client.messages.create({
            model: 'claude-sonnet-4-5',
            max_tokens: 100,
            messages: [{ role: 'user', content: prompt }]
        })

        const text = response.content[0].type === 'text' ? response.content[0].text : '{}'
        const clean = text.replace(/```json|```/g, '').trim()
        const parsed = JSON.parse(clean)

        return NextResponse.json({ discoveredClueIds: parsed.discoveredClueIds ?? [] })

    } catch (error) {
        console.error('Erreur détection indices:', error)
        return NextResponse.json({ discoveredClueIds: [] })
    }
}