'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { getCharacter } from '@/lib/locations'
import { story, detectMentionedCharacters, computeNewlyUnlockedParts, checkStoryComplete } from '@/lib/story'
import { getNewlyUnlockedLocations } from '@/lib/locations'
import { Message, ReaderProgress, ChatRequest, API_KEY_STORAGE_KEY } from '@/lib/types'
import { sendChatMessage, distillCoreMemory } from '@/lib/anthropic-client'
import {
  initDiegeticTime,
  getAbsenceContext,
  getViolenceReturnContext,
  markLastSeen,
  markSessionExit,
  migrateStorageKeys,
  storageKeys,
  isWithinSchedule,
  formatDiegeticDate,
  ExitReason,
} from '@/lib/time'
import MessageBubble from '@/components/MessageBubble'
import TrustBar from '@/components/TrustBar'
import { CluesPanel, CluesButton } from '@/components/CluesPanel'

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

function saveSession(characterId: string, messages: Message[], characterName: string) {
  if (messages.length === 0) return
  const key = storageKeys.encounters(characterId)
  const prev = parseInt(localStorage.getItem(key) ?? '0')
  localStorage.setItem(key, (prev + 1).toString())
  const summary = messages
    .slice(-8)
    .map(m => `${m.role === 'user' ? 'Lecteur' : characterName}: ${m.content}`)
    .join('\n')
  localStorage.setItem(storageKeys.context(characterId), summary)
  markLastSeen(characterId)
}

// ─── Labels ───────────────────────────────────────────────────────────────────

function relationLabel(encounters: number, trust: number, pronoun: 'elle' | 'il'): string {
  const p = pronoun === 'elle' ? 'Elle' : 'Il'
  if (encounters === 0) return 'Première rencontre'
  if (encounters === 1 && trust < 40) return `${p} se souvient de vous`
  if (encounters <= 3  && trust < 65) return `${p} commence à vous reconnaître`
  if (trust >= 65)                    return `${p} vous fait confiance`
  return `${p} se souvient de vous`
}

function isMobile(): boolean {
  if (typeof window === 'undefined') return false
  return /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i.test(navigator.userAgent)
}

// ─── Notification indice ──────────────────────────────────────────────────────

interface ClueNotification {
  clueContent: string
  unlockedParts: string[]
  isEpilogue: boolean
}

