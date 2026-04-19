import { Message } from '@/lib/types'

interface MessageBubbleProps {
  message: Message
  characterName: string
}

/**
 * Segmente un paragraphe en parties textuelles et narratives.
 * Les passages entre astérisques (*comme ceci*) deviennent du texte
 * narratif en italique — traitement identique à une didascalie de roman.
 */
function parseSegments(text: string): { content: string; isAction: boolean }[] {
  const segments: { content: string; isAction: boolean }[] = []
  const regex = /\*([^*]+)\*/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ content: text.slice(lastIndex, match.index), isAction: false })
    }
    segments.push({ content: match[1], isAction: true })
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < text.length) {
    segments.push({ content: text.slice(lastIndex), isAction: false })
  }

  return segments
}

export default function MessageBubble({ message, characterName }: MessageBubbleProps) {
  const isChar = message.role === 'assistant'
  const paragraphs = message.content.split('\n\n')

  return (
    <div style={{
      marginBottom: '2.25rem',
      textAlign: isChar ? 'left' : 'right'
    }}>
      {/* Label auteur */}
      <div style={{
        fontFamily: "'Raleway', sans-serif",
        fontSize: 'clamp(13px, 1.4vw, 14px)',
        fontWeight: 500,
        letterSpacing: '0.18em',
        textTransform: 'uppercase',
        color: '#8a8680',
        marginBottom: '0.5rem'
      }}>
        {isChar ? characterName.toUpperCase() : 'VOUS'}
      </div>

      {/* Contenu */}
      <div style={{
        display: 'inline-block',
        maxWidth: '82%',
        textAlign: 'left'
      }}>
        {paragraphs.map((para, i) => {
          const segments = parseSegments(para)
          const isLast = i === paragraphs.length - 1

          return (
            <p
              key={i}
              style={{
                fontFamily: isChar
                  ? "'Cormorant Garamond', Georgia, serif"
                  : "'Raleway', sans-serif",
                fontSize: isChar
                  ? 'clamp(19px, 2.2vw, 22px)'
                  : 'clamp(15px, 1.6vw, 16px)',
                fontWeight: 300,
                lineHeight: isChar ? 1.8 : 1.7,
                color: isChar ? '#1a1814' : '#4a4640',
                fontStyle: isChar ? 'normal' : 'italic',
                marginBottom: isLast ? 0 : '0.8rem'
              }}
            >
              {isChar
                ? segments.map((seg, j) => (
                    <span
                      key={j}
                      style={{
                        fontStyle: seg.isAction ? 'italic' : 'normal',
                        color: seg.isAction ? '#6b6560' : '#1a1814'
                      }}
                    >
                      {seg.content}
                    </span>
                  ))
                : para
              }
            </p>
          )
        })}
      </div>
    </div>
  )
}
