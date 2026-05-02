'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { locations } from '@/lib/locations'
import { storageKeys } from '@/lib/time'
import { API_KEY_STORAGE_KEY } from '@/lib/types'

// ─── Titre — options littéraires ──────────────────────────────────────────────
//
// Décommenter une seule ligne.
//
// Option A — le double sens le plus immédiat : recette culinaire / recettes d'argent
const TITRE = 'Les recettes du Sud-Ouest'
// Option B — la recette comme formule secrète, presque alchimique
// const TITRE = 'La recette des honnêtes gens'
// Option C — possessif + ambigu : le livre appartient encore à quelqu'un
// const TITRE = 'Le livre de recettes'
// Option D — ironique, sonne comme un titre de pamphlet politique
// const TITRE = 'Comment réussir dans le Sud-Ouest'
// Option E — le plus elliptique, laisse tout à l'imagination
// const TITRE = 'Les ingrédients'

// ─── Texte de la modale d'aide ────────────────────────────────────────────────

const API_KEY_HELP = `Pour jouer, vous avez besoin d'une clé API Anthropic.

Comment l'obtenir :
1. Créez un compte sur console.anthropic.com
2. Dans le menu, allez dans "API Keys"
3. Cliquez "Create Key" et copiez la clé (commence par sk-ant-)

Votre clé est stockée uniquement dans votre navigateur.
Elle ne passe par aucun serveur — les conversations avec les personnages se font directement entre votre navigateur et Anthropic.

Coût estimé : quelques cents par session.`

// ─── Reset ────────────────────────────────────────────────────────────────────

function resetAllProgress(): void {
  const keys: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (k && k.startsWith('recit_')) keys.push(k)
  }
  keys.forEach(k => localStorage.removeItem(k))
}

export default function Home() {
  const router = useRouter()

  const [apiKey,         setApiKey]         = useState('')
  const [apiKeyInput,    setApiKeyInput]     = useState('')
  const [showApiModal,   setShowApiModal]    = useState(false)
  const [showHelpModal,  setShowHelpModal]   = useState(false)
  const [showResetModal, setShowResetModal]  = useState(false)
  const [apiKeySaved,    setApiKeySaved]     = useState(false)
  const [encounterCounts, setEncounterCounts] = useState<Record<string, Record<string, number>>>({})

  useEffect(() => {
    const saved = localStorage.getItem(API_KEY_STORAGE_KEY) ?? ''
    setApiKey(saved)
    setApiKeyInput(saved)

    const counts: Record<string, Record<string, number>> = {}
    locations.forEach(loc => {
      counts[loc.id] = {}
      loc.characters.forEach(c => {
        const n = localStorage.getItem(storageKeys.encounters(c.id))
        counts[loc.id][c.id] = n ? parseInt(n) : 0
      })
    })
    setEncounterCounts(counts)
  }, [])

  function saveApiKey() {
    const trimmed = apiKeyInput.trim()
    if (!trimmed) return
    localStorage.setItem(API_KEY_STORAGE_KEY, trimmed)
    setApiKey(trimmed)
    setApiKeySaved(true)
    setTimeout(() => {
      setApiKeySaved(false)
      setShowApiModal(false)
    }, 1000)
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
    const counts: Record<string, Record<string, number>> = {}
    locations.forEach(loc => {
      counts[loc.id] = {}
      loc.characters.forEach(c => { counts[loc.id][c.id] = 0 })
    })
    setEncounterCounts(counts)
  }

  const hasKey = apiKey.length > 0

  // ── Styles partagés ────────────────────────────────────────────────────────
  const modalOverlay: React.CSSProperties = {
    position: 'fixed', inset: 0,
    background: 'rgba(26,24,20,0.6)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 300, padding: '2rem',
  }
  const modalBox: React.CSSProperties = {
    background: '#f7f4ef',
    border: '1px solid #d4cfc6',
    borderRadius: '3px',
    padding: '2rem',
    maxWidth: '400px',
    width: '100%',
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

      {/* ── Modale clé API ─────────────────────────────────────────────── */}
      {showApiModal && (
        <div style={modalOverlay} onClick={() => setShowApiModal(false)}>
          <div style={modalBox} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <span style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 'clamp(18px, 2vw, 22px)', fontWeight: 300, color: '#1a1814' }}>
                Clé API Anthropic
              </span>
              <button
                onClick={() => { setShowApiModal(false); setShowHelpModal(true) }}
                style={{ ...btnSecondary, fontSize: '12px', padding: '3px 9px' }}
              >
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
                fontFamily: "'Raleway', sans-serif", fontSize: '14px',
                fontWeight: 300, color: '#1a1814',
                background: '#ede9e2', border: '1px solid #d4cfc6',
                borderRadius: '2px', padding: '0.65rem 0.85rem',
                outline: 'none', marginBottom: '1rem',
              }}
            />

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              {hasKey && (
                <button onClick={removeApiKey} style={btnSecondary}>
                  Retirer
                </button>
              )}
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
            <p style={{
              fontFamily: "'Cormorant Garamond', Georgia, serif",
              fontSize: 'clamp(15px, 1.7vw, 18px)', fontWeight: 300,
              color: '#1a1814', lineHeight: 1.75,
              whiteSpace: 'pre-line', marginBottom: '1.5rem',
            }}>
              {API_KEY_HELP}
            </p>
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
              fontStyle: 'italic', color: '#1a1814',
              lineHeight: 1.65, marginBottom: '1.75rem',
            }}>
              Effacer toute la progression ?<br />
              <span style={{ fontSize: '0.85em', color: '#8a8680', fontStyle: 'normal' }}>
                Rencontres, indices, niveaux de confiance — tout repart à zéro.
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
          lineHeight: 1.08, color: '#1a1814',
          marginBottom: '3rem',
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
            Une clé API est requise pour jouer
          </p>
        )}

        {/* Lieux */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '2.5rem' }}>
          {locations.map(location => (
            <button
              key={location.id}
              onClick={() => hasKey && router.push(`/lieu/${location.id}`)}
              disabled={!hasKey}
              style={{
                background: '#ede9e2', border: '1px solid #d4cfc6',
                borderRadius: '3px', padding: '1rem 1.25rem',
                cursor: hasKey ? 'pointer' : 'not-allowed',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                transition: 'border-color 0.2s, background 0.2s',
                textAlign: 'left', opacity: hasKey ? 1 : 0.4,
              }}
              onMouseEnter={e => {
                if (!hasKey) return
                const el = e.currentTarget as HTMLButtonElement
                el.style.borderColor = '#c4a882'
                el.style.background  = '#f0ece4'
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLButtonElement
                el.style.borderColor = '#d4cfc6'
                el.style.background  = '#ede9e2'
              }}
            >
              <div style={{ flex: 1 }}>
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
                  {location.era}
                </span>
              </div>
              <span style={{ fontSize: '16px', color: '#c4a882', marginLeft: '1rem' }}>→</span>
            </button>
          ))}
        </div>

        {/* Barre d'actions */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1.25rem' }}>
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
            onClick={() => setShowResetModal(true)}
            style={{
              fontFamily: "'Raleway', sans-serif",
              fontSize: 'clamp(11px, 1.2vw, 12px)', fontWeight: 400,
              letterSpacing: '0.15em', textTransform: 'uppercase',
              color: '#8a8680', background: 'none',
              border: 'none', cursor: 'pointer', padding: 0,
            }}
          >
            recommencer
          </button>
        </div>

      </div>
    </main>
  )
}
