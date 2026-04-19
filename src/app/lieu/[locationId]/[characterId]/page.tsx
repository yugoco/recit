'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { getCharacter } from '@/lib/locations'
import { getRelation, isPartUnlocked, story } from '@/lib/story'
import { Message, ReaderProgress } from '@/lib/types'
import MessageBubble from '@/components/MessageBubble'
import TrustBar from '@/components/TrustBar'

function loadProgress(): ReaderProgress {
  try {
    const saved = localStorage.getItem('recit_progress')
    return saved ? JSON.parse(saved) : {
      discoveredClues: [],
      completedParts: [],
      revealedInfo: {}
    }
  } catch {
    return { discoveredClues: [], completedParts: [], revealedInfo: {} }
  }
}

function saveProgress(progress: ReaderProgress) {
  localStorage.setItem('recit_progress', JSON.stringify(progress))
}

function detectMentionedCharacters(userInput: string): string[] {
  const mentioned: string[] = []
  story.characterRelations && Object.keys(story.characterRelations).forEach(charId => {
    if (userInput.toLowerCase().includes(charId.toLowerCase())) {
      mentioned.push(charId)
    }
  })
  return mentioned
}

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
  const [encounterCount, setEncounterCount] = useState(0)
  const [progress, setProgress] = useState<ReaderProgress>({
    discoveredClues: [],
    completedParts: [],
    revealedInfo: {}
  })
  const [newClueFound, setNewClueFound] = useState<string | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const hasInitialized = useRef(false)
  const lastContextRef = useRef<string>('')
  const messagesRef = useRef<Message[]>([])
  const characterRef = useRef(character)

  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  useEffect(() => {
    if (!character || hasInitialized.current) return
    hasInitialized.current = true

    const savedTrust = localStorage.getItem(`recit_trust_${locationId}_${characterId}`)
    const savedEncounters = localStorage.getItem(`recit_encounters_${locationId}_${characterId}`)
    const currentTrust = savedTrust ? parseInt(savedTrust) : 10
    const currentEncounters = savedEncounters ? parseInt(savedEncounters) : 0

    setTrust(currentTrust)
    setEncounterCount(currentEncounters + 1)
    setProgress(loadProgress())

    const savedContext = localStorage.getItem(`recit_last_context_${locationId}_${characterId}`) || ''
    lastContextRef.current = savedContext
    characterRef.current = character

    if (savedContext) {
      setIsLoading(true)
      fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locationId,
          characterId,
          messages: [],
          trustLevel: currentTrust,
          lastContext: savedContext,
          openingMessage: true,
          discoveredClues: loadProgress().discoveredClues,
          mentionedCharacters: []
        })
      })
        .then(r => r.json())
        .then(data => {
          if (data.reply) {
            const opening: Message = {
              role: 'assistant',
              content: data.reply,
              timestamp: Date.now()
            }
            setMessages([opening])
            messagesRef.current = [opening]
            lastContextRef.current = ''
          }
          setIsLoading(false)
        })
        .catch(() => setIsLoading(false))
    } else {
      const intro: Message = {
        role: 'assistant',
        content: character.intro,
        timestamp: Date.now()
      }
      setMessages([intro])
      messagesRef.current = [intro]
    }
  }, [locationId, characterId, character])

  useEffect(() => {
    const handleUnload = () => {
      const currentMessages = messagesRef.current
      if (currentMessages.length === 0) return

      const savedEncounters = localStorage.getItem(`recit_encounters_${locationId}_${characterId}`)
      const previousEncounters = savedEncounters ? parseInt(savedEncounters) : 0
      localStorage.setItem(
        `recit_encounters_${locationId}_${characterId}`,
        (previousEncounters + 1).toString()
      )

      const lastExchange = currentMessages.slice(-8)
      const summary = lastExchange
        .map(m => `${m.role === 'user' ? 'Lecteur' : characterRef.current?.name}: ${m.content}`)
        .join('\n')
      localStorage.setItem(`recit_last_context_${locationId}_${characterId}`, summary)
    }

    window.addEventListener('beforeunload', handleUnload)
    return () => window.removeEventListener('beforeunload', handleUnload)
  }, [locationId, characterId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Masquer la notification d'indice après 4 secondes
  useEffect(() => {
    if (newClueFound) {
      const timer = setTimeout(() => setNewClueFound(null), 4000)
      return () => clearTimeout(timer)
    }
  }, [newClueFound])

  function saveAndLeave() {
    const currentMessages = messagesRef.current
    if (currentMessages.length > 0) {
      const savedEncounters = localStorage.getItem(`recit_encounters_${locationId}_${characterId}`)
      const previousEncounters = savedEncounters ? parseInt(savedEncounters) : 0
      localStorage.setItem(
        `recit_encounters_${locationId}_${characterId}`,
        (previousEncounters + 1).toString()
      )
      const lastExchange = currentMessages.slice(-8)
      const summary = lastExchange
        .map(m => `${m.role === 'user' ? 'Lecteur' : characterRef.current?.name}: ${m.content}`)
        .join('\n')
      localStorage.setItem(`recit_last_context_${locationId}_${characterId}`, summary)
    }
    router.push(`/lieu/${locationId}`)
  }

  if (!character) {
    return (
      <div style={{ padding: '2rem', fontFamily: "'Raleway', sans-serif" }}>
        Personnage introuvable.
      </div>
    )
  }

  async function sendMessage() {
    if (!input.trim() || isLoading) return

    const userMessage: Message = {
      role: 'user',
      content: input.trim(),
      timestamp: Date.now()
    }

    const updatedMessages = [...messages, userMessage]
    setMessages(updatedMessages)
    setInput('')
    setIsLoading(true)

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }

    const mentionedCharacters = detectMentionedCharacters(userMessage.content)
    const lastContext = lastContextRef.current
    lastContextRef.current = ''

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locationId,
          characterId,
          messages: updatedMessages.slice(-20),
          trustLevel: trust,
          lastContext,
          discoveredClues: progress.discoveredClues,
          mentionedCharacters
        })
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
        localStorage.setItem(
          `recit_messages_${locationId}_${characterId}`,
          JSON.stringify(finalMessages)
        )

        // Lancer trust et clues en parallèle
        evaluateTrust(userMessage.content, data.reply)

        const hasAvailableClues = story.clues.some(clue =>
          clue.revealedBy === characterId &&
          trust >= clue.trustRequired &&
          !progress.discoveredClues.includes(clue.id)
        )
        if (hasAvailableClues) {
          detectClues(data.reply)
        }
      }
    } catch (error) {
      console.error('Erreur:', error)
    }

    setIsLoading(false)
  }

  async function evaluateTrust(userInput: string, characterReply: string) {
    try {
      const response = await fetch('/api/trust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locationId,
          characterId,
          userInput,
          characterReply,
          currentTrust: trust
        })
      })
      const data = await response.json()
      if (typeof data.delta === 'number') {
        const newTrust = Math.max(0, Math.min(100, trust + data.delta))
        setTrust(newTrust)
        localStorage.setItem(`recit_trust_${locationId}_${characterId}`, newTrust.toString())
      }
    } catch (error) {
      console.error('Erreur confiance:', error)
    }
  }

  async function detectClues(characterReply: string) {
    try {
      const response = await fetch('/api/clues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          characterId,
          characterReply,
          currentTrust: trust,
          alreadyDiscovered: progress.discoveredClues
        })
      })
      const data = await response.json()

      if (data.discoveredClueIds?.length > 0) {
        const newProgress = { ...progress }
        let foundNew = false

        data.discoveredClueIds.forEach((clueId: string) => {
          if (!newProgress.discoveredClues.includes(clueId)) {
            newProgress.discoveredClues.push(clueId)
            foundNew = true
          }
        })

        if (foundNew) {
          // Vérifier si une nouvelle partie est débloquée
          story.parts.forEach(part => {
            if (
              !newProgress.completedParts.includes(part.id) &&
              part.requiredClues.length > 0 &&
              part.requiredClues.every(id => newProgress.discoveredClues.includes(id))
            ) {
              newProgress.completedParts.push(part.id)
            }
          })

          setProgress(newProgress)
          saveProgress(newProgress)
          setNewClueFound('Un nouvel indice a été révélé.')
        }
      }
    } catch (error) {
      console.error('Erreur indices:', error)
    }
  }

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

  const isFirstEncounter = encounterCount <= 1

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
          fontSize: '13px',
          fontStyle: 'italic',
          padding: '0.75rem 1.5rem',
          borderRadius: '2px',
          zIndex: 100,
          opacity: 1,
          transition: 'opacity 0.5s ease'
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
            fontSize: '11px',
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
          fontSize: '22px',
          fontWeight: 300,
          color: '#1a1814'
        }}>
          {character.name}
        </span>
        <span style={{
          fontFamily: "'Cormorant Garamond', Georgia, serif",
          fontSize: '12px',
          fontStyle: 'italic',
          color: '#8a8680'
        }}>
          {isFirstEncounter ? 'première rencontre' : `rencontre ${encounterCount}`}
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
            fontSize: '11px',
            fontStyle: 'italic',
            color: '#8a8680',
            letterSpacing: '0.1em'
          }}>
            {isFirstEncounter
              ? 'Première rencontre'
              : `Rencontre ${encounterCount} — elle se souvient de vous`}
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
              fontSize: '10px',
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
                fontSize: '14px',
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
                fontSize: '10px',
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
            fontSize: '11px',
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