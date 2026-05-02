export interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

export interface Schedule {
  openHour: number   // heure diégétique (0–23)
  closeHour: number
  closedMessage?: string
}

export interface Character {
  id: string
  name: string
  description: string
  available: boolean
  intro: string
  systemPrompt: string
  trustEvaluation: string
  pronoun?: 'elle' | 'il'
  locationContext?: Record<string, string>
  schedule?: Schedule
  unavailableReason?: string
  sessionMessageLimit?: number
}

export interface Location {
  id: string
  name: string
  description: string
  era: string
  characters: Character[]
  schedule?: Schedule
}

export interface ReaderProgress {
  discoveredClues: string[]
  completedParts: string[]
  isStoryComplete: boolean
  completedAt?: number
}

export interface CoreMemory {
  characterId: string
  content: string
  createdAt: number
  sessionCount: number
}

// ChatRequest — utilisé en interne par anthropic-client.ts (pas de backend)
export interface ChatRequest {
  locationId: string
  characterId: string
  messages: Message[]
  trustLevel: number
  lastContext: string
  openingMessage?: boolean
  discoveredClues: string[]
  mentionedCharacters: string[]
  absenceContext?: string
  currentLocationName?: string
  sessionMessageCount?: number
}

export interface ChatResponse {
  reply: string
  trustDelta: number
  newClueIds: string[]
  sessionEnded?: boolean
  driftDetected?: string | null
}

// Clé stockée dans localStorage — jamais envoyée à un serveur
export const API_KEY_STORAGE_KEY = 'recit_api_key'
