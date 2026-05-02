'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { getLocation } from '@/lib/locations'
import { initDiegeticTime, isWithinSchedule, storageKeys } from '@/lib/time'

function encounterLabel(count: number): string {
  if (count === 0) return 'inconnu·e'
  return `${count} visite${count > 1 ? 's' : ''}`
}

export default function LocationPage() {
  const params     = useParams()
  const router     = useRouter()
  const locationId = params.locationId as string
  const location   = getLocation(locationId)

  const [encounterCounts, setEncounterCounts] = useState<Record<string, number>>({})
  const [locationOpen,    setLocationOpen]    = useState(true)

  useEffect(() => {
    if (!location) return

    initDiegeticTime()

    if (location.schedule) {
      const { openHour, closeHour } = location.schedule
      setLocationOpen(isWithinSchedule(openHour, closeHour))
    }

    const counts: Record<string, number> = {}
    location.characters.forEach(character => {
      const saved = localStorage.getItem(storageKeys.encounters(character.id))
      counts[character.id] = saved ? parseInt(saved) : 0
    })
    setEncounterCounts(counts)
  }, [location, locationId])

  if (!location) {
    return <div style={{ padding: '2rem', fontFamily: "'Raleway', sans-serif" }}>Lieu introuvable.</div>
  }

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

        <button
          onClick={() => router.push('/')}
          style={{
            fontFamily: "'Raleway', sans-serif",
            fontSize: 'clamp(13px, 1.4vw, 14px)',
            fontWeight: 400,
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            color: '#8a8680',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            marginBottom: '2.5rem',
            display: 'block'
          }}
        >
          ← retour
        </button>

        <h2 style={{
          fontFamily: "'Cormorant Garamond', Georgia, serif",
          fontSize: 'clamp(36px, 6vw, 56px)',
          fontWeight: 300,
          letterSpacing: '-0.02em',
          lineHeight: 1,
          color: '#1a1814',
          marginBottom: '0.75rem'
        }}>
          {location.name}
        </h2>

        <p style={{
          fontFamily: "'Raleway', sans-serif",
          fontSize: 'clamp(12px, 1.3vw, 13px)',
          fontWeight: 300,
          letterSpacing: '0.08em',
          color: '#8a8680',
          textTransform: 'uppercase',
          marginBottom: '1rem'
        }}>
          {location.era}
        </p>

        {!locationOpen && location.schedule?.closedMessage && (
          <p style={{
            fontFamily: "'Raleway', sans-serif",
            fontSize: 'clamp(13px, 1.4vw, 14px)',
            fontWeight: 400,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: '#8b6f47',
            marginBottom: '1rem'
          }}>
            {location.schedule.closedMessage}
          </p>
        )}

        <p style={{
          fontFamily: "'Cormorant Garamond', Georgia, serif",
          fontSize: 'clamp(16px, 1.9vw, 19px)',
          fontWeight: 300,
          fontStyle: 'italic',
          color: '#4a4640',
          lineHeight: 1.6,
          marginBottom: '3rem'
        }}>
          {location.description}
        </p>

        <div style={{ width: '40px', height: '1px', background: '#d4cfc6', margin: '0 auto 2rem' }} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {location.characters.map(character => {
            const visits = encounterCounts[character.id] ?? 0

            const charScheduleOpen = character.schedule
              ? isWithinSchedule(character.schedule.openHour, character.schedule.closeHour)
              : true

            const isUnavailable = !character.available || !charScheduleOpen

            if (isUnavailable) {
              const badgeText = !character.available
                ? (character.unavailableReason ?? 'absent·e')
                : (character.schedule?.closedMessage ?? 'absent·e')

              return (
                <div
                  key={character.id}
                  style={{
                    background: '#ede9e2',
                    border: '1px solid #d4cfc6',
                    borderRadius: '3px',
                    padding: '1rem 1.25rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    opacity: 0.45,
                    cursor: 'not-allowed'
                  }}
                >
                  <div>
                    <span style={{
                      fontFamily: "'Cormorant Garamond', Georgia, serif",
                      fontSize: 'clamp(18px, 2.1vw, 22px)',
                      fontWeight: 400,
                      color: '#1a1814',
                      display: 'block',
                      marginBottom: '2px'
                    }}>
                      {character.name}
                    </span>
                    <span style={{
                      fontFamily: "'Raleway', sans-serif",
                      fontSize: 'clamp(12px, 1.3vw, 13px)',
                      fontWeight: 300,
                      letterSpacing: '0.05em',
                      color: '#8a8680',
                      textTransform: 'uppercase' as const
                    }}>
                      {character.description}
                    </span>
                  </div>
                  <span style={{
                    fontSize: 'clamp(12px, 1.3vw, 13px)',
                    fontFamily: "'Raleway', sans-serif",
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase' as const,
                    color: '#8a8680',
                    background: '#d4cfc6',
                    padding: '2px 8px',
                    borderRadius: '2px',
                    marginLeft: '1rem',
                    whiteSpace: 'nowrap' as const
                  }}>
                    {badgeText}
                  </span>
                </div>
              )
            }

            return (
              <div
                key={character.id}
                onClick={() => router.push(`/lieu/${locationId}/${character.id}`)}
                style={{
                  background: '#ede9e2',
                  border: '1px solid #d4cfc6',
                  borderRadius: '3px',
                  padding: '1rem 1.25rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  transition: 'border-color 0.2s, background 0.2s'
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = '#c4a882'
                  ;(e.currentTarget as HTMLDivElement).style.background = '#f0ece4'
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = '#d4cfc6'
                  ;(e.currentTarget as HTMLDivElement).style.background = '#ede9e2'
                }}
              >
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <span style={{
                    fontFamily: "'Cormorant Garamond', Georgia, serif",
                    fontSize: 'clamp(18px, 2.1vw, 22px)',
                    fontWeight: 400,
                    color: '#1a1814',
                    display: 'block',
                    marginBottom: '2px'
                  }}>
                    {character.name}
                  </span>
                  <span style={{
                    fontFamily: "'Raleway', sans-serif",
                    fontSize: 'clamp(12px, 1.3vw, 13px)',
                    fontWeight: 300,
                    letterSpacing: '0.05em',
                    color: '#8a8680',
                    textTransform: 'uppercase' as const
                  }}>
                    {character.description}
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
                  {encounterLabel(visits)}
                </span>
                <span style={{ fontSize: '16px', color: '#c4a882' }}>→</span>
              </div>
            )
          })}
        </div>

      </div>
    </main>
  )
}
