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
  pronoun?: 'elle' | 'il'  // défaut : 'elle'
}

export interface Location {
  id: string
  name: string
  description: string
  era: string
  characters: Character[]
}

export interface ReaderProgress {
  discoveredClues: string[]   // indices trouvés par le lecteur
  completedParts: string[]    // parties débloquées
}

export interface ChatRequest {
  locationId: string
  characterId: string
  messages: Message[]
  trustLevel: number
  lastContext: string
  openingMessage?: boolean
  discoveredClues: string[]
  mentionedCharacters: string[]
}
