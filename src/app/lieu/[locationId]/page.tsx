'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { getLocation } from '@/lib/locations'
import { Character } from '@/lib/types'

export default function LocationPage() {
  const params = useParams()
  const router = useRouter()
  const locationId = params.locationId as string
  const location = getLocation(locationId)

  const [encounterCounts, setEncounterCounts] = useState<Record<string, number>>({})

  useEffect(() => {
    if (!location) return
    const counts: Record<string, number> = {}
    for (const character of location.characters) {
      const key = `recit_encounters_${locationId}_${character.id}`
      const saved = localStorage.getItem(key)
      counts[character.id] = saved ? parseInt(saved) : 0
    }
    setEncounterCounts(counts)
  }, [location, locationId])

  if (!location) {
    return (
      <div style={{ padding: '2rem', fontFamily: "'Raleway', sans-serif" }}>
        Lieu introuvable.
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f7f4ef',
      fontFamily: "'Raleway', sans-serif",
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '3rem 2rem'
    }}>
      <link
        href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300;1,400&family=Raleway:wght@300;400;500&display=swap"
        rel="stylesheet"
      />

      <div style={{ maxWidth: '480px', width: '100%' }}>
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
            padding: 0,
            marginBottom: '2.5rem'
          }}
        >
          ← retour
        </button>

        <h2 style={{
          fontFamily: "'Cormorant Garamond', Georgia, serif",
          fontSize: '26px',
          fontWeight: 300,
          color: '#1a1814',
          marginBottom: '0.35rem'
        }}>
          {location.name}
        </h2>
        <p style={{
          fontFamily: "'Cormorant Garamond', Georgia, serif",
          fontSize: '13px',
          fontStyle: 'italic',
          color: '#8a8680',
          marginBottom: '2.5rem'
        }}>
          {location.era}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: '#d4cfc6' }}>
          {location.characters.map(character => {
            const encounters = encounterCounts[character.id] ?? 0
            return (
              <button
                key={character.id}
                onClick={() => {
                  if (character.available) {
                    router.push(`/lieu/${locationId}/${character.id}`)
                  }
                }}
                style={{
                  background: '#f7f4ef',
                  border: 'none',
                  padding: '1.25rem 1.5rem',
                  textAlign: 'left',
                  cursor: character.available ? 'pointer' : 'default',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  opacity: character.available ? 1 : 0.4
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <span style={{
                    fontFamily: "'Cormorant Garamond', Georgia, serif",
                    fontSize: '20px',
                    fontWeight: 400,
                    color: '#1a1814'
                  }}>
                    {character.name}
                  </span>
                  <span style={{
                    fontFamily: "'Raleway', sans-serif",
                    fontSize: '10px',
                    fontWeight: 500,
                    letterSpacing: '0.18em',
                    textTransform: 'uppercase',
                    color: '#8a8680'
                  }}>
                    {character.description}
                  </span>
                </div>
                <span style={{
                  fontFamily: "'Cormorant Garamond', Georgia, serif",
                  fontSize: '11px',
                  fontStyle: 'italic',
                  color: '#8a8680',
                  whiteSpace: 'nowrap'
                }}>
                  {!character.available
                    ? 'bientôt'
                    : encounters === 0
                    ? 'première fois'
                    : `${encounters} rencontre${encounters > 1 ? 's' : ''}`}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}