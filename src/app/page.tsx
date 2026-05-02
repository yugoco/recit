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
        const saved = localStorage.getItem(`recit_encounters_${character.id}`)
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

        <h1 style={{
          fontFamily: "'Cormorant Garamond', Georgia, serif",
          fontSize: 'clamp(56px, 9vw, 80px)',
          fontWeight: 300,
          letterSpacing: '-0.02em',
          lineHeight: 1,
          color: '#1a1814',
          marginBottom: '3rem'
        }}>
          Récit
        </h1>

        <div style={{
          width: '40px',
          height: '1px',
          background: '#d4cfc6',
          margin: '0 auto 2rem'
        }} />

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
                    fontSize: 'clamp(12px, 1.3vw, 13px)',
                    fontWeight: 300,
                    letterSpacing: '0.08em',
                    color: '#8a8680',
                    textTransform: 'uppercase'
                  }}>
                    {location.era}
                  </span>
                </div>
                <span style={{ fontSize: '16px', color: '#c4a882', marginLeft: '1rem' }}>→</span>
              </button>
            )
          })}
        </div>

      </div>
    </main>
  )
}
