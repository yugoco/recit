export interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

export interface Schedule {
  openHour: number
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
  trustProfile: string
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
  // Si présent, le lieu n'est visible qu'une fois ce partId dans completedParts
  unlockedByPart?: string
}

export interface ReaderProgress {
  discoveredClues: string[]
  completedParts: string[]
  isStoryComplete: boolean
  completedAt?: number
  // Lieux vus pour la première fois après déverrouillage — badge "nouveau"
  newlyUnlockedLocations?: string[]
}

export interface CoreMemory {
  characterId: string
  content: string
  createdAt: number
  sessionCount: number
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

export const API_KEY_STORAGE_KEY = 'recit_api_key'
