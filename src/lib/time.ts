/**
 * lib/time.ts — Moteur temporel diégétique (Phase 3)
 *
 * Principe :
 *   - L'epoch réelle (Date.now() au premier clic) est persistée dans localStorage.
 *   - La date fictive de départ est fixe : 26 avril 1953, heure calée sur l'heure réelle du premier clic.
 *   - Le temps diégétique avance au rythme 1:1 avec le temps réel écoulé depuis l'epoch.
 *   - Toutes les fonctions sont safe côté serveur (pas d'accès à localStorage en SSR).
 */

// ─── Constantes ───────────────────────────────────────────────────────────────

const LS_EPOCH_REAL     = 'recit_epoch_real'
const LS_EPOCH_DIEGETIC = 'recit_epoch_diegetic'
const LS_LAST_SEEN      = (characterId: string) => `recit_last_seen_${characterId}`

/** Date fictive de départ : 26 avril 1953, minuit UTC. */
const DIEGETIC_BASE_DATE = new Date('1953-04-26T00:00:00Z').getTime()

// ─── Initialisation ───────────────────────────────────────────────────────────

/**
 * À appeler lors de la toute première interaction du lecteur (côté client uniquement).
 * Idempotent : ne réécrit rien si déjà initialisé.
 */
export function initDiegeticTime(): void {
  if (typeof window === 'undefined') return
  if (localStorage.getItem(LS_EPOCH_REAL)) return

  const nowReal = Date.now()

  // Calculer l'epoch diégétique : date de base + heure réelle du jour
  const realDate     = new Date(nowReal)
  const hoursMs      = realDate.getUTCHours()   * 3_600_000
  const minutesMs    = realDate.getUTCMinutes()  * 60_000
  const secondsMs    = realDate.getUTCSeconds()  * 1_000
  const msMs         = realDate.getUTCMilliseconds()
  const diegeticEpoch = DIEGETIC_BASE_DATE + hoursMs + minutesMs + secondsMs + msMs

  localStorage.setItem(LS_EPOCH_REAL,     nowReal.toString())
  localStorage.setItem(LS_EPOCH_DIEGETIC, diegeticEpoch.toString())
}

// ─── Temps diégétique courant ─────────────────────────────────────────────────

/**
 * Retourne le timestamp diégétique actuel (ms depuis epoch Unix).
 * Si non initialisé, initialise et retourne l'heure courante.
 */
export function getDiegeticNow(): Date {
  if (typeof window === 'undefined') return new Date()

  const epochReal = parseInt(localStorage.getItem(LS_EPOCH_REAL) ?? '0')
  const epochDieg = parseInt(localStorage.getItem(LS_EPOCH_DIEGETIC) ?? '0')

  if (!epochReal || !epochDieg) {
    initDiegeticTime()
    return getDiegeticNow()
  }

  const elapsed    = Date.now() - epochReal
  const diegeticTs = epochDieg + elapsed
  return new Date(diegeticTs)
}

/**
 * Retourne l'heure diégétique sous forme lisible : "14h37, jeudi 26 avril 1953"
 */
export function formatDiegeticDate(d: Date = getDiegeticNow()): string {
  const days   = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi']
  const months = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre']

  const hh   = d.getUTCHours().toString().padStart(2, '0')
  const mm   = d.getUTCMinutes().toString().padStart(2, '0')
  const dow  = days[d.getUTCDay()]
  const day  = d.getUTCDate()
  const mon  = months[d.getUTCMonth()]
  const year = d.getUTCFullYear()

  return `${hh}h${mm}, ${dow} ${day} ${mon} ${year}`
}

// ─── Disponibilité ────────────────────────────────────────────────────────────

/**
 * Vérifie si une plage horaire est active selon l'heure diégétique courante.
 */
export function isWithinSchedule(openHour: number, closeHour: number): boolean {
  const h = getDiegeticNow().getUTCHours()
  if (openHour < closeHour) return h >= openHour && h < closeHour
  // Cas nuit (ex: 22 → 6)
  return h >= openHour || h < closeHour
}

