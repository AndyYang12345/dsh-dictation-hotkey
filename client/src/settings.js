/**
 * Shipped defaults, per-browser overrides, and the keystroke diagnostic ring
 * buffer.
 *
 * Everything here is deliberately plain: defaults are code, user overrides live
 * in `localStorage`, and no host round-trip is needed to start dictating.
 */

/** localStorage key holding the browser-side overrides. */
const STORE_KEY = 'dsh-dictation-hotkey.settings'

/** Shipped defaults; the popover overrides them per browser. */
const DEFAULTS = {
  hotkey: 'Ctrl+Shift+Space',
  mode: 'hold',
  autoSend: false,
  providerId: '',
  language: '',
  minRecordMs: 150,
  maxRecordSeconds: 60,
  /** Grace added after release so a word cut off mid-syllable stays whole. */
  tailMs: 180,
  beep: true,
  /** Keep a per-keystroke diagnostic log in localStorage (ring buffer). */
  debug: false,
}

/** Fields a user may override in the popover. */
const OVERRIDABLE = ['hotkey', 'mode', 'autoSend', 'beep', 'language', 'debug']

function readStored() {
  try {
    const raw = window.localStorage.getItem(STORE_KEY)
    if (raw === null) return {}
    const parsed = JSON.parse(raw)
    return parsed !== null && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeStored(patch) {
  try {
    window.localStorage.setItem(STORE_KEY, JSON.stringify({ ...readStored(), ...patch }))
  } catch {
    /* a blocked storage quota must not break dictation */
  }
}

/** Drop the stored overrides, or one diagnostics payload. */
function removeStored(key = STORE_KEY) {
  try {
    window.localStorage.removeItem(key)
  } catch {
    /* nothing to remove */
  }
}

/** localStorage key of the keystroke ring buffer. */
const LOG_KEY = 'dsh-dictation-hotkey.log'
/** Most recent keystroke records kept for diagnosis. */
const LOG_LIMIT = 20

/**
 * Append one diagnostic record. Always mirrored to the console so a single
 * reproduction can be read straight out of DevTools; persisted only when the
 * user enabled diagnostics.
 */
function record(entry) {
  const line = { at: new Date().toISOString(), ...entry }
  try {
    console.info('[dictation-hotkey]', line)
  } catch {
    /* console is best-effort */
  }
  if (settings().debug !== true) return
  try {
    const raw = window.localStorage.getItem(LOG_KEY)
    const rows = raw === null ? [] : JSON.parse(raw)
    const next = Array.isArray(rows) ? [...rows, line].slice(-LOG_LIMIT) : [line]
    window.localStorage.setItem(LOG_KEY, JSON.stringify(next))
  } catch {
    /* a full or blocked storage must not break dictation */
  }
}

function settings() {
  const stored = readStored()
  const merged = { ...DEFAULTS }
  for (const key of OVERRIDABLE) {
    if (typeof stored[key] === typeof DEFAULTS[key]) merged[key] = stored[key]
  }
  return merged
}

export {
  DEFAULTS,
  OVERRIDABLE,
  STORE_KEY,
  LOG_KEY,
  LOG_LIMIT,
  settings,
  readStored,
  writeStored,
  removeStored,
  record,
}
