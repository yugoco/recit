interface TrustBarProps {
  value: number
  characterName: string
}

const STATES = [
  { label: 'distante',  threshold: 0  },
  { label: 'réservée',  threshold: 25 },
  { label: 'attentive', threshold: 45 },
  { label: 'présente',  threshold: 65 },
  { label: 'confiante', threshold: 82 },
]

function getStateIndex(value: number): number {
  let index = 0
  for (let i = 0; i < STATES.length; i++) {
    if (value >= STATES[i].threshold) index = i
  }
  return index
}

export default function TrustBar({ value }: TrustBarProps) {
  const activeIndex = getStateIndex(value)
  const currentState = STATES[activeIndex]

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 'clamp(8px, 1.5vw, 14px)',
      marginBottom: '0.85rem'
    }}>
      {/* Label état actuel */}
      <span style={{
        fontFamily: "'Cormorant Garamond', Georgia, serif",
        fontSize: 'clamp(15px, 1.6vw, 17px)',
        fontStyle: 'italic',
        color: '#4a4640',
        minWidth: 'clamp(60px, 8vw, 80px)',
        whiteSpace: 'nowrap'
      }}>
        {currentState.label}
      </span>

      {/* Cinq points — un par état */}
      <div style={{
        display: 'flex',
        gap: 'clamp(5px, 0.8vw, 8px)',
        alignItems: 'center'
      }}>
        {STATES.map((state, i) => {
          const isActive = i <= activeIndex
          const isNext = i === activeIndex + 1

          return (
            <div
              key={state.label}
              title={state.label}
              style={{
                width:  isActive ? 'clamp(7px, 0.9vw, 9px)' : 'clamp(5px, 0.7vw, 7px)',
                height: isActive ? 'clamp(7px, 0.9vw, 9px)' : 'clamp(5px, 0.7vw, 7px)',
                borderRadius: '50%',
                background: isActive
                  ? '#8b6f47'
                  : isNext
                  ? 'transparent'
                  : '#d4cfc6',
                border: isNext
                  ? '1px solid #c4a882'
                  : 'none',
                transition: 'all 0.6s ease',
                flexShrink: 0
              }}
            />
          )
        })}
      </div>
    </div>
  )
}
