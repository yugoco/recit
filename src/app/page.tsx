'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { locations } from '@/lib/locations'

export default function Home() {
  const router = useRouter()
  const [encounterCounts, setEncounterCounts] = useState<Record<string, Record<string, number>>>({})

  useEffect(() => {
    const counts: Record<string, Record<string, number>> = {}
    locations.forEach(location => {
      counts[location.id] = {}
      location.characters.forEach(character => {
        const saved = localStorage.getItem(`recit_encounters_${location.id}_${character.id}`)
        counts[location.id][character.id] = saved ? parseInt(saved) : 0
      })
    })
    setEncounterCounts(counts)
  }, [])

  return (
    <main style={{
      minHeight: '100vh',
      background: '#f7f4ef',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '3rem 2rem'
    }}>
      <link
        href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300;1,400&family=Raleway:wght@300;400;500&display=swap"
        rel="stylesheet"
      />

      <div style={{ maxWidth: '480px', width: '100%', textAlign: 'center' }}>

        <p style={{
          fontFamily: "'Raleway', sans-serif",
          fontSize: 'clamp(13px, 1.4vw, 14px)',
          fontWeight: 400,
          letterSpacing: '0.25em',
          textTransform: 'uppercase',
          color: '#8b6f47',
          marginBottom: '1.5rem'
        }}>
          Un nouveau médium narratif
        </p>

        <h1 style={{
          fontFamily: "'Cormorant Garamond', Georgia, serif",
          fontSize: 'clamp(44px, 7vw, 64px)',
          fontWeight: 300,
          letterSpacing: '-0.02em',
          lineHeight: 1,
          color: '#1a1814',
          marginBottom: '1rem'
        }}>
          Récit
        </h1>

        <p style={{
          fontFamily: "'Cormorant Garamond', Georgia, serif",
          fontSize: 'clamp(16px, 1.9vw, 19px)',
          fontWeight: 300,
          fontStyle: 'italic',
          color: '#4a4640',
          lineHeight: 1.6,
          marginBottom: '3rem'
        }}>
          Chaque lieu cache une histoire.<br />
          C'est à vous de la trouver.
        </p>

        <div style={{
          width: '40px',
          height: '1px',
          background: '#d4cfc6',
          margin: '0 auto 2rem'
        }} />

        <p style={{
          fontFamily: "'Raleway', sans-serif",
          fontSize: 'clamp(13px, 1.4vw, 14px)',
          fontWeight: 500,
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
          color: '#8a8680',
          marginBottom: '1rem'
        }}>
          Lieux
        </p>

        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          marginBottom: '2.5rem'
        }}>
          {locations.map(location => {
            const characterCount = location.characters.filter(c => c.available).length
            return (
              <button
                key={location.id}
                onClick={() => router.push(`/lieu/${location.id}`)}
                style={{
                  background: '#ede9e2',
                  border: '1px solid #d4cfc6',
                  borderRadius: '3px',
                  padding: '1rem 1.25rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  transition: 'border-color 0.2s, background 0.2s',
                  textAlign: 'left'
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = '#c4a882'
                  ;(e.currentTarget as HTMLButtonElement).style.background = '#f0ece4'
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = '#d4cfc6'
                  ;(e.currentTarget as HTMLButtonElement).style.background = '#ede9e2'
                }}
              >
                <div style={{ flex: 1 }}>
                  <span style={{
                    fontFamily: "'Cormorant Garamond', Georgia, serif",
                    fontSize: 'clamp(18px, 2.1vw, 22px)',
                    fontWeight: 400,
                    color: '#1a1814',
                    display: 'block',
                    marginBottom: '2px'
                  }}>
                    {location.name}
                  </span>
                  <span style={{
                    fontFamily: "'Raleway', sans-serif",
                    fontSize: 'clamp(13px, 1.4vw, 14px)',
                    fontWeight: 300,
                    letterSpacing: '0.05em',
                    color: '#8a8680',
                    textTransform: 'uppercase'
                  }}>
                    {location.era}
                  </span>
                </div>
                <span style={{
                  fontFamily: "'Cormorant Garamond', Georgia, serif",
                  fontSize: 'clamp(14px, 1.5vw, 16px)',
                  fontStyle: 'italic',
                  color: '#8a8680',
                  marginRight: '1rem',
                  whiteSpace: 'nowrap'
                }}>
                  {`${characterCount} personnage${characterCount > 1 ? 's' : ''}`}
                </span>
                <span style={{ fontSize: '16px', color: '#c4a882' }}>→</span>
              </button>
            )
          })}
        </div>

        <p style={{
          fontFamily: "'Cormorant Garamond', Georgia, serif",
          fontSize: 'clamp(14px, 1.5vw, 16px)',
          fontStyle: 'italic',
          color: '#8a8680',
          lineHeight: 1.7
        }}>
          Certaines vérités ne se révèlent qu'avec le temps.<br />
          Revenez. Elle se souviendra.
        </p>

      </div>
    </main>
  )
}
