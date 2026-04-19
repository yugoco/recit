'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { getCharacter } from '@/lib/locations'
import { getRelation, story, detectMentionedCharacters, computeNewlyUnlockedParts, checkStoryComplete } from '@/lib/story'
import { Message, ReaderProgress, ChatRequest, ChatResponse } from '@/lib/types'
import {
  initDiegeticTime,
  getAbsenceContext,
  markLastSeen,
  migrateStorageKeys,
  storageKeys,
  getDiegeticNow,
  isWithinSchedule,
  formatDiegeticDate
} from '@/lib/time'
import MessageBubble from '@/components/MessageBubble'
import TrustBar from '@/components/TrustBar'

// ─── Helpers localStorage ─────────────────────────────────────────────────────

function loadProgress(): ReaderProgress {
  try {
    const saved = localStorage.getItem(storageKeys.progress())
    return saved
      ? JSON.parse(saved)
      : { discoveredClues: [], completedParts: [], isStoryComplete: false }
  } catch {
    return { discoveredClues: [], completedParts: [], isStoryComplete: false }
  }
}

function saveProgress(progress: ReaderProgress) {
  localStorage.setItem(storageKeys.progress(), JSON.stringify(progress))
}

// ─── Distillation Core Memory (Phase 4 — fire-and-forget) ────────────────────

async function distillCoreMemory(
  characterId: string,
  messages: Message[],
  sessionCount: number
): Promise<void> {
  if (messages.length < 4) return // pas assez de matière à distiller
  try {
    const res = await fetch('/api/memory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ characterId, messages, sessionCount })
    })
    const data = await res.json()
    if (data.coreMemory) {
      localStorage.setItem(storageKeys.coreMemory(characterId), JSON.stringify({
        content: data.coreMemory,
        characterId,
        createdAt: data.createdAt ?? Date.now(),
        sessionCount: data.sessionCount ?? sessionCount
      }))
      // La Core Memory remplace l'historique brut
      localStorage.setItem(storageKeys.context(characterId), data.coreMemory)
    }
  } catch {
    // Silencieux — c'est du fire-and-forget
  }
}

// ─── Sauvegarde de fin de session ─────────────────────────────────────────────

function saveSession(
  locationId: string,
  characterId: string,
  messages: Message[],
  characterName: string
) {
  if (messages.length === 0) return

  const key = storageKeys.encounters(characterId)
  const previous = parseInt(localStorage.getItem(key) ?? '0')
  localStorage.setItem(key, (previous + 1).toString())

  // Sauvegarder contexte brut des 8 derniers messages (sera écrasé par Core Memory async)
  const summary = messages
    .slice(-8)
    .map(m => `${m.role === 'user' ? 'Lecteur' : characterName}: ${m.content}`)
    .join('\n')
  localStorage.setItem(storageKeys.context(characterId), summary)

  // Enregistrer timestamp pour contexte d'absence (Phase 3)
  markLastSeen(characterId)

  // Sauvegarder trust
  // (déjà fait en temps réel dans evaluateTrust — pas besoin de répéter)
}

// ─── Labels UI ────────────────────────────────────────────────────────────────

function relationLabel(completedEncounters: number, trust: number, pronoun: 'elle' | 'il'): string {
  const p = pronoun === 'elle' ? 'Elle' : 'Il'
  if (completedEncounters === 0) return 'Première visite'
  if (completedEncounters === 1 && trust < 40) return `${p} se souvient de vous`
  if (completedEncounters <= 3 && trust < 65)  return `${p} commence à vous reconnaître`
  if (trust >= 65) return `${p} vous fait confiance`
  return `${p} se souvient de vous`
}

