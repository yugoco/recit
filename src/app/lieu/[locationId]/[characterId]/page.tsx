'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { getCharacter } from '@/lib/locations'
import { getRelation, story, detectMentionedCharacters, computeNewlyUnlockedParts } from '@/lib/story'
import { Message, ReaderProgress, ChatRequest } from '@/lib/types'
import MessageBubble from '@/components/MessageBubble'
import TrustBar from '@/components/TrustBar'

// ─── Clés localStorage ────────────────────────────────────────────────────────

function trustKey(locationId: string, characterId: string) {
  return `recit_trust_${locationId}_${characterId}`
}
function encountersKey(locationId: string, characterId: string) {
  return `recit_encounters_${locationId}_${characterId}`
}
function contextKey(locationId: string, characterId: string) {
  return `recit_last_context_${locationId}_${characterId}`
}

// ─── Progress ─────────────────────────────────────────────────────────────────

function loadProgress(): ReaderProgress {
  try {
    const saved = localStorage.getItem('recit_progress')
    return saved ? JSON.parse(saved) : { discoveredClues: [], completedParts: [] }
  } catch {
    return { discoveredClues: [], completedParts: [] }
  }
}

function saveProgress(progress: ReaderProgress) {
  localStorage.setItem('recit_progress', JSON.stringify(progress))
}

// ─── Sauvegarde de fin de session ─────────────────────────────────────────────

function saveSession(
  locationId: string,
  characterId: string,
  messages: Message[],
  characterName: string
) {
  if (messages.length === 0) return

  // Lire le compteur actuel et incrémenter
  const key = encountersKey(locationId, characterId)
  const previous = parseInt(localStorage.getItem(key) ?? '0')
  localStorage.setItem(key, (previous + 1).toString())

  // Sauvegarder le contexte des 8 derniers messages
  const summary = messages
    .slice(-8)
    .map(m => `${m.role === 'user' ? 'Lecteur' : characterName}: ${m.content}`)
    .join('\n')
  localStorage.setItem(contextKey(locationId, characterId), summary)
}

// ─── Label de visite ──────────────────────────────────────────────────────────

/**
 * États de la relation selon les visites complétées et le niveau de confiance.
 * Le divider au-dessus des messages reflète l'état de la relation narrativement.
 */
function relationLabel(completedEncounters: number, trust: number, pronoun: 'elle' | 'il'): string {
  const p = pronoun
  if (completedEncounters === 0) {
    return 'Première visite'
  }
  if (completedEncounters === 1 && trust < 40) {
    return `${p === 'elle' ? 'Elle' : 'Il'} se souvient de vous`
  }
  if (completedEncounters <= 3 && trust < 65) {
    return `${p === 'elle' ? 'Elle' : 'Il'} commence à vous reconnaître`
  }
  if (trust >= 65) {
    return `${p === 'elle' ? 'Elle' : 'Il'} vous fait confiance`
  }
  return `${p === 'elle' ? 'Elle' : 'Il'} se souvient de vous`
}

function visitLabel(completedEncounters: number, position: 'list' | 'header'): string {
  if (completedEncounters === 0) {
    if (position === 'list') return 'inconnu·e'
    return 'première visite'
  }
  const current = completedEncounters + 1
  if (position === 'list') return `${completedEncounters} visite${completedEncounters > 1 ? 's' : ''}`
  return `visite ${current}`
}

// ─── Composant ────────────────────────────────────────────────────────────────

