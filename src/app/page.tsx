'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { locations } from '@/lib/locations'
import { story } from '@/lib/story'
import { storageKeys } from '@/lib/time'
import { API_KEY_STORAGE_KEY, ReaderProgress } from '@/lib/types'

// ─── Titre ────────────────────────────────────────────────────────────────────
// const TITRE = 'Les recettes du Sud-Ouest'
const TITRE = 'La recette des honnêtes gens'
// const TITRE = 'Le livre de recettes'
// const TITRE = 'Comment réussir dans le Sud-Ouest'
// const TITRE = 'Les ingrédients'

// ─── Texte aide ───────────────────────────────────────────────────────────────

const helpTextStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', Georgia, serif",
  fontSize: 'clamp(15px, 1.7vw, 18px)', fontWeight: 300,
  color: '#1a1814', lineHeight: 1.75,
  marginBottom: '1.5rem',
}

function ApiKeyHelp() {
  const linkStyle: React.CSSProperties = {
    color: '#8b6f47', textDecoration: 'underline', cursor: 'pointer',
  }
  return (
    <div style={helpTextStyle}>
      <p style={{ marginBottom: '1rem' }}>
        Pour explorer le récit, vous avez besoin d'une clé API Anthropic.
      </p>
      <p style={{ marginBottom: '0.5rem' }}>Comment l'obtenir :</p>
      <ol style={{ paddingLeft: '1.25rem', marginBottom: '1rem' }}>
        <li>Créez un compte sur{' '}
          <a href="https://console.anthropic.com" target="_blank" rel="noopener noreferrer" style={linkStyle}>
            console.anthropic.com
          </a>
        </li>
        <li>Dans le menu, allez dans "API Keys"</li>
        <li>Cliquez "Create Key" et copiez la clé (commence par sk-ant-)</li>
      </ol>
      <p style={{ marginBottom: '0.5rem' }}>
        Votre clé est stockée uniquement dans votre navigateur.{' '}
        Elle ne passe par aucun serveur — les conversations avec les personnages se font directement entre votre navigateur et Anthropic.
      </p>
      <p>
        Coût estimé : environ 1 $ par heure de jeu.
      </p>
    </div>
  )
}

// ─── Reset — n'efface PAS la clé API ─────────────────────────────────────────

function resetAllProgress(): void {
  const keys: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (k && k.startsWith('recit_') && k !== API_KEY_STORAGE_KEY) keys.push(k)
  }
  keys.forEach(k => localStorage.removeItem(k))
}

function loadProgress(): ReaderProgress {
  try {
    const saved = localStorage.getItem(storageKeys.progress())
    return saved
      ? JSON.parse(saved)
      : { discoveredClues: [], completedParts: [], isStoryComplete: false }
  } catch {
    return { discoveredClues: [], completedParts: [], isStoryComplete: false }
  }
}

function saveProgress(p: ReaderProgress) {
  localStorage.setItem(storageKeys.progress(), JSON.stringify(p))
}

// ─── Panneau indices ──────────────────────────────────────────────────────────

interface CluesPanelProps {
  open: boolean
  onClose: () => void
  discoveredClueIds: string[]
}

