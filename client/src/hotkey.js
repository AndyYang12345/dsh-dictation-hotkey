/**
 * Combination parsing and exact matching. Pure string/event logic, no DOM state.
 */

const MOD_ALIASES = new Set(['mod', 'cmdorctrl', 'commandorcontrol'])
const MODIFIER_ALIASES = {
  ctrl: 'ctrl',
  control: 'ctrl',
  alt: 'alt',
  option: 'alt',
  shift: 'shift',
  meta: 'meta',
  cmd: 'meta',
  command: 'meta',
  super: 'meta',
  win: 'meta',
}
const CODE_ALIASES = {
  space: 'Space',
  spacebar: 'Space',
  enter: 'Enter',
  return: 'Enter',
  tab: 'Tab',
  escape: 'Escape',
  esc: 'Escape',
  backspace: 'Backspace',
  delete: 'Delete',
  insert: 'Insert',
  home: 'Home',
  end: 'End',
  pageup: 'PageUp',
  pagedown: 'PageDown',
  up: 'ArrowUp',
  down: 'ArrowDown',
  left: 'ArrowLeft',
  right: 'ArrowRight',
  '`': 'Backquote',
  '~': 'Backquote',
  '-': 'Minus',
  '=': 'Equal',
  '[': 'BracketLeft',
  ']': 'BracketRight',
  '\\': 'Backslash',
  ';': 'Semicolon',
  "'": 'Quote',
  ',': 'Comma',
  '.': 'Period',
  '/': 'Slash',
}

/**
 * Normalize a configured combination into an exact matcher.
 * @param spec - e.g. `Ctrl+Shift+Space`, `Alt+~`, `F9`.
 */
function parseHotkey(spec) {
  if (typeof spec !== 'string' || spec.trim() === '') return null
  const parts = spec.split('+').map((part) => part.trim()).filter(Boolean)
  const wanted = { ctrl: false, alt: false, shift: false, meta: false }
  let code = null
  for (const part of parts) {
    const lower = part.toLowerCase()
    if (MOD_ALIASES.has(lower)) {
      wanted.ctrl = true
      wanted.meta = true
      continue
    }
    const modifier = MODIFIER_ALIASES[lower]
    if (modifier !== undefined) {
      wanted[modifier] = true
      continue
    }
    if (CODE_ALIASES[lower] !== undefined) {
      code = CODE_ALIASES[lower]
      continue
    }
    if (/^f([1-9]|1[0-9]|2[0-4])$/.test(lower)) {
      code = 'F' + lower.slice(1)
      continue
    }
    if (/^[a-z]$/.test(lower)) {
      code = 'Key' + lower.toUpperCase()
      continue
    }
    if (/^[0-9]$/.test(lower)) {
      code = 'Digit' + lower
      continue
    }
  }
  if (code === null) return null
  return {
    ctrl: wanted.ctrl,
    alt: wanted.alt,
    shift: wanted.shift,
    meta: wanted.meta,
    code,
    display: spec,
  }
}

/**
 * Physical keys that take part in a combination, e.g. `Ctrl+Shift+Space` ->
 * `['ControlLeft','ControlRight','ShiftLeft','ShiftRight','Space']`. Release is
 * matched against these codes so letting go of any one of them stops the
 * recording, even when the human does not lift all three together.
 */
function heldCodesOf(match) {
  if (match === null) return []
  const codes = []
  if (match.ctrl) codes.push('ControlLeft', 'ControlRight')
  if (match.alt) codes.push('AltLeft', 'AltRight')
  if (match.shift) codes.push('ShiftLeft', 'ShiftRight')
  if (match.meta) codes.push('MetaLeft', 'MetaRight')
  codes.push(match.code)
  return codes
}

/** Exact modifier match keeps `Ctrl+Shift+Space` from firing on `Ctrl+Space`. */
function matchesHotkey(event, match) {
  if (match === null) return false
  if (event.code !== match.code) return false
  if (event.ctrlKey !== match.ctrl) return false
  if (event.altKey !== match.alt) return false
  if (event.shiftKey !== match.shift) return false
  if (event.metaKey !== match.meta) return false
  return true
}

export { parseHotkey, heldCodesOf, matchesHotkey }