export default function ConversationPage() {
  const params = useParams()
  const router = useRouter()
  const locationId = params.locationId as string
  const characterId = params.characterId as string
  const character = getCharacter(locationId, characterId)

  const [messages, setMessages] = useState<Message[]>([])
  const [trust, setTrust] = useState(10)
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  // Nombre de visites COMPLÉTÉES au moment où on entre dans la page
  const [completedEncounters, setCompletedEncounters] = useState(0)
  const [progress, setProgress] = useState<ReaderProgress>({
    discoveredClues: [],
    completedParts: []
  })
  const [newClueFound, setNewClueFound] = useState<string | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const hasInitialized = useRef(false)
  const hasSavedSession = useRef(false)
  const lastContextRef = useRef<string>('')
  const messagesRef = useRef<Message[]>([])
  const characterRef = useRef(character)
  // Ref pour trust — évite les closures périmées dans evaluateTrust / detectClues
  const trustRef = useRef(10)
  const progressRef = useRef<ReaderProgress>({ discoveredClues: [], completedParts: [] })

  useEffect(() => { messagesRef.current = messages }, [messages])
  useEffect(() => { trustRef.current = trust }, [trust])
  useEffect(() => { progressRef.current = progress }, [progress])

  // ─── Initialisation ───────────────────────────────────────────────────────

  useEffect(() => {
    if (!character || hasInitialized.current) return
    hasInitialized.current = true
    characterRef.current = character

    const savedTrust = localStorage.getItem(trustKey(locationId, characterId))
    const savedEncounters = localStorage.getItem(encountersKey(locationId, characterId))
    const currentTrust = savedTrust ? parseInt(savedTrust) : 10
    const completed = savedEncounters ? parseInt(savedEncounters) : 0

    setTrust(currentTrust)
    trustRef.current = currentTrust
    setCompletedEncounters(completed)

    const initialProgress = loadProgress()
    setProgress(initialProgress)
    progressRef.current = initialProgress

    const savedContext = localStorage.getItem(contextKey(locationId, characterId)) ?? ''
    lastContextRef.current = savedContext

    if (savedContext) {
      // Visite de retour — le personnage ouvre avec un message mémoriel
      setIsLoading(true)
      const body: ChatRequest = {
        locationId,
        characterId,
        messages: [],
        trustLevel: currentTrust,
        lastContext: savedContext,
        openingMessage: true,
        discoveredClues: initialProgress.discoveredClues,
        mentionedCharacters: []
      }
      fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
        .then(r => r.json())
        .then(data => {
          if (data.reply) {
            const opening: Message = { role: 'assistant', content: data.reply, timestamp: Date.now() }
            setMessages([opening])
            messagesRef.current = [opening]
            lastContextRef.current = ''
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

  // ─── Sauvegarde au déchargement (fermeture onglet, navigation externe) ────

  useEffect(() => {
    const handleUnload = () => {
      if (hasSavedSession.current) return
      hasSavedSession.current = true
      saveSession(locationId, characterId, messagesRef.current, characterRef.current?.name ?? '')
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
      const timer = setTimeout(() => setNewClueFound(null), 4000)
      return () => clearTimeout(timer)
    }
  }, [newClueFound])

  // ─── Quitter ──────────────────────────────────────────────────────────────

  function saveAndLeave() {
    if (!hasSavedSession.current) {
      hasSavedSession.current = true
      saveSession(locationId, characterId, messagesRef.current, characterRef.current?.name ?? '')
    }
    router.push(`/lieu/${locationId}`)
  }

  // ─── Envoi d'un message ───────────────────────────────────────────────────

  async function sendMessage() {
    if (!input.trim() || isLoading) return

    const userMessage: Message = { role: 'user', content: input.trim(), timestamp: Date.now() }
    const updatedMessages = [...messages, userMessage]
    setMessages(updatedMessages)
    setInput('')
    setIsLoading(true)

    if (textareaRef.current) textareaRef.current.style.height = 'auto'

    const mentionedCharacters = detectMentionedCharacters(userMessage.content)
    const lastContext = lastContextRef.current
    lastContextRef.current = ''

    try {
      const body: ChatRequest = {
        locationId,
        characterId,
        messages: updatedMessages.slice(-20),
        trustLevel: trustRef.current,
        lastContext,
        discoveredClues: progressRef.current.discoveredClues,
        mentionedCharacters
      }

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      const data = await response.json()

      if (data.reply) {
        const assistantMessage: Message = {
          role: 'assistant',
          content: data.reply,
          timestamp: Date.now()
        }
        const finalMessages = [...updatedMessages, assistantMessage]
        setMessages(finalMessages)

        // Évaluer la confiance en premier, puis passer le nouveau niveau à detectClues
        const newTrust = await evaluateTrust(userMessage.content, data.reply)

        const effectiveTrust = newTrust ?? trustRef.current
        const hasAvailableClues = story.clues.some(clue =>
          clue.revealedBy === characterId &&
          effectiveTrust >= clue.trustRequired &&
          !progressRef.current.discoveredClues.includes(clue.id)
        )
        if (hasAvailableClues) {
          await detectClues(data.reply, effectiveTrust)
        }
      }
    } catch (error) {
      console.error('Erreur:', error)
    }

    setIsLoading(false)
  }

  // ─── Évaluation de confiance — retourne le nouveau niveau ────────────────

  async function evaluateTrust(userInput: string, characterReply: string): Promise<number | null> {
    try {
      const response = await fetch('/api/trust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locationId,
          characterId,
          userInput,
          characterReply,
          currentTrust: trustRef.current
        })
      })
      const data = await response.json()
      if (typeof data.delta === 'number') {
        const newTrust = Math.max(0, Math.min(100, trustRef.current + data.delta))
        setTrust(newTrust)
        trustRef.current = newTrust
        localStorage.setItem(trustKey(locationId, characterId), newTrust.toString())
        return newTrust
      }
    } catch (error) {
      console.error('Erreur confiance:', error)
    }
    return null
  }

  // ─── Détection d'indices — prend le trust effectif en paramètre ───────────

  async function detectClues(characterReply: string, effectiveTrust: number) {
    try {
      const response = await fetch('/api/clues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          characterId,
          characterReply,
          currentTrust: effectiveTrust,
          alreadyDiscovered: progressRef.current.discoveredClues
        })
      })
      const data = await response.json()

      if (data.discoveredClueIds?.length > 0) {
        const current = progressRef.current
        const newClues = (data.discoveredClueIds as string[]).filter(
          id => !current.discoveredClues.includes(id)
        )

        if (newClues.length > 0) {
          const updatedDiscovered = [...current.discoveredClues, ...newClues]
          const newlyUnlocked = computeNewlyUnlockedParts(current.completedParts, updatedDiscovered)
          const newProgress: ReaderProgress = {
            discoveredClues: updatedDiscovered,
            completedParts: [...current.completedParts, ...newlyUnlocked]
          }
          setProgress(newProgress)
          progressRef.current = newProgress
          saveProgress(newProgress)
          const firstClue = story.clues.find(c => c.id === newClues[0])
          setNewClueFound(firstClue?.content ?? 'Un nouvel indice a été révélé.')
        }
      }
    } catch (error) {
      console.error('Erreur indices:', error)
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
    return (
      <div style={{ padding: '2rem', fontFamily: "'Raleway', sans-serif" }}>
        Personnage introuvable.
      </div>
    )
  }

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
          zIndex: 100
        }}>
          {newClueFound}
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
        <span style={{
          fontFamily: "'Cormorant Garamond', Georgia, serif",
          fontSize: 'clamp(14px, 1.5vw, 16px)',
          fontStyle: 'italic',
          color: '#8a8680'
        }}>
          {visitLabel(completedEncounters, 'header')}
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
        <div style={{
          textAlign: 'center',
          margin: '0 0 2rem',
          position: 'relative'
        }}>
          <div style={{
            position: 'absolute',
            top: '50%',
            left: 0,
            right: 0,
            height: '1px',
            background: '#d4cfc6'
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
          <MessageBubble
            key={i}
            message={message}
            characterName={character.name}
          />
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
                  width: '4px',
                  height: '4px',
                  borderRadius: '50%',
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
          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => {
                setInput(e.target.value)
                autoResize(e.target)
              }}
              onKeyDown={handleKey}
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
                lineHeight: '1.5'
              }}
            />
            <button
              onClick={sendMessage}
              disabled={isLoading || !input.trim()}
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
                cursor: isLoading || !input.trim() ? 'not-allowed' : 'pointer',
                whiteSpace: 'nowrap',
                height: '44px',
                opacity: isLoading || !input.trim() ? 0.4 : 1
              }}
            >
              Envoyer
            </button>
          </div>
          <p style={{
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            fontSize: 'clamp(14px, 1.5vw, 16px)',
            fontStyle: 'italic',
            color: '#8a8680',
            marginTop: '0.6rem',
            textAlign: 'center'
          }}>
            Prenez le temps. Elle remarque comment vous l'écoutez.
          </p>
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