function CluesPanel({ open, onClose, discoveredClueIds }: CluesPanelProps) {
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

// ─── Composant principal ──────────────────────────────────────────────────────

export default function Home() {
  const router = useRouter()

  const [apiKey,          setApiKey]          = useState('')
  const [apiKeyInput,     setApiKeyInput]      = useState('')
  const [showApiModal,    setShowApiModal]     = useState(false)
  const [showHelpModal,   setShowHelpModal]    = useState(false)
  const [showResetModal,  setShowResetModal]   = useState(false)
  const [showCluesPanel,  setShowCluesPanel]   = useState(false)
  const [apiKeySaved,     setApiKeySaved]      = useState(false)
  const [resetDone,       setResetDone]        = useState(false)
  const [progress,        setProgress]         = useState<ReaderProgress>({
    discoveredClues: [], completedParts: [], isStoryComplete: false,
  })

  useEffect(() => {
    const saved = localStorage.getItem(API_KEY_STORAGE_KEY) ?? ''
    setApiKey(saved)
    setApiKeyInput(saved)
    setProgress(loadProgress())
  }, [])

  function saveApiKey() {
    const trimmed = apiKeyInput.trim()
    if (!trimmed) return
    localStorage.setItem(API_KEY_STORAGE_KEY, trimmed)
    setApiKey(trimmed)
    setApiKeySaved(true)
    setTimeout(() => { setApiKeySaved(false); setShowApiModal(false) }, 1000)
  }

  function removeApiKey() {
    localStorage.removeItem(API_KEY_STORAGE_KEY)
    setApiKey('')
    setApiKeyInput('')
    setShowApiModal(false)
  }

  function confirmReset() {
    resetAllProgress()
    setShowResetModal(false)
    setResetDone(true)
    setProgress({ discoveredClues: [], completedParts: [], isStoryComplete: false })
    setTimeout(() => setResetDone(false), 2500)
  }

  function markLocationSeen(locationId: string) {
    const updated: ReaderProgress = {
      ...progress,
      newlyUnlockedLocations: (progress.newlyUnlockedLocations ?? []).filter(id => id !== locationId),
    }
    setProgress(updated)
    saveProgress(updated)
  }

  // ── Logique de verrouillage ────────────────────────────────────────────────

  function isLocationUnlocked(loc: typeof locations[0]): boolean {
    return !loc.unlockedByPart || progress.completedParts.includes(loc.unlockedByPart)
  }

  const hasKey = apiKey.length > 0
  const clueCount = progress.discoveredClues.length

  // Styles partagés
  const modalOverlay: React.CSSProperties = {
    position: 'fixed', inset: 0,
    background: 'rgba(26,24,20,0.6)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 300, padding: '2rem',
  }
  const modalBox: React.CSSProperties = {
    background: '#f7f4ef', border: '1px solid #d4cfc6',
    borderRadius: '3px', padding: '2rem',
    maxWidth: '400px', width: '100%',
  }
  const btnSecondary: React.CSSProperties = {
    fontFamily: "'Raleway', sans-serif",
    fontSize: '13px', fontWeight: 400,
    letterSpacing: '0.12em', textTransform: 'uppercase',
    color: '#8a8680', background: 'none',
    border: '1px solid #d4cfc6', borderRadius: '2px',
    padding: '0.5rem 1rem', cursor: 'pointer',
  }
  const btnPrimary: React.CSSProperties = {
    fontFamily: "'Raleway', sans-serif",
    fontSize: '13px', fontWeight: 500,
    letterSpacing: '0.15em', textTransform: 'uppercase',
    color: '#8b6f47', background: 'none',
    border: '1px solid #c4a882', borderRadius: '2px',
    padding: '0.5rem 1rem', cursor: 'pointer',
  }

  return (
    <main style={{
      minHeight: '100vh', background: '#f7f4ef',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '3rem 2rem',
    }}>
      <link
        href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300;1,400&family=Raleway:wght@300;400;500&display=swap"
        rel="stylesheet"
      />

      {/* ── Panneau indices ─────────────────────────────────────────────── */}
      <CluesPanel
        open={showCluesPanel}
        onClose={() => setShowCluesPanel(false)}
        discoveredClueIds={progress.discoveredClues}
      />

      {/* ── Modale clé API ─────────────────────────────────────────────── */}
      {showApiModal && (
        <div style={modalOverlay} onClick={() => setShowApiModal(false)}>
          <div style={modalBox} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <span style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 'clamp(18px, 2vw, 22px)', fontWeight: 300, color: '#1a1814' }}>
                Clé API Anthropic
              </span>
              <button onClick={() => { setShowApiModal(false); setShowHelpModal(true) }} style={{ ...btnSecondary, fontSize: '12px', padding: '3px 9px' }}>
                ? aide
              </button>
            </div>
            <input
              type="password"
              value={apiKeyInput}
              onChange={e => setApiKeyInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && saveApiKey()}
              placeholder="sk-ant-…"
              autoFocus
              style={{
                width: '100%', boxSizing: 'border-box',
                fontFamily: "'Raleway', sans-serif", fontSize: '14px', fontWeight: 300, color: '#1a1814',
                background: '#ede9e2', border: '1px solid #d4cfc6', borderRadius: '2px',
                padding: '0.65rem 0.85rem', outline: 'none', marginBottom: '1rem',
              }}
            />
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              {hasKey && <button onClick={removeApiKey} style={btnSecondary}>Retirer</button>}
              <button
                onClick={saveApiKey}
                disabled={!apiKeyInput.trim()}
                style={{
                  ...btnPrimary,
                  color: apiKeySaved ? '#6b8c5a' : '#8b6f47',
                  borderColor: apiKeySaved ? '#b8d4a8' : '#c4a882',
                  opacity: !apiKeyInput.trim() ? 0.45 : 1,
                  cursor: !apiKeyInput.trim() ? 'not-allowed' : 'pointer',
                  transition: 'color 0.3s, border-color 0.3s',
                }}
              >
                {apiKeySaved ? '✓ enregistrée' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modale aide ────────────────────────────────────────────────── */}
      {showHelpModal && (
        <div style={modalOverlay} onClick={() => setShowHelpModal(false)}>
          <div style={modalBox} onClick={e => e.stopPropagation()}>
            <ApiKeyHelp />
            <div style={{ textAlign: 'right' }}>
              <button onClick={() => { setShowHelpModal(false); setShowApiModal(true) }} style={btnPrimary}>
                Entrer ma clé
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modale reset ───────────────────────────────────────────────── */}
      {showResetModal && (
        <div style={modalOverlay} onClick={() => setShowResetModal(false)}>
          <div style={{ ...modalBox, maxWidth: '340px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
            <p style={{
              fontFamily: "'Cormorant Garamond', Georgia, serif",
              fontSize: 'clamp(16px, 1.8vw, 19px)', fontWeight: 300,
              fontStyle: 'italic', color: '#1a1814', lineHeight: 1.65, marginBottom: '1.75rem',
            }}>
              Effacer toute la progression ?<br />
              <span style={{ fontSize: '0.85em', color: '#8a8680', fontStyle: 'normal' }}>
                Rencontres, indices, niveaux de confiance — tout repart à zéro.
                Votre clé API n'est pas effacée.
              </span>
            </p>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
              <button onClick={() => setShowResetModal(false)} style={btnSecondary}>Annuler</button>
              <button onClick={confirmReset} style={btnPrimary}>Recommencer</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Contenu principal ──────────────────────────────────────────── */}
      <div style={{ maxWidth: '480px', width: '100%', textAlign: 'center' }}>

        <h1 style={{
          fontFamily: "'Cormorant Garamond', Georgia, serif",
          fontSize: 'clamp(36px, 6vw, 58px)',
          fontWeight: 300, letterSpacing: '-0.02em',
          lineHeight: 1.08, color: '#1a1814', marginBottom: '3rem',
        }}>
          {TITRE}
        </h1>

        <div style={{ width: '40px', height: '1px', background: '#d4cfc6', margin: '0 auto 2rem' }} />

        {!hasKey && (
          <p style={{
            fontFamily: "'Raleway', sans-serif",
            fontSize: 'clamp(11px, 1.2vw, 12px)', fontWeight: 400,
            letterSpacing: '0.1em', color: '#8b6f47',
            textTransform: 'uppercase', marginBottom: '1.5rem',
          }}>
            Une clé API est requise pour explorer le récit
          </p>
        )}

        {/* ── Lieux ─────────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '2.5rem' }}>
          {locations.map(location => {
            const unlocked = isLocationUnlocked(location)
            const isNew    = unlocked && (progress.newlyUnlockedLocations ?? []).includes(location.id)
            const clickable = unlocked && hasKey

            if (!unlocked) {
              // ── Lieu verrouillé / teaser ─────────────────────────────
              return (
                <div
                  key={location.id}
                  style={{
                    background: '#ede9e2',
                    border: '1px solid #d4cfc6',
                    borderRadius: '3px',
                    padding: '1rem 1.25rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    opacity: 0.35,
                    cursor: 'default',
                  }}
                >
                  <div style={{ flex: 1, textAlign: 'left' }}>
                    <span style={{
                      fontFamily: "'Cormorant Garamond', Georgia, serif",
                      fontSize: 'clamp(18px, 2.1vw, 22px)', fontWeight: 400,
                      color: '#1a1814', display: 'block', marginBottom: '2px',
                    }}>
                      {location.name}
                    </span>
                    <span style={{
                      fontFamily: "'Raleway', sans-serif",
                      fontSize: 'clamp(12px, 1.3vw, 13px)', fontWeight: 300,
                      letterSpacing: '0.08em', color: '#8a8680', textTransform: 'uppercase',
                    }}>
                      {location.era.split(' — ')[0]}
                    </span>
                  </div>
                </div>
              )
            }

            // ── Lieu débloqué ────────────────────────────────────────
            return (
              <button
                key={location.id}
                onClick={() => {
                  if (!clickable) return
                  if (isNew) markLocationSeen(location.id)
                  router.push(`/lieu/${location.id}`)
                }}
                disabled={!clickable}
                style={{
                  background: '#ede9e2',
                  border: `1px solid ${isNew ? '#c4a882' : '#d4cfc6'}`,
                  borderRadius: '3px',
                  padding: '1rem 1.25rem',
                  cursor: clickable ? 'pointer' : 'not-allowed',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  transition: 'border-color 0.2s, background 0.2s',
                  textAlign: 'left',
                  opacity: hasKey ? 1 : 0.4,
                }}
                onMouseEnter={e => {
                  if (!clickable) return
                  const el = e.currentTarget as HTMLButtonElement
                  el.style.borderColor = '#c4a882'
                  el.style.background  = '#f0ece4'
                }}
                onMouseLeave={e => {
                  const el = e.currentTarget as HTMLButtonElement
                  el.style.borderColor = isNew ? '#c4a882' : '#d4cfc6'
                  el.style.background  = '#ede9e2'
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '2px' }}>
                    <span style={{
                      fontFamily: "'Cormorant Garamond', Georgia, serif",
                      fontSize: 'clamp(18px, 2.1vw, 22px)', fontWeight: 400, color: '#1a1814',
                    }}>
                      {location.name}
                    </span>
                    {isNew && (
                      <span style={{
                        fontFamily: "'Raleway', sans-serif",
                        fontSize: '10px', fontWeight: 500,
                        letterSpacing: '0.18em', textTransform: 'uppercase',
                        color: '#8b6f47', background: '#f0e8d8',
                        padding: '2px 7px', borderRadius: '2px',
                      }}>
                        nouveau
                      </span>
                    )}
                  </div>
                  <span style={{
                    fontFamily: "'Raleway', sans-serif",
                    fontSize: 'clamp(12px, 1.3vw, 13px)', fontWeight: 300,
                    letterSpacing: '0.08em', color: '#8a8680', textTransform: 'uppercase',
                  }}>
                    {location.era.split(' — ')[0]}
                  </span>
                </div>
                <span style={{ fontSize: '16px', color: '#c4a882', marginLeft: '1rem' }}>→</span>
              </button>
            )
          })}
        </div>

        {/* ── Barre d'actions ───────────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>

          <button
            onClick={() => setShowApiModal(true)}
            style={{
              fontFamily: "'Raleway', sans-serif",
              fontSize: 'clamp(11px, 1.2vw, 12px)', fontWeight: 400,
              letterSpacing: '0.15em', textTransform: 'uppercase',
              color: hasKey ? '#6b8c5a' : '#8b6f47',
              background: 'none', border: 'none', cursor: 'pointer', padding: 0,
              display: 'flex', alignItems: 'center', gap: '5px',
            }}
          >
            <span style={{ fontSize: '8px', lineHeight: 1 }}>{hasKey ? '●' : '○'}</span>
            {hasKey ? 'clé configurée' : 'configurer la clé'}
          </button>

          <span style={{ color: '#d4cfc6' }}>·</span>

          <button
            onClick={() => setShowCluesPanel(true)}
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

          <span style={{ color: '#d4cfc6' }}>·</span>

          <button
            onClick={() => setShowResetModal(true)}
            style={{
              fontFamily: "'Raleway', sans-serif",
              fontSize: 'clamp(11px, 1.2vw, 12px)', fontWeight: 400,
              letterSpacing: '0.15em', textTransform: 'uppercase',
              color: resetDone ? '#6b8c5a' : '#8a8680',
              background: 'none', border: 'none', cursor: 'pointer', padding: 0,
              transition: 'color 0.3s',
            }}
          >
            {resetDone ? '✓ progression effacée' : 'recommencer'}
          </button>

        </div>

      </div>
    </main>
  )
}
