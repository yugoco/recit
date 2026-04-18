'use client'

import { useRouter } from 'next/navigation'
import { locations } from '@/lib/locations'

export default function HomePage() {
  const router = useRouter()

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
        <h1 style={{
          fontFamily: "'Cormorant Garamond', Georgia, serif",
          fontSize: '32px',
          fontWeight: 300,
          color: '#1a1814',
          marginBottom: '0.5rem',
          letterSpacing: '0.02em'
        }}>
          Récit
        </h1>
        <p style={{
          fontFamily: "'Cormorant Garamond', Georgia, serif",
          fontSize: '14px',
          fontStyle: 'italic',
          color: '#8a8680',
          marginBottom: '3rem'
        }}>
          Choisissez un lieu.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: '#d4cfc6' }}>
          {locations.map(location => (
            <button
              key={location.id}
              onClick={() => router.push(`/lieu/${location.id}`)}
              style={{
                background: '#f7f4ef',
                border: 'none',
                padding: '1.5rem',
                textAlign: 'left',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.35rem'
              }}
            >
              <span style={{
                fontFamily: "'Cormorant Garamond', Georgia, serif",
                fontSize: '20px',
                fontWeight: 400,
                color: '#1a1814'
              }}>
                {location.name}
              </span>
              <span style={{
                fontFamily: "'Raleway', sans-serif",
                fontSize: '11px',
                fontWeight: 400,
                letterSpacing: '0.12em',
                color: '#8a8680'
              }}>
                {location.era}
              </span>
              <span style={{
                fontFamily: "'Cormorant Garamond', Georgia, serif",
                fontSize: '13px',
                fontStyle: 'italic',
                color: '#8a8680',
                marginTop: '0.1rem'
              }}>
                {location.description}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}