// ─── Composant ────────────────────────────────────────────────────────────────

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
  const [clueNotif,           setClueNotif]           = useState<ClueNotification | null>(null)
  const [sessionEnded,        setSessionEnded]        = useState(false)
  const [lastTrustDelta,      setLastTrustDelta]      = useState(0)
  const [sessionMsgCount,     setSessionMsgCount]     = useState(0)
  const [diegeticTime,        setDiegeticTime]        = useState('')
  const [apiKey,              setApiKey]              = useState('')
  const [noApiKey,            setNoApiKey]            = useState(false)
  const [showCluesPanel,      setShowCluesPanel]      = useState(false)

  const messagesEndRef  = useRef<HTMLDivElement>(null)
  const textareaRef     = useRef<HTMLTextAreaElement>(null)
  const hasInitialized  = useRef(false)
  const hasSavedSession = useRef(false)
  const lastContextRef  = useRef('')
  const messagesRef     = useRef<Message[]>([])
  const trustRef        = useRef(10)
  const progressRef     = useRef<ReaderProgress>({ discoveredClues: [], completedParts: [], isStoryComplete: false })
  const sessionMsgRef   = useRef(0)
  const characterRef    = useRef(character)
  const apiKeyRef       = useRef('')

  useEffect(() => { messagesRef.current   = messages        }, [messages])
  useEffect(() => { trustRef.current      = trust           }, [trust])
  useEffect(() => { progressRef.current   = progress        }, [progress])
  useEffect(() => { sessionMsgRef.current = sessionMsgCount }, [sessionMsgCount])
  useEffect(() => { apiKeyRef.current     = apiKey          }, [apiKey])

  // Horloge diégétique
  useEffect(() => {
    initDiegeticTime()
    const tick = () => setDiegeticTime(formatDiegeticDate())
    tick()
    const id = setInterval(tick, 60_000)
    return () => clearInterval(id)
  }, [])

  // Autofocus desktop après chaque réponse
  useEffect(() => {
    if (!isLoading && messages.length > 0 && !sessionEnded && !isMobile()) {
      textareaRef.current?.focus()
    }
  }, [isLoading, messages.length, sessionEnded])

  // Initialisation
  useEffect(() => {
    if (!character || hasInitialized.current) return
    hasInitialized.current = true
    characterRef.current   = character

    const savedKey = localStorage.getItem(API_KEY_STORAGE_KEY) ?? ''
    setApiKey(savedKey)
    apiKeyRef.current = savedKey
    if (!savedKey) { setNoApiKey(true); return }

    migrateStorageKeys(locationId, characterId)

    if (character.schedule) {
      const { openHour, closeHour } = character.schedule
      if (!isWithinSchedule(openHour, closeHour)) {
        const msg = character.schedule.closedMessage ?? `${character.name} n'est pas disponible à cette heure.`
        setMessages([{ role: 'assistant', content: msg, timestamp: Date.now() }])
        setSessionEnded(true)
        return
      }
    }

    const currentTrust = parseInt(localStorage.getItem(storageKeys.trust(characterId)) ?? '10')
    const completed    = parseInt(localStorage.getItem(storageKeys.encounters(characterId)) ?? '0')

    setTrust(currentTrust)
    trustRef.current = currentTrust
    setCompletedEncounters(completed)

    const initialProgress = loadProgress()
    setProgress(initialProgress)
    progressRef.current = initialProgress

    const coreMemoryRaw = localStorage.getItem(storageKeys.coreMemory(characterId))
    let lastContext = localStorage.getItem(storageKeys.context(characterId)) ?? ''
    if (coreMemoryRaw) {
      try { const cm = JSON.parse(coreMemoryRaw); if (cm.content) lastContext = cm.content } catch { /* noop */ }
    }
    lastContextRef.current = lastContext

    const violenceCtx = getViolenceReturnContext(characterId)
    const absenceCtx  = violenceCtx ?? getAbsenceContext(characterId)

    if (lastContext) {
      setIsLoading(true)
      const req: ChatRequest = {
        locationId, characterId, messages: [],
        trustLevel: currentTrust, lastContext,
        openingMessage: true,
        discoveredClues: initialProgress.discoveredClues,
        mentionedCharacters: [],
        absenceContext: absenceCtx ?? undefined,
      }
      sendChatMessage(savedKey, req)
        .then(data => {
          if (data.reply) {
            const opening: Message = { role: 'assistant', content: data.reply, timestamp: Date.now() }
            setMessages([opening])
            messagesRef.current = [opening]
            lastContextRef.current = ''
          }
          if (typeof data.trustDelta === 'number' && data.trustDelta !== 0) {
            const newTrust = Math.max(0, Math.min(100, currentTrust + data.trustDelta))
            setTrust(newTrust); trustRef.current = newTrust
            localStorage.setItem(storageKeys.trust(characterId), newTrust.toString())
          }
          setIsLoading(false)
        })
        .catch(() => setIsLoading(false))
    } else {
      const intro: Message = { role: 'assistant', content: character.intro, timestamp: Date.now() }
      setMessages([intro])
      messagesRef.current = [intro]
    }
  }, [locationId, characterId, character])

  // Sauvegarde au déchargement
  useEffect(() => {
    const handleUnload = () => {
      if (hasSavedSession.current) return
      hasSavedSession.current = true
      saveSession(characterId, messagesRef.current, characterRef.current?.name ?? '')
      markSessionExit(characterId, 'natural')
      distillCoreMemory({
        apiKey: apiKeyRef.current,
        characterId,
        characterName: characterRef.current?.name ?? '',
        messages: messagesRef.current,
        sessionCount: parseInt(localStorage.getItem(storageKeys.encounters(characterId)) ?? '0'),
      }).then(mem => {
        if (mem) {
          localStorage.setItem(storageKeys.coreMemory(characterId), JSON.stringify({ content: mem, characterId, createdAt: Date.now() }))
          localStorage.setItem(storageKeys.context(characterId), mem)
        }
      })
    }
    window.addEventListener('beforeunload', handleUnload)
    return () => window.removeEventListener('beforeunload', handleUnload)
  }, [locationId, characterId])

  // Scroll auto
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  // ─── Actions ───────────────────────────────────────────────────────────────

  async function doDistillAndSave(finalMessages: Message[]) {
    const mem = await distillCoreMemory({
      apiKey: apiKeyRef.current,
      characterId,
      characterName: characterRef.current?.name ?? '',
      messages: finalMessages,
      sessionCount: parseInt(localStorage.getItem(storageKeys.encounters(characterId)) ?? '0'),
    })
    if (mem) {
      localStorage.setItem(storageKeys.coreMemory(characterId), JSON.stringify({ content: mem, characterId, createdAt: Date.now() }))
      localStorage.setItem(storageKeys.context(characterId), mem)
    }
  }

  async function saveAndLeave() {
    if (!hasSavedSession.current) {
      hasSavedSession.current = true
      saveSession(characterId, messagesRef.current, characterRef.current?.name ?? '')
      markSessionExit(characterId, 'natural')
    }
    doDistillAndSave(messagesRef.current)
    router.push(`/lieu/${locationId}`)
  }

  function handleForcedSessionEnd(driftDetected: string | null | undefined, finalMessages: Message[]) {
    if (hasSavedSession.current) return
    hasSavedSession.current = true
    const exitReason: ExitReason = driftDetected === 'violence' ? 'violence' : 'fatigue'
    saveSession(characterId, finalMessages, characterRef.current?.name ?? '')
    markSessionExit(characterId, exitReason)
    doDistillAndSave(finalMessages)
  }

  async function sendMessage() {
    if (!input.trim() || isLoading || sessionEnded) return

    const userMessage: Message = { role: 'user', content: input.trim(), timestamp: Date.now() }
    const updatedMessages = [...messages, userMessage]
    setMessages(updatedMessages)
    setInput('')
    setIsLoading(true)
    setLastTrustDelta(0)
    setSessionMsgCount(c => c + 1)
    sessionMsgRef.current += 1

    if (textareaRef.current) textareaRef.current.style.height = 'auto'

    const mentionedCharacters = detectMentionedCharacters(userMessage.content)
    const lastContext = lastContextRef.current
    lastContextRef.current = ''
    const absenceCtx = messages.length <= 1 ? getAbsenceContext(characterId) : null

    try {
      const req: ChatRequest = {
        locationId, characterId,
        messages: updatedMessages.slice(-20),
        trustLevel: trustRef.current,
        lastContext,
        discoveredClues: progressRef.current.discoveredClues,
        mentionedCharacters,
        absenceContext: absenceCtx ?? undefined,
        sessionMessageCount: sessionMsgRef.current,
      }

      const data = await sendChatMessage(apiKeyRef.current, req)

      if (data.reply) {
        const assistantMsg: Message = { role: 'assistant', content: data.reply, timestamp: Date.now() }
        const finalMessages = [...updatedMessages, assistantMsg]
        setMessages(finalMessages)

        if (typeof data.trustDelta === 'number') {
          const newTrust = Math.max(0, Math.min(100, trustRef.current + data.trustDelta))
          setTrust(newTrust)
          setLastTrustDelta(data.trustDelta)
          trustRef.current = newTrust
          localStorage.setItem(storageKeys.trust(characterId), newTrust.toString())
        }

        if (data.newClueIds?.length > 0) applyNewClues(data.newClueIds)

        if (data.sessionEnded) {
          handleForcedSessionEnd(data.driftDetected, finalMessages)
          setSessionEnded(true)
        }
      }
    } catch (err: unknown) {
      if (typeof err === 'object' && err !== null && 'status' in err && (err as { status: number }).status === 401) {
        router.push('/')
        return
      }
      console.error('Erreur sendMessage:', err)
    }

    setIsLoading(false)
  }

  function applyNewClues(clueIds: string[]) {
    const current  = progressRef.current
    const newClues = clueIds.filter(id => !current.discoveredClues.includes(id))
    if (newClues.length === 0) return

    const updatedDiscovered  = [...current.discoveredClues, ...newClues]
    const newlyUnlocked      = computeNewlyUnlockedParts(current.completedParts, updatedDiscovered)
    const storyJustCompleted = checkStoryComplete(newlyUnlocked)
    const newlyUnlockedLocs  = getNewlyUnlockedLocations(newlyUnlocked)

    const existingNew  = current.newlyUnlockedLocations ?? []
    const mergedNewLocs = [...new Set([...existingNew, ...newlyUnlockedLocs])]

    const newProgress: ReaderProgress = {
      discoveredClues: updatedDiscovered,
      completedParts:  [...current.completedParts, ...newlyUnlocked],
      isStoryComplete: current.isStoryComplete || storyJustCompleted,
      completedAt:     storyJustCompleted ? Date.now() : current.completedAt,
      newlyUnlockedLocations: mergedNewLocs,
    }

    setProgress(newProgress)
    progressRef.current = newProgress
    saveProgress(newProgress)

    const firstClue = story.clues.find(c => c.id === newClues[0])
    const unlockedTitles = newlyUnlocked
      .map(id => story.heart.parts.find(p => p.id === id)?.title)
      .filter(Boolean) as string[]

    setClueNotif({
      clueContent: firstClue?.content ?? 'Un indice a été révélé.',
      unlockedParts: unlockedTitles,
      isEpilogue: storyJustCompleted,
    })

    if (storyJustCompleted) setSessionEnded(true)
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  function autoResize(el: HTMLTextAreaElement) {
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 120) + 'px'
  }

  // ─── Rendu ─────────────────────────────────────────────────────────────────

  if (!character) {
    return <div style={{ padding: '2rem', fontFamily: "'Raleway', sans-serif" }}>Personnage introuvable.</div>
  }

  if (noApiKey) {
    return (
      <div style={{ minHeight: '100vh', background: '#f7f4ef', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3rem 2rem' }}>
        <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300;1,400&family=Raleway:wght@300;400;500&display=swap" rel="stylesheet" />
        <div style={{ maxWidth: '400px', textAlign: 'center' }}>
          <p style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 'clamp(17px, 1.9vw, 20px)', fontWeight: 300, fontStyle: 'italic', color: '#4a4640', lineHeight: 1.7, marginBottom: '2rem' }}>
            Aucune clé API configurée.
          </p>
          <button onClick={() => router.push('/')} style={{ fontFamily: "'Raleway', sans-serif", fontSize: '13px', fontWeight: 500, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#8b6f47', background: 'none', border: '1px solid #d4cfc6', borderRadius: '2px', padding: '0.65rem 1.25rem', cursor: 'pointer' }}>
            ← Retour
          </button>
        </div>
      </div>
    )
  }

  const isComplete = progress.isStoryComplete

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#f7f4ef', fontFamily: "'Raleway', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300;1,400&family=Raleway:wght@300;400;500&display=swap" rel="stylesheet" />

      {/* ── Panneau indices ─────────────────────────────────────────────── */}
      <CluesPanel
        open={showCluesPanel}
        onClose={() => setShowCluesPanel(false)}
        discoveredClueIds={progress.discoveredClues}
      />

      {/* ── Modale indice trouvé — bloque jusqu'à confirmation ─────────── */}
      {clueNotif && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(26,24,20,0.75)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 150, padding: '2rem',
        }}>
          <div style={{
            background: '#1a1814', color: '#f7f4ef',
            borderRadius: '3px', maxWidth: '480px', width: '100%', overflow: 'hidden',
          }}>
            <div style={{ padding: '1.5rem 2rem 1rem', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <span style={{
                fontFamily: "'Raleway', sans-serif", fontSize: '11px', fontWeight: 500,
                letterSpacing: '0.25em', textTransform: 'uppercase', color: '#c4a882',
              }}>
                Indice découvert
              </span>
            </div>
            <div style={{ padding: '1.5rem 2rem' }}>
              <p style={{
                fontFamily: "'Cormorant Garamond', Georgia, serif",
                fontSize: 'clamp(18px, 2.2vw, 22px)', fontWeight: 300,
                fontStyle: 'italic', lineHeight: 1.65, color: '#f7f4ef', margin: 0,
              }}>
                {clueNotif.clueContent}
              </p>
            </div>
            {clueNotif.unlockedParts.length > 0 && (
              <div style={{
                padding: '1rem 2rem', borderTop: '1px solid rgba(255,255,255,0.08)',
                display: 'flex', alignItems: 'center', gap: '0.75rem',
              }}>
                <span style={{
                  fontFamily: "'Raleway', sans-serif", fontSize: '10px', fontWeight: 500,
                  letterSpacing: '0.2em', textTransform: 'uppercase', color: '#6b8c5a', flexShrink: 0,
                }}>
                  Nouveau lieu débloqué
                </span>
                <span style={{
                  fontFamily: "'Cormorant Garamond', Georgia, serif",
                  fontSize: 'clamp(14px, 1.6vw, 16px)', fontStyle: 'italic', color: '#c8e0b8',
                }}>
                  {clueNotif.unlockedParts.join(' · ')}
                </span>
              </div>
            )}
            <div style={{ padding: '1rem 2rem 1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setClueNotif(null)}
                style={{
                  fontFamily: "'Raleway', sans-serif", fontSize: '13px', fontWeight: 500,
                  letterSpacing: '0.2em', textTransform: 'uppercase', color: '#c4a882',
                  background: 'none', border: '1px solid rgba(196,168,130,0.4)', borderRadius: '2px',
                  padding: '0.6rem 1.5rem', cursor: 'pointer',
                }}
              >
                Continuer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Épilogue ────────────────────────────────────────────────────── */}
      {isComplete && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(26,24,20,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
          <div style={{ background: '#f7f4ef', padding: '3rem', borderRadius: '3px', maxWidth: '420px', textAlign: 'center' }}>
            <p style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 'clamp(20px, 2.4vw, 26px)', fontWeight: 300, color: '#1a1814', lineHeight: 1.7, marginBottom: '2rem', whiteSpace: 'pre-line' }}>
              {story.heart.epilogueMessage}
            </p>
            <button onClick={() => router.push(`/lieu/${locationId}`)} style={{ fontFamily: "'Raleway', sans-serif", fontSize: '14px', fontWeight: 500, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#8b6f47', background: 'none', border: '1px solid #d4cfc6', borderRadius: '2px', padding: '0.75rem 1.5rem', cursor: 'pointer' }}>
              Fermer
            </button>
          </div>
        </div>
      )}

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 2rem', borderBottom: '1px solid #d4cfc6', background: '#f7f4ef', position: 'sticky', top: 0, zIndex: 10 }}>
        <button onClick={saveAndLeave} style={{ fontFamily: "'Raleway', sans-serif", fontSize: 'clamp(13px, 1.4vw, 14px)', fontWeight: 400, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#8a8680', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
          ← quitter
        </button>
        <span style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 'clamp(20px, 2.4vw, 26px)', fontWeight: 300, color: '#1a1814' }}>
          {character.name}
        </span>
        <span style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 'clamp(12px, 1.3vw, 14px)', fontStyle: 'italic', color: '#8a8680', textAlign: 'right', maxWidth: '140px' }}>
          {diegeticTime}
        </span>
      </div>

      {/* ── Messages ────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '3rem 2rem', maxWidth: '680px', width: '100%', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', margin: '0 0 2rem', position: 'relative' }}>
          <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: '1px', background: '#d4cfc6' }} />
          <span style={{ position: 'relative', background: '#f7f4ef', padding: '0 1rem', fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 'clamp(14px, 1.5vw, 16px)', fontStyle: 'italic', color: '#8a8680', letterSpacing: '0.1em' }}>
            {relationLabel(completedEncounters, trust, character.pronoun ?? 'elle')}
          </span>
        </div>

        {messages.map((msg, i) => (
          <MessageBubble key={i} message={msg} characterName={character.name} />
        ))}

        {isLoading && (
          <div style={{ marginBottom: '2rem' }}>
            <div style={{ fontFamily: "'Raleway', sans-serif", fontSize: '14px', fontWeight: 500, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#8a8680', marginBottom: '0.4rem' }}>
              {character.name.toUpperCase()}
            </div>
            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
              {[0,1,2].map(i => (
                <div key={i} style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#c4a882', animation: `dot 1.2s infinite ease-in-out ${i * 0.2}s` }} />
              ))}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <div style={{ borderTop: '1px solid #d4cfc6', padding: '1.25rem 2rem', background: '#f7f4ef' }}>
        <div style={{ maxWidth: '680px', margin: '0 auto' }}>
          <TrustBar value={trust} characterName={character.name} lastDelta={lastTrustDelta} />

          {sessionEnded && !isComplete ? (
            <p style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 'clamp(15px, 1.7vw, 17px)', fontStyle: 'italic', color: '#8a8680', textAlign: 'center', padding: '0.75rem 0' }}>
              La conversation s'est refermée.
            </p>
          ) : (
            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
              <textarea
                ref={textareaRef}
                value={input}
                onChange={e => { setInput(e.target.value); autoResize(e.target) }}
                onKeyDown={handleKey}
                disabled={isLoading || sessionEnded}
                placeholder="Dites quelque chose…"
                rows={1}
                style={{ flex: 1, fontFamily: "'Raleway', sans-serif", fontSize: 'clamp(14px, 1.6vw, 16px)', fontWeight: 300, color: '#1a1814', background: '#ede9e2', border: '1px solid #d4cfc6', borderRadius: '2px', padding: '0.75rem 1rem', resize: 'none', outline: 'none', minHeight: '44px', maxHeight: '120px', lineHeight: '1.5', opacity: sessionEnded ? 0.4 : 1 }}
              />
              <button
                onClick={sendMessage}
                disabled={isLoading || !input.trim() || sessionEnded}
                style={{ fontFamily: "'Raleway', sans-serif", fontSize: 'clamp(13px, 1.4vw, 14px)', fontWeight: 500, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#8b6f47', background: 'none', border: '1px solid #d4cfc6', borderRadius: '2px', padding: '0.75rem 1.25rem', cursor: (isLoading || !input.trim() || sessionEnded) ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap', height: '44px', opacity: (isLoading || !input.trim() || sessionEnded) ? 0.4 : 1 }}
              >
                Envoyer
              </button>
              <CluesButton
                clueCount={progress.discoveredClues.length}
                onClick={() => setShowCluesPanel(true)}
                variant="icon"
              />
            </div>
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
