'use client'

import { useEffect, useRef, useState } from 'react'

interface TrustBarProps {
  value: number
  characterName: string
  lastDelta?: number
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

export default function TrustBar({ value, lastDelta = 0 }: TrustBarProps) {
  const activeIndex  = getStateIndex(value)
  const currentState = STATES[activeIndex]
  const [pulsing,       setPulsing]       = useState(false)
  const [signVisible,   setSignVisible]   = useState(false)
  const [signDelta,     setSignDelta]      = useState(0)
  const prevDeltaRef = useRef(0)

  useEffect(() => {
    if (lastDelta !== 0 && lastDelta !== prevDeltaRef.current) {
      prevDeltaRef.current = lastDelta
      setSignDelta(lastDelta)
      setPulsing(true)
      setSignVisible(true)
      const tPulse = setTimeout(() => setPulsing(false), 700)
      const tSign  = setTimeout(() => setSignVisible(false), 2000)
      return () => { clearTimeout(tPulse); clearTimeout(tSign) }
    }
  }, [lastDelta])

  const isPositive  = signDelta > 0
  const signLabel   = signDelta > 0 ? `+${signDelta}` : `${signDelta}`
  const pulseColor  = isPositive ? '#a88050' : '#6b5a40'

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 'clamp(8px, 1.5vw, 14px)',
      marginBottom: '0.85rem',
    }}>

      {/* Label + micro-signe inline */}
      <div style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: '5px',
        minWidth: 'clamp(60px, 8vw, 80px)',
      }}>
        <span style={{
          fontFamily: "'Cormorant Garamond', Georgia, serif",
          fontSize: 'clamp(15px, 1.6vw, 17px)',
          fontStyle: 'italic',
          color: '#4a4640',
          whiteSpace: 'nowrap',
        }}>
          {currentState.label}
        </span>

        {/* Micro-signe — même ligne, légèrement plus petit */}
        <span style={{
          fontFamily: "'Raleway', sans-serif",
          fontSize: '10px',
          fontWeight: 600,
          letterSpacing: '0.05em',
          color: isPositive ? '#6b8c5a' : '#8b5a3a',
          opacity: signVisible ? 1 : 0,
          transition: signVisible ? 'opacity 0.1s ease' : 'opacity 0.5s ease',
          userSelect: 'none',
        }}>
          {signLabel}
        </span>
      </div>

      {/* Cinq points */}
      <div style={{
        display: 'flex',
        gap: 'clamp(5px, 0.8vw, 8px)',
        alignItems: 'center',
      }}>
        {STATES.map((state, i) => {
          const isActive        = i <= activeIndex
          const isNext          = i === activeIndex + 1
          const isCurrentActive = i === activeIndex

          return (
            <div
              key={state.label}
              title={state.label}
              style={{
                width:        isActive ? 'clamp(7px, 0.9vw, 9px)' : 'clamp(5px, 0.7vw, 7px)',
                height:       isActive ? 'clamp(7px, 0.9vw, 9px)' : 'clamp(5px, 0.7vw, 7px)',
                borderRadius: '50%',
                background:   isActive
                  ? (isCurrentActive && pulsing ? pulseColor : '#8b6f47')
                  : isNext ? 'transparent' : '#d4cfc6',
                border:       isNext ? '1px solid #c4a882' : 'none',
                boxShadow:    isCurrentActive && pulsing
                  ? `0 0 0 3px ${isPositive ? 'rgba(139,111,71,0.35)' : 'rgba(90,70,45,0.35)'}`
                  : 'none',
                transition:   pulsing
                  ? 'box-shadow 0.15s ease, background 0.15s ease'
                  : 'all 0.6s ease',
                flexShrink: 0,
              }}
            />
          )
        })}
      </div>
    </div>
  )
}
