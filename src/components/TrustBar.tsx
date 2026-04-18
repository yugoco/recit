interface TrustBarProps {
  value: number
  characterName: string
}

export default function TrustBar({ value, characterName }: TrustBarProps) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      marginBottom: '0.75rem'
    }}>
      <span style={{
        fontFamily: "'Raleway', sans-serif",
        fontSize: '9px',
        fontWeight: 500,
        letterSpacing: '0.2em',
        textTransform: 'uppercase' as const,
        color: '#8a8680',
        width: '60px'
      }}>
        Confiance
      </span>
      <div style={{
        flex: 1,
        height: '2px',
        background: '#d4cfc6',
        borderRadius: '1px',
        overflow: 'hidden'
      }}>
        <div style={{
          height: '100%',
          width: `${value}%`,
          background: '#8b6f47',
          borderRadius: '1px',
          transition: 'width 1s ease'
        }} />
      </div>
      <span style={{
        fontFamily: "'Cormorant Garamond', Georgia, serif",
        fontSize: '11px',
        fontStyle: 'italic',
        color: '#8a8680',
        width: '30px',
        textAlign: 'right' as const
      }}>
        {value}%
      </span>
    </div>
  )
}