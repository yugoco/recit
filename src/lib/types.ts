export interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

export interface Session {
  id: string
  characterId: string
  messages: Message[]
  createdAt: number
  updatedAt: number
}

export interface Character {
  id: string
  name: string
  description: string
  era: string
  location: string
  systemPrompt: string
  intro: string
  available: boolean
}

export interface TrustState {
  [characterId: string]: number
}

export interface SessionState {
  [characterId: string]: Message[]
}