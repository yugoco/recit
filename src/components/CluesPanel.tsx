'use client'

import { useState } from 'react'
import { locations } from '@/lib/locations'
import { story } from '@/lib/story'

// ─── Types ────────────────────────────────────────────────────────────────────

interface CluesPanelProps {
  open: boolean
  onClose: () => void
  discoveredClueIds: string[]
}

// ─── Bouton déclencheur ───────────────────────────────────────────────────────

interface CluesButtonProps {
  clueCount: number
  onClick: () => void
  variant?: 'text' | 'icon'  // 'text' pour la page d'accueil, 'icon' pour la conversation
}

export function CluesButton({ clueCount, onClick, variant = 'text' }: CluesButtonProps) {
  if (variant === 'icon') {
    return (
      <button
        onClick={onClick}
        title="Voir mes indices"
        style={{
          fontFamily: "'Raleway', sans-serif",
          fontSize: '13px', fontWeight: 500,
          letterSpacing: '0.15em', textTransform: 'uppercase',
          color: '#8b6f47', background: 'none',
          border: '1px solid #d4cfc6', borderRadius: '2px',
          padding: '0.75rem 1rem',
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          height: '44px',
          display: 'flex', alignItems: 'center', gap: '6px',
          opacity: 1,
        }}
      >
        <span style={{ fontSize: '14px', lineHeight: 1 }}>⊙</span>
        {clueCount > 0 && (
          <span style={{
            fontFamily: "'Raleway', sans-serif",
            fontSize: '10px', fontWeight: 500,
            color: '#8b6f47', background: '#f0e8d8',
            padding: '1px 5px', borderRadius: '2px',
            letterSpacing: '0.05em',
          }}>
            {clueCount}
          </span>
        )}
      </button>
    )
  }

  // variant === 'text' (page d'accueil)
  return (
    <button
      onClick={onClick}
      style={{
        fontFamily: "'Raleway', sans-serif",
        fontSize: 'clamp(11px, 1.2vw, 12px)', fontWeight: 400,
        letterSpacing: '0.15em', textTransform: 'uppercase',
        color: '#8a8680',
        background: 'none', border: 'none', cursor: 'pointer', padding: 0,
        display: 'flex', alignItems: 'center', gap: '6px',
      }}
    >
      indices
      {clueCount > 0 && (
        <span style={{
          fontFamily: "'Raleway', sans-serif",
          fontSize: '10px', fontWeight: 500,
          color: '#8b6f47', background: '#f0e8d8',
          padding: '1px 6px', borderRadius: '2px',
          letterSpacing: '0.05em',
        }}>
          {clueCount}
        </span>
      )}
    </button>
  )
}

// ─── Panneau ──────────────────────────────────────────────────────────────────

export function CluesPanel({ open, onClose, discoveredClueIds }: CluesPanelProps) {
  const allClues = story.clues.filter(c => discoveredClueIds.includes(c.id))

  // Grouper par personnage (revealedBy)
  const byCharacter: Record<string, { name: string; clues: typeof allClues }> = {}
  for (const clue of allClues) {
    if (!byCharacter[clue.revealedBy]) {
      let charName = clue.revealedBy
      for (const loc of locations) {
        const found = loc.characters.find(c => c.id === clue.revealedBy)
        if (found) { charName = found.name; break }
      }
      byCharacter[clue.revealedBy] = { name: charName, clues: [] }
    }
    byCharacter[clue.revealedBy].clues.push(clue)
  }

  const groups = Object.values(byCharacter)
  const hasClues = groups.length > 0

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(26,24,20,0.45)',
          zIndex: 400,
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transition: 'opacity 0.3s ease',
        }}
      />

      {/* Panneau */}
      <div
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0,
          width: 'min(380px, 92vw)',
          background: '#f7f4ef',
          borderLeft: '1px solid #d4cfc6',
          zIndex: 401,
          transform: open ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
          display: 'flex', flexDirection: 'column',
          overflowY: 'auto',
        }}
      >
        {/* En-tête */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '1.75rem 1.75rem 1.25rem',
          borderBottom: '1px solid #e8e4dd',
          position: 'sticky', top: 0, background: '#f7f4ef', zIndex: 1,
        }}>
          <span style={{
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            fontSize: 'clamp(20px, 2.2vw, 24px)', fontWeight: 300,
            color: '#1a1814', letterSpacing: '-0.01em',
          }}>
            Indices
          </span>
          <button
            onClick={onClose}
            style={{
              fontFamily: "'Raleway', sans-serif",
              fontSize: '18px', fontWeight: 300,
              color: '#8a8680', background: 'none', border: 'none',
              cursor: 'pointer', lineHeight: 1, padding: '4px',
            }}
          >
            ✕
          </button>
        </div>

        {/* Contenu */}
        <div style={{ padding: '1.5rem 1.75rem', flex: 1 }}>
          {!hasClues ? (
            <p style={{
              fontFamily: "'Cormorant Garamond', Georgia, serif",
              fontSize: 'clamp(15px, 1.6vw, 17px)', fontWeight: 300,
              fontStyle: 'italic', color: '#8a8680', lineHeight: 1.7,
              marginTop: '0.5rem',
            }}>
              Vous n'avez encore rien découvert.<br />
              Les indices s'accumulent au fil des conversations.
            </p>
          ) : (
            groups.map(group => (
              <div key={group.name} style={{ marginBottom: '2rem' }}>
                <p style={{
                  fontFamily: "'Raleway', sans-serif",
                  fontSize: '11px', fontWeight: 500,
                  letterSpacing: '0.2em', textTransform: 'uppercase',
                  color: '#c4a882', marginBottom: '0.85rem',
                }}>
                  {group.name}
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {group.clues.map(clue => (
                    <p
                      key={clue.id}
                      style={{
                        fontFamily: "'Cormorant Garamond', Georgia, serif",
                        fontSize: 'clamp(14px, 1.5vw, 16px)', fontWeight: 300,
                        color: '#1a1814', lineHeight: 1.65,
                        paddingLeft: '0.85rem',
                        borderLeft: '2px solid #e8e4dd',
                        margin: 0,
                      }}
                    >
                      {clue.content}
                    </p>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Compteur en bas */}
        {hasClues && (
          <div style={{
            padding: '1rem 1.75rem',
            borderTop: '1px solid #e8e4dd',
            fontFamily: "'Raleway', sans-serif",
            fontSize: '11px', fontWeight: 400,
            letterSpacing: '0.15em', textTransform: 'uppercase',
            color: '#8a8680',
          }}>
            {discoveredClueIds.length} indice{discoveredClueIds.length > 1 ? 's' : ''} découvert{discoveredClueIds.length > 1 ? 's' : ''}
          </div>
        )}
      </div>
    </>
  )
}
