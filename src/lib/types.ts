export interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

export interface Character {
  id: string
  name: string
  description: string
  available: boolean
  intro: string
  systemPrompt: string
  trustEvaluation: string
}

export interface Location {
  id: string
  name: string
  description: string
  era: string
  characters: Character[]
}