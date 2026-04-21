import { Message } from '@/lib/types'

interface MessageBubbleProps {
  message: Message
  characterName: string
}

/**
 * Détecte si une ligne est une réplique de dialogue (commence par —)
 * pour lui appliquer le retrait typographique français.
 */
function isDialogueLine(text: string): boolean {
  return text.trimStart().startsWith('—')
}

export default function MessageBubble({ message, characterName }: MessageBubbleProps) {
  const isChar = message.role === 'assistant'
  const paragraphs = message.content.split('\n').filter(p => p.trim())

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
          const isLast = i === paragraphs.length - 1

          if (!isChar) {
            return (
              <p
                key={i}
                style={{
                  fontFamily: "'Raleway', sans-serif",
                  fontSize: 'clamp(15px, 1.6vw, 16px)',
                  fontWeight: 300,
                  lineHeight: 1.7,
                  color: '#4a4640',
                  fontStyle: 'italic',
                  marginBottom: isLast ? 0 : '0.5rem'
                }}
              >
                {para}
              </p>
            )
          }

          // Personnage — romain uniforme, convention roman français
          const isDialogue = isDialogueLine(para)

          return (
            <p
              key={i}
              style={{
                fontFamily: "'Cormorant Garamond', Georgia, serif",
                fontSize: 'clamp(19px, 2.2vw, 22px)',
                fontWeight: 300,
                lineHeight: 1.8,
                color: '#1a1814',
                fontStyle: 'normal',
                paddingLeft: isDialogue ? '1em' : 0,
                textIndent: isDialogue ? '-1em' : 0,
                marginBottom: isLast ? 0 : '0.6rem'
              }}
            >
              {para}
            </p>
          )
        })}
      </div>
    </div>
  )
}