function visitLabel(completedEncounters: number): string {
  if (completedEncounters === 0) return 'première visite'
  return `visite ${completedEncounters + 1}`
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function ConversationPage() {
  const params      = useParams()
  const router      = useRouter()
  const locationId  = params.locationId as string
  const characterId = params.characterId as string
  const character   = getCharacter(locationId, characterId)

  const [messages,            setMessages]            = useState<Message[]>([])
  const [trust,               setTrust]               = useState(10)
  const [input,               setInput]               = useState('')
  const [isLoading,           setIsLoading]           = useState(false)
  const [completedEncounters, setCompletedEncounters] = useState(0)
  const [progress,            setProgress]            = useState<ReaderProgress>({ discoveredClues: [], completedParts: [], isStoryComplete: false })
  const [newClueFound,        setNewClueFound]        = useState<string | null>(null)
  const [sessionEnded,        setSessionEnded]        = useState(false)
  const [sessionMsgCount,     setSessionMsgCount]     = useState(0)
  // Phase 3 — heure diégétique (affiché en header)
  const [diegeticTime,        setDiegeticTime]        = useState('')

  const messagesEndRef    = useRef<HTMLDivElement>(null)
  const textareaRef       = useRef<HTMLTextAreaElement>(null)
  const hasInitialized    = useRef(false)
  const hasSavedSession   = useRef(false)
  const lastContextRef    = useRef<string>('')
  const messagesRef       = useRef<Message[]>([])
  const trustRef          = useRef(10)
  const progressRef       = useRef<ReaderProgress>({ discoveredClues: [], completedParts: [], isStoryComplete: false })
  const sessionMsgRef     = useRef(0)
  const characterRef      = useRef(character)

  useEffect(() => { messagesRef.current  = messages  }, [messages])
  useEffect(() => { trustRef.current     = trust     }, [trust])
  useEffect(() => { progressRef.current  = progress  }, [progress])
  useEffect(() => { sessionMsgRef.current = sessionMsgCount }, [sessionMsgCount])

  // ─── Phase 3 — horloge diégétique ─────────────────────────────────────────

  useEffect(() => {
    initDiegeticTime()
    const tick = () => setDiegeticTime(formatDiegeticDate())
    tick()
    const id = setInterval(tick, 60_000)
    return () => clearInterval(id)
  }, [])

  // ─── Initialisation ────────────────────────────────────────────────────────

  useEffect(() => {
    if (!character || hasInitialized.current) return
    hasInitialized.current  = true
    characterRef.current    = character

    // Phase 2 — migration des anciennes clés localStorage
    migrateStorageKeys(locationId, characterId)

    // Phase 3 — vérifier disponibilité temporelle
    if (character.schedule) {
      const { openHour, closeHour } = character.schedule
      if (!isWithinSchedule(openHour, closeHour)) {
        const closedMsg = character.schedule.closedMessage ?? `${character.name} n'est pas disponible à cette heure.`
        const closedMessage: Message = { role: 'assistant', content: closedMsg, timestamp: Date.now() }
        setMessages([closedMessage])
        setSessionEnded(true)
        return
      }
    }

    const savedTrust      = localStorage.getItem(storageKeys.trust(characterId))
    const savedEncounters = localStorage.getItem(storageKeys.encounters(characterId))
    const currentTrust    = savedTrust     ? parseInt(savedTrust)     : 10
    const completed       = savedEncounters ? parseInt(savedEncounters) : 0

    setTrust(currentTrust)
    trustRef.current = currentTrust
    setCompletedEncounters(completed)

    const initialProgress = loadProgress()
    setProgress(initialProgress)
    progressRef.current = initialProgress

    // Récupérer Core Memory ou contexte brut
    const coreMemoryRaw = localStorage.getItem(storageKeys.coreMemory(characterId))
    const savedContext  = localStorage.getItem(storageKeys.context(characterId)) ?? ''
    let lastContext = savedContext

    // Si on a une Core Memory, l'utiliser à la place du contexte brut
    if (coreMemoryRaw) {
      try {
        const cm = JSON.parse(coreMemoryRaw)
        if (cm.content) lastContext = cm.content
      } catch { /* garder savedContext */ }
    }

    lastContextRef.current = lastContext

    // Phase 3 — contexte d'absence
    const absenceCtx = getAbsenceContext(characterId)

    if (lastContext) {
      // Visite de retour — message d'ouverture dynamique
      setIsLoading(true)
      const body: ChatRequest = {
        locationId,
        characterId,
        messages: [],
        trustLevel: currentTrust,
        lastContext,
        openingMessage: true,
        discoveredClues: initialProgress.discoveredClues,
        mentionedCharacters: [],
        absenceContext: absenceCtx ?? undefined,
        currentLocationName: character.locationContext?.[locationId] ? undefined : undefined
      }
      fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
        .then(r => r.json())
        .then((data: ChatResponse) => {
          if (data.reply) {
            const opening: Message = { role: 'assistant', content: data.reply, timestamp: Date.now() }
            setMessages([opening])
            messagesRef.current = [opening]
            lastContextRef.current = ''
          }
          // Appliquer trust delta de l'ouverture si présent
          if (data.trustDelta) {
            const newTrust = Math.max(0, Math.min(100, currentTrust + data.trustDelta))
            setTrust(newTrust)
            trustRef.current = newTrust
            localStorage.setItem(storageKeys.trust(characterId), newTrust.toString())
          }
          setIsLoading(false)
        })
        .catch(() => setIsLoading(false))
    } else {
      // Première visite — intro statique
      const intro: Message = { role: 'assistant', content: character.intro, timestamp: Date.now() }
      setMessages([intro])
      messagesRef.current = [intro]
    }
  }, [locationId, characterId, character])

  // ─── Sauvegarde au déchargement ───────────────────────────────────────────

  useEffect(() => {
    const handleUnload = () => {
      if (hasSavedSession.current) return
      hasSavedSession.current = true
      saveSession(locationId, characterId, messagesRef.current, characterRef.current?.name ?? '')
      // Fire-and-forget : pas d'await possible dans beforeunload
      distillCoreMemory(
        characterId,
        messagesRef.current,
        parseInt(localStorage.getItem(storageKeys.encounters(characterId)) ?? '0')
      )
    }
    window.addEventListener('beforeunload', handleUnload)
    return () => window.removeEventListener('beforeunload', handleUnload)
  }, [locationId, characterId])

  // ─── Scroll automatique ───────────────────────────────────────────────────

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ─── Notification d'indice ────────────────────────────────────────────────

  useEffect(() => {
    if (newClueFound) {
      const timer = setTimeout(() => setNewClueFound(null), 4500)
      return () => clearTimeout(timer)
    }
  }, [newClueFound])

  // ─── Quitter ──────────────────────────────────────────────────────────────

  async function saveAndLeave() {
    if (!hasSavedSession.current) {
      hasSavedSession.current = true
      saveSession(locationId, characterId, messagesRef.current, characterRef.current?.name ?? '')
    }

    // Phase 4 — distillation async (non bloquante pour l'UX)
    distillCoreMemory(
      characterId,
      messagesRef.current,
      parseInt(localStorage.getItem(storageKeys.encounters(characterId)) ?? '0')
    )

    router.push(`/lieu/${locationId}`)
  }

  // ─── Envoi d'un message ───────────────────────────────────────────────────

  async function sendMessage() {
    if (!input.trim() || isLoading || sessionEnded) return

    const userMessage: Message = { role: 'user', content: input.trim(), timestamp: Date.now() }
    const updatedMessages = [...messages, userMessage]
    setMessages(updatedMessages)
    setInput('')
    setIsLoading(true)
    setSessionMsgCount(c => c + 1)
    sessionMsgRef.current += 1

    if (textareaRef.current) textareaRef.current.style.height = 'auto'

    const mentionedCharacters = detectMentionedCharacters(userMessage.content)
    const lastContext = lastContextRef.current
    lastContextRef.current = ''

    // Phase 3 — contexte d'absence (seulement au premier message de retour)
    const absenceCtx = messages.length <= 1 ? getAbsenceContext(characterId) : null

    try {
      const body: ChatRequest = {
        locationId,
        characterId,
        messages: updatedMessages.slice(-20),
        trustLevel: trustRef.current,
        lastContext,
        discoveredClues: progressRef.current.discoveredClues,
        mentionedCharacters,
        absenceContext: absenceCtx ?? undefined,
        currentLocationName: getCharacter(locationId, characterId)?.name,
        sessionMessageCount: sessionMsgRef.current
      }

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      const data: ChatResponse = await response.json()

      if (data.reply) {
        const assistantMessage: Message = {
          role: 'assistant',
          content: data.reply,
          timestamp: Date.now()
        }
        const finalMessages = [...updatedMessages, assistantMessage]
        setMessages(finalMessages)

        // Phase 1 — trust delta depuis l'API unifiée
        if (typeof data.trustDelta === 'number' && data.trustDelta !== 0) {
          const newTrust = Math.max(0, Math.min(100, trustRef.current + data.trustDelta))
          setTrust(newTrust)
          trustRef.current = newTrust
          localStorage.setItem(storageKeys.trust(characterId), newTrust.toString())
        }

        // Phase 1 — indices depuis l'API unifiée
        if (data.newClueIds?.length > 0) {
          applyNewClues(data.newClueIds)
        }

        // Phase 4 — fatigue diégétique
        if (data.sessionEnded) {
          setSessionEnded(true)
        }
      }
    } catch (error) {
      console.error('Erreur sendMessage:', error)
    }

    setIsLoading(false)
  }

  // ─── Appliquer les indices découverts ─────────────────────────────────────

  function applyNewClues(clueIds: string[]) {
    const current = progressRef.current
    const newClues = clueIds.filter(id => !current.discoveredClues.includes(id))
    if (newClues.length === 0) return

    const updatedDiscovered  = [...current.discoveredClues, ...newClues]
    const newlyUnlocked      = computeNewlyUnlockedParts(current.completedParts, updatedDiscovered)
    const storyJustCompleted = checkStoryComplete(newlyUnlocked)

    const newProgress: ReaderProgress = {
      discoveredClues: updatedDiscovered,
      completedParts:  [...current.completedParts, ...newlyUnlocked],
      isStoryComplete: current.isStoryComplete || storyJustCompleted,
      completedAt:     storyJustCompleted ? Date.now() : current.completedAt
    }

    setProgress(newProgress)
    progressRef.current = newProgress
    saveProgress(newProgress)

    // Notif indice
    const firstClue = story.clues.find(c => c.id === newClues[0])
    setNewClueFound(firstClue?.content ?? 'Un nouvel indice a été révélé.')

    // Phase 4 — l'histoire est terminée
    if (storyJustCompleted) {
      setSessionEnded(true)
    }
  }

  // ─── Handlers UI ──────────────────────────────────────────────────────────

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  function autoResize(el: HTMLTextAreaElement) {
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 120) + 'px'
  }

  // ─── Rendu ────────────────────────────────────────────────────────────────

  if (!character) {
    return <div style={{ padding: '2rem', fontFamily: "'Raleway', sans-serif" }}>Personnage introuvable.</div>
  }

  const isComplete = progress.isStoryComplete

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      minHeight: '100vh',
      background: '#f7f4ef',
      fontFamily: "'Raleway', sans-serif"
    }}>
      <link
        href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300;1,400&family=Raleway:wght@300;400;500&display=swap"
        rel="stylesheet"
      />

      {/* Notification indice */}
      {newClueFound && (
        <div style={{
          position: 'fixed',
          bottom: '2rem',
          left: '50%',
          transform: 'translateX(-50%)',
          background: '#1a1814',
          color: '#f7f4ef',
          fontFamily: "'Cormorant Garamond', Georgia, serif",
          fontSize: 'clamp(14px, 1.6vw, 16px)',
          fontStyle: 'italic',
          padding: '0.75rem 1.5rem',
          borderRadius: '2px',
          zIndex: 100,
          maxWidth: '90vw',
          textAlign: 'center'
        }}>
          {newClueFound}
        </div>
      )}

      {/* Notification fin d'histoire (Phase 4) */}
      {isComplete && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(26, 24, 20, 0.85)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 200
        }}>
          <div style={{
            background: '#f7f4ef',
            padding: '3rem',
            borderRadius: '3px',
            maxWidth: '420px',
            textAlign: 'center'
          }}>
            <p style={{
              fontFamily: "'Cormorant Garamond', Georgia, serif",
              fontSize: 'clamp(20px, 2.4vw, 26px)',
              fontWeight: 300,
              color: '#1a1814',
              lineHeight: 1.7,
              marginBottom: '2rem',
              whiteSpace: 'pre-line'
            }}>
              {story.epilogueMessage}
            </p>
            <button
              onClick={() => router.push(`/lieu/${locationId}`)}
              style={{
                fontFamily: "'Raleway', sans-serif",
                fontSize: '14px',
                fontWeight: 500,
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                color: '#8b6f47',
                background: 'none',
                border: '1px solid #d4cfc6',
                borderRadius: '2px',
                padding: '0.75rem 1.5rem',
                cursor: 'pointer'
              }}
            >
              Fermer
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '1rem 2rem',
        borderBottom: '1px solid #d4cfc6',
        background: '#f7f4ef',
        position: 'sticky',
        top: 0,
        zIndex: 10
      }}>
        <button
          onClick={saveAndLeave}
          style={{
            fontFamily: "'Raleway', sans-serif",
            fontSize: 'clamp(14px, 1.5vw, 15px)',
            fontWeight: 400,
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            color: '#8a8680',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0
          }}
        >
          ← quitter
        </button>
        <span style={{
          fontFamily: "'Cormorant Garamond', Georgia, serif",
          fontSize: 'clamp(20px, 2.4vw, 26px)',
          fontWeight: 300,
          color: '#1a1814'
        }}>
          {character.name}
        </span>
        {/* Phase 3 — heure diégétique */}
        <span style={{
          fontFamily: "'Cormorant Garamond', Georgia, serif",
          fontSize: 'clamp(12px, 1.3vw, 14px)',
          fontStyle: 'italic',
          color: '#8a8680',
          textAlign: 'right',
          maxWidth: '140px'
        }}>
          {diegeticTime || visitLabel(completedEncounters)}
        </span>
      </div>

      {/* Messages */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '3rem 2rem',
        maxWidth: '680px',
        width: '100%',
        margin: '0 auto'
      }}>
        {/* Divider relation */}
        <div style={{ textAlign: 'center', margin: '0 0 2rem', position: 'relative' }}>
          <div style={{
            position: 'absolute', top: '50%', left: 0, right: 0,
            height: '1px', background: '#d4cfc6'
          }} />
          <span style={{
            position: 'relative',
            background: '#f7f4ef',
            padding: '0 1rem',
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            fontSize: 'clamp(14px, 1.5vw, 16px)',
            fontStyle: 'italic',
            color: '#8a8680',
            letterSpacing: '0.1em'
          }}>
            {relationLabel(completedEncounters, trust, character.pronoun ?? 'elle')}
          </span>
        </div>

        {messages.map((message, i) => (
          <MessageBubble key={i} message={message} characterName={character.name} />
        ))}

        {isLoading && (
          <div style={{ marginBottom: '2rem' }}>
            <div style={{
              fontFamily: "'Raleway', sans-serif",
              fontSize: '14px',
              fontWeight: 500,
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              color: '#8a8680',
              marginBottom: '0.4rem'
            }}>
              {character.name.toUpperCase()}
            </div>
            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{
                  width: '4px', height: '4px', borderRadius: '50%',
                  background: '#c4a882',
                  animation: `dot 1.2s infinite ease-in-out ${i * 0.2}s`
                }} />
              ))}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Footer */}
      <div style={{
        borderTop: '1px solid #d4cfc6',
        padding: '1.25rem 2rem',
        background: '#f7f4ef'
      }}>
        <div style={{ maxWidth: '680px', margin: '0 auto' }}>
          <TrustBar value={trust} characterName={character.name} />

          {sessionEnded && !isComplete ? (
            /* Phase 4 — Fatigue diégétique : session terminée par le personnage */
            <p style={{
              fontFamily: "'Cormorant Garamond', Georgia, serif",
              fontSize: 'clamp(15px, 1.7vw, 17px)',
              fontStyle: 'italic',
              color: '#8a8680',
              textAlign: 'center',
              padding: '0.75rem 0'
            }}>
              La conversation s'est refermée. Revenez une autre fois.
            </p>
          ) : (
            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
              <textarea
                ref={textareaRef}
                value={input}
                onChange={e => {
                  setInput(e.target.value)
                  autoResize(e.target)
                }}
                onKeyDown={handleKey}
                disabled={isLoading || sessionEnded}
                placeholder="Dites quelque chose…"
                rows={1}
                style={{
                  flex: 1,
                  fontFamily: "'Raleway', sans-serif",
                  fontSize: 'clamp(14px, 1.6vw, 16px)',
                  fontWeight: 300,
                  color: '#1a1814',
                  background: '#ede9e2',
                  border: '1px solid #d4cfc6',
                  borderRadius: '2px',
                  padding: '0.75rem 1rem',
                  resize: 'none',
                  outline: 'none',
                  minHeight: '44px',
                  maxHeight: '120px',
                  lineHeight: '1.5',
                  opacity: sessionEnded ? 0.4 : 1
                }}
              />
              <button
                onClick={sendMessage}
                disabled={isLoading || !input.trim() || sessionEnded}
                style={{
                  fontFamily: "'Raleway', sans-serif",
                  fontSize: 'clamp(13px, 1.4vw, 14px)',
                  fontWeight: 500,
                  letterSpacing: '0.2em',
                  textTransform: 'uppercase',
                  color: '#8b6f47',
                  background: 'none',
                  border: '1px solid #d4cfc6',
                  borderRadius: '2px',
                  padding: '0.75rem 1.25rem',
                  cursor: (isLoading || !input.trim() || sessionEnded) ? 'not-allowed' : 'pointer',
                  whiteSpace: 'nowrap',
                  height: '44px',
                  opacity: (isLoading || !input.trim() || sessionEnded) ? 0.4 : 1
                }}
              >
                Envoyer
              </button>
            </div>
          )}

          {!sessionEnded && (
            <p style={{
              fontFamily: "'Cormorant Garamond', Georgia, serif",
              fontSize: 'clamp(14px, 1.5vw, 16px)',
              fontStyle: 'italic',
              color: '#8a8680',
              marginTop: '0.6rem',
              textAlign: 'center'
            }}>
              Prenez le temps. {character.pronoun === 'il' ? 'Il' : 'Elle'} remarque comment vous l'écoutez.
            </p>
          )}
        </div>
      </div>

      <style>{`
        @keyframes dot {
          0%, 60%, 100% { opacity: 0.3; transform: scale(1); }
          30% { opacity: 1; transform: scale(1.3); }
        }
      `}</style>
    </div>
  )
}
