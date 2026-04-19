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
  // Phase 2 — présence multi-lieu
  locationContext?: Record<string, string> // locationId → instruction contextuelle
  // Phase 3 — indisponibilité sémantique
  schedule?: Schedule
  unavailableReason?: string // "Endormi·e" | "En consultation" | …
  // Phase 4 — fatigue diégétique
  sessionMessageLimit?: number // seuil avant sortie gracieuse (défaut : 40)
}

export interface Location {
  id: string
  name: string
  description: string
  era: string
  characters: Character[]
  // Phase 3
  schedule?: Schedule
}

export interface ReaderProgress {
  discoveredClues: string[]
  completedParts: string[]
  // Phase 4 — finitude narrative
  isStoryComplete: boolean
  completedAt?: number // timestamp réel
}

// Phase 4 — mémoire distillée par Haiku
export interface CoreMemory {
  characterId: string
  content: string       // 2–3 phrases subjectives, 1re personne
  createdAt: number     // timestamp réel
  sessionCount: number  // numéro de la session distillée
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
  // Phase 3
  absenceContext?: string
  currentLocationName?: string
  // Phase 4
  sessionMessageCount?: number
}

// Réponse unifiée de /api/chat (Phase 1 — Tool Use)
export interface ChatResponse {
  reply: string
  trustDelta: number
  newClueIds: string[]
  sessionEnded?: boolean // Phase 4 — fatigue diégétique
}
