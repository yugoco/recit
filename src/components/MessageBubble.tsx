import { Message } from '@/lib/types'

interface MessageBubbleProps {
  message: Message
  characterName: string
}

export default function MessageBubble({ message, characterName }: MessageBubbleProps) {
  const isChar = message.role === 'assistant'

  return (
    <div style={{
      marginBottom: '2rem',
      textAlign: isChar ? 'left' : 'right'
    }}>
      <div style={{
        fontFamily: "'Raleway', sans-serif",
        fontSize: '10px',
        fontWeight: 500,
        letterSpacing: '0.2em',
        textTransform: 'uppercase',
        color: '#8a8680',
        marginBottom: '0.4rem'
      }}>
        {isChar ? characterName.toUpperCase() : 'VOUS'}
      </div>
      <div style={{
        display: 'inline-block',
        maxWidth: '80%',
        textAlign: 'left'
      }}>
        {message.content.split('\n\n').map((para, i) => (
          <p key={i} style={{
            fontFamily: isChar
              ? "'Cormorant Garamond', Georgia, serif"
              : "'Raleway', sans-serif",
            fontSize: isChar ? '18px' : '13px',
            fontWeight: 300,
            lineHeight: isChar ? 1.75 : 1.7,
            color: isChar ? '#1a1814' : '#4a4640',
            fontStyle: isChar ? 'normal' : 'italic',
            marginBottom: i < message.content.split('\n\n').length - 1 ? '0.75rem' : '0'
          }}>
            {para}
          </p>
        ))}
      </div>
    </div>
  )
}