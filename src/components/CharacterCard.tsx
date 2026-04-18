import { Character } from '@/lib/types'

interface CharacterCardProps {
  character: Character
  sessionCount: number
  onClick: () => void
}

export default function CharacterCard({ character, sessionCount, onClick }: CharacterCardProps) {
  const sessionLabel = sessionCount === 0
    ? 'première rencontre'
    : sessionCount === 1
    ? 'une rencontre'
    : `${sessionCount} rencontres`

  if (!character.available) {
    return (
      <div style={{
        background: '#ede9e2',
        border: '1px solid #d4cfc6',
        borderRadius: '3px',
        padding: '1rem 1.25rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        opacity: 0.45,
        cursor: 'not-allowed'
      }}>
        <div>
          <span style={{
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            fontSize: '20px',
            fontWeight: 400,
            color: '#1a1814',
            display: 'block',
            marginBottom: '2px'
          }}>
            {character.name}
          </span>
          <span style={{
            fontFamily: "'Raleway', sans-serif",
            fontSize: '11px',
            fontWeight: 300,
            letterSpacing: '0.05em',
            color: '#8a8680',
            textTransform: 'uppercase' as const
          }}>
            {character.description} · {character.era} · {character.location}
          </span>
        </div>
        <span style={{
          fontSize: '10px',
          fontFamily: "'Raleway', sans-serif",
          letterSpacing: '0.1em',
          textTransform: 'uppercase' as const,
          color: '#8a8680',
          background: '#d4cfc6',
          padding: '2px 8px',
          borderRadius: '2px',
          marginLeft: '1rem'
        }}>
          bientôt
        </span>
      </div>
    )
  }

  return (
    <div
      onClick={onClick}
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
      <div style={{ flex: 1 }}>
        <span style={{
          fontFamily: "'Cormorant Garamond', Georgia, serif",
          fontSize: '20px',
          fontWeight: 400,
          color: '#1a1814',
          display: 'block',
          marginBottom: '2px'
        }}>
          {character.name}
        </span>
        <span style={{
          fontFamily: "'Raleway', sans-serif",
          fontSize: '11px',
          fontWeight: 300,
          letterSpacing: '0.05em',
          color: '#8a8680',
          textTransform: 'uppercase' as const
        }}>
          {character.description} · {character.era} · {character.location}
        </span>
      </div>
      <span style={{
        fontFamily: "'Cormorant Garamond', Georgia, serif",
        fontSize: '12px',
        fontStyle: 'italic',
        color: '#8a8680',
        marginRight: '1rem'
      }}>
        {sessionLabel}
      </span>
      <span style={{ fontSize: '16px', color: '#c4a882' }}>→</span>
    </div>
  )
}