// ─── Contexte d'absence ───────────────────────────────────────────────────────

/** Enregistre le moment où le lecteur quitte la conversation (appelé par saveAndLeave). */
export function markLastSeen(characterId: string): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(LS_LAST_SEEN(characterId), Date.now().toString())
}

/**
 * Retourne une instruction contextuelle en langage naturel décrivant
 * l'absence écoulée depuis la dernière conversation.
 * Non prescriptive : le personnage décide seul de sa réaction.
 *
 * Retourne null si c'est la première visite ou si l'absence est < 2 min.
 */
export function getAbsenceContext(characterId: string): string | null {
  if (typeof window === 'undefined') return null

  const raw = localStorage.getItem(LS_LAST_SEEN(characterId))
  if (!raw) return null

  const lastSeen = parseInt(raw)
  const elapsed  = Date.now() - lastSeen // ms réelles

  const minutes = Math.floor(elapsed / 60_000)
  const hours   = Math.floor(elapsed / 3_600_000)
  const days    = Math.floor(elapsed / 86_400_000)
  const weeks   = Math.floor(elapsed / (86_400_000 * 7))

  if (minutes < 2)   return null
  if (minutes < 60)  return `SITUATION ACTUELLE : Le lecteur s'est absenté environ ${minutes} minute${minutes > 1 ? 's' : ''} et vient de revenir. Intègre cette temporalité de façon naturelle si c'est pertinent.`
  if (hours   < 24)  return `SITUATION ACTUELLE : Quelques heures se sont écoulées depuis votre dernière rencontre. Réagis de façon appropriée selon l'état de votre relation.`
  if (days    < 7)   return `SITUATION ACTUELLE : Cela fait ${days} jour${days > 1 ? 's' : ''} que vous ne vous êtes pas parlé. Réagis de manière appropriée selon la tension ou la chaleur de votre relation.`
  if (weeks   < 4)   return `SITUATION ACTUELLE : Plusieurs semaines se sont écoulées. Le temps a peut-être changé quelque chose en toi, ou peut-être pas. Réagis selon ce que tu ressentirais vraiment.`
  return `SITUATION ACTUELLE : Un long moment s'est écoulé depuis votre dernière rencontre — des mois, peut-être. Intègre cette distance temporelle de façon humaine et nuancée.`
}

// ─── Migration localStorage (Phase 2) ────────────────────────────────────────

/**
 * Migre silencieusement les anciennes clés `recit_*_[locationId]_[characterId]`
 * vers les nouvelles clés `recit_*_[characterId]`.
 * Idempotent : ne fait rien si la nouvelle clé existe déjà.
 */
export function migrateStorageKeys(locationId: string, characterId: string): void {
  if (typeof window === 'undefined') return

  const migrations: Array<{ oldKey: string; newKey: string }> = [
    {
      oldKey: `recit_trust_${locationId}_${characterId}`,
      newKey: `recit_trust_${characterId}`
    },
    {
      oldKey: `recit_encounters_${locationId}_${characterId}`,
      newKey: `recit_encounters_${characterId}`
    },
    {
      oldKey: `recit_last_context_${locationId}_${characterId}`,
      newKey: `recit_context_${characterId}`
    }
  ]

  migrations.forEach(({ oldKey, newKey }) => {
    if (!localStorage.getItem(newKey)) {
      const oldVal = localStorage.getItem(oldKey)
      if (oldVal !== null) {
        localStorage.setItem(newKey, oldVal)
        localStorage.removeItem(oldKey)
      }
    }
  })
}

// ─── Clés localStorage centralisées (Phase 2) ────────────────────────────────

export const storageKeys = {
  trust:      (characterId: string) => `recit_trust_${characterId}`,
  encounters: (characterId: string) => `recit_encounters_${characterId}`,
  context:    (characterId: string) => `recit_context_${characterId}`,
  coreMemory: (characterId: string) => `recit_core_memory_${characterId}`,
  progress:   () => 'recit_progress',
  lastSeen:   (characterId: string) => `recit_last_seen_${characterId}`,
}
