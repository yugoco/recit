'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { getCharacter } from '@/lib/characters'
import { Message } from '@/lib/types'
import MessageBubble from '@/components/MessageBubble'
import TrustBar from '@/components/TrustBar'

export default function ConversationPage() {
  const params = useParams()
  const router = useRouter()
  const characterId = params.characterId as string
  const character = getCharacter(characterId)

  const [messages, setMessages] = useState<Message[]>([])
  const [trust, setTrust] = useState(10)
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [sessionCount, setSessionCount] = useState(0)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!character) return

    const savedMessages = localStorage.getItem(`recit_messages_${characterId}`)
    const savedTrust = localStorage.getItem(`recit_trust_${characterId}`)
    const savedSessions = localStorage.getItem(`recit_sessions_${characterId}`)

    const trust = savedTrust ? parseInt(savedTrust) : 10
    const sessions = savedSessions ? parseInt(savedSessions) : 0

    setTrust(trust)
    setSessionCount(sessions)

    if (savedMessages) {
      const parsed = JSON.parse(savedMessages)
      setMessages(parsed)
    } else {
      const intro: Message = {
        role: 'assistant',
        content: character.intro,
        timestamp: Date.now()
      }
      setMessages([intro])
      localStorage.setItem(`recit_messages_${characterId}`, JSON.stringify([intro]))
    }

    localStorage.setItem(`recit_sessions_${characterId}`, (sessions + 1).toString())
  }, [characterId, character])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

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

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          characterId,
          messages: updatedMessages.slice(-20),
          trustLevel: trust
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
          `recit_messages_${characterId}`,
          JSON.stringify(finalMessages)
        )

        const newTrust = Math.min(100, trust + Math.floor(Math.random() * 4) + 1)
        setTrust(newTrust)
        localStorage.setItem(`recit_trust_${characterId}`, newTrust.toString())
      }
    } catch (error) {
      console.error('Erreur:', error)
    }

    setIsLoading(false)
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

  const isFirstSession = sessionCount <= 1

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
          onClick={() => router.push('/')}
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
          ← retour
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
          session {sessionCount}
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
            {isFirstSession ? 'Première rencontre' : `Session ${sessionCount} — elle se souvient de vous`}
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