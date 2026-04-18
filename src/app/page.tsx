'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { characters } from '@/lib/characters'
import CharacterCard from '@/components/CharacterCard'

export default function Home() {
  const router = useRouter()
  const [sessionCounts, setSessionCounts] = useState<{ [key: string]: number }>({})

  useEffect(() => {
    const counts: { [key: string]: number } = {}
    characters.forEach(c => {
      const saved = localStorage.getItem(`recit_sessions_${c.id}`)
      counts[c.id] = saved ? parseInt(saved) : 0
    })
    setSessionCounts(counts)
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
          fontSize: '11px',
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
          fontSize: '64px',
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
          fontSize: '17px',
          fontWeight: 300,
          fontStyle: 'italic',
          color: '#4a4640',
          lineHeight: 1.6,
          marginBottom: '3rem'
        }}>
          Chaque personnage porte une histoire.<br />
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
          fontSize: '10px',
          fontWeight: 500,
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
          color: '#8a8680',
          marginBottom: '1rem'
        }}>
          Personnages
        </p>

        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          marginBottom: '2.5rem'
        }}>
          {characters.map(character => (
            <CharacterCard
              key={character.id}
              character={character}
              sessionCount={sessionCounts[character.id] || 0}
              onClick={() => router.push(`/conversation/${character.id}`)}
            />
          ))}
        </div>

        <p style={{
          fontFamily: "'Cormorant Garamond', Georgia, serif",
          fontSize: '13px',
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