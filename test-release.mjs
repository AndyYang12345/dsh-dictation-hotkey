/**
 * Behaviour test for the built browser bundle: drives the real controller with
 * a fake microphone / AudioWorklet / speech Remote and asserts what happens on
 * key release.
 *
 * This exists because "releasing the keys fast loses the utterance" is a timing
 * claim that reasoning alone got wrong twice. Here the release order, the tail
 * grace, the minimum duration and the transcribe call count are all observable.
 *
 * Usage: node test-release.mjs
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const bundle = readFileSync(join(here, 'client/dist/client.js'), 'utf8')

const failures = []
const check = (label, condition, detail = '') => {
  if (condition) console.log(`  ok   ${label}`)
  else {
    console.log(`  FAIL ${label} ${detail}`)
    failures.push(label)
  }
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/** Fresh page environment per scenario: the bundle reads globals at eval time. */
function loadBundle() {
  const listeners = { keydown: [], keyup: [], blur: [] }
  let registered = null
  let workletNode = null

  class FakeWorkletNode {
    constructor() {
      this.port = { onmessage: null, postMessage: () => {} }
      workletNode = this
    }
    connect() {}
  }
  class FakeAudioContext {
    constructor() {
      this.sampleRate = 48000
      this.state = 'running'
      this.currentTime = 0
      this.audioWorklet = { addModule: async () => {} }
      this.destination = {}
    }
    async resume() {}
    async close() {}
    createMediaStreamSource() {
      return { connect() {} }
    }
    createGain() {
      return { gain: { value: 0 }, connect() {} }
    }
    createOscillator() {
      return { frequency: {}, connect() {}, start() {}, stop() {}, type: '' }
    }
  }

  /** Push `seconds` of a fake tone through the collector callback. */
  const feedAudio = (seconds, amplitude = 0.2) => {
    if (workletNode === null || workletNode.port.onmessage === null) return
    const rate = 48000
    const total = Math.round(seconds * rate)
    const frame = new Float32Array(128)
    for (let offset = 0; offset < total; offset += 128) {
      for (let i = 0; i < frame.length; i += 1) {
        frame[i] = amplitude * Math.sin((2 * Math.PI * 220 * (offset + i)) / rate)
      }
      workletNode.port.onmessage({ data: new Float32Array(frame) })
    }
  }

  const win = {
    __ModuleLoader__: { load: (row) => { registered = row } },
    localStorage: {
      store: new Map(),
      getItem(key) { return this.store.has(key) ? this.store.get(key) : null },
      setItem(key, value) { this.store.set(key, String(value)) },
      removeItem(key) { this.store.delete(key) },
    },
    addEventListener: (type, handler) => listeners[type]?.push(handler),
    removeEventListener: () => {},
    setTimeout: (handler, ms) => setTimeout(handler, ms),
    clearTimeout,
  }
  const doc = {
    hidden: false,
    addEventListener: (type, handler) => listeners[type]?.push(handler),
    removeEventListener: () => {},
    getElementById: () => null,
    createElement: () => ({ style: {}, append() {}, set textContent(_value) {} }),
    head: { append() {} },
  }

  globalThis.window = win
  globalThis.document = doc
  globalThis.localStorage = win.localStorage
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: { mediaDevices: { getUserMedia: async () => ({ getTracks: () => [{ stop() {} }] }) } },
  })
  globalThis.AudioContext = FakeAudioContext
  globalThis.AudioWorkletNode = FakeWorkletNode
  globalThis.URL.createObjectURL = () => 'blob:test'
  globalThis.Blob = class {}
  globalThis.performance = { now: () => Date.now() }
  globalThis.btoa = (value) => Buffer.from(value, 'binary').toString('base64')

  // eslint-disable-next-line no-eval
  eval(bundle)

  const react = {
    createElement: (...args) => ({ type: args[0], props: args[1] }),
    useState: (value) => [value, () => {}],
    useEffect: () => {},
    useRef: (value) => ({ current: value }),
    useReducer: (_reducer, initial) => [initial, () => {}],
  }
  const module_ = registered.factory((name) => {
    if (name === 'react') return react
    throw new Error(`unexpected external: ${name}`)
  })
  return { module: module_, listeners, win, feedAudio }
}

/** Mount the plugin against a stub ctx and return handles for driving it. */
function mount({ transcribe }) {
  const loaded = loadBundle()
  const calls = { transcribe: 0, insert: 0, submit: 0, texts: [] }
  const speech = {
    transcribe: async (request) => {
      calls.transcribe += 1
      calls.lastRequest = request
      return transcribe(calls.transcribe)
    },
  }
  const ctx = {
    get: (name) => {
      if (name === 'remote.speech') return speech
      if (name === 'remote') return { speech }
      throw new Error(`cannot get property "${name}" without inject`)
    },
    effect: (callback) => {
      const disposer = callback()
      return typeof disposer === 'function' ? disposer : () => {}
    },
    slots: {
      inject: (target, callback) => callback(),
      register: () => () => {},
    },
  }
  loaded.module.apply(ctx)
  const controller = loaded.win.__DSH_PTT_CONTROLLER__
  controller.addSeat({
    actions: {
      captureInsertion: () => ({ rev: 1 }),
      insertText: (text) => {
        calls.insert += 1
        calls.texts.push(text)
        return true
      },
      submit: () => {
        calls.submit += 1
      },
    },
    locked: false,
  })
  return {
    controller,
    calls,
    listeners: loaded.listeners,
    storage: loaded.win.localStorage,
    feedAudio: loaded.feedAudio,
  }
}

const key = (code, modifiers = {}) => ({
  code,
  ctrlKey: Boolean(modifiers.ctrl),
  altKey: Boolean(modifiers.alt),
  shiftKey: Boolean(modifiers.shift),
  metaKey: Boolean(modifiers.meta),
  repeat: false,
  preventDefault() {},
  stopPropagation() {},
})

const combo = { ctrl: true, shift: true }
const hotkeyDown = () => key('Space', combo)

async function scenario(name, run) {
  console.log(`\n${name}`)
  await run()
}

// ── 1. normal release: space first, then the modifiers ────────────────────
await scenario('release order Space → Ctrl → Shift (the fast, sloppy release)', async () => {
  const { controller, calls, listeners, feedAudio } = mount({
    transcribe: async () => ({ ok: true, value: { text: '你好世界' } }),
  })
  listeners.keydown.forEach((handler) => handler(hotkeyDown()))
  await sleep(450)
  feedAudio(0.4)
  listeners.keyup.forEach((handler) => handler(key('Space', combo)))
  await sleep(500)
  check(
    'releasing Space alone ended the recording (not stuck in recording)',
    controller.phase !== 'recording',
    `phase=${controller.phase}`,
  )
  listeners.keyup.forEach((handler) => handler(key('ControlLeft', { shift: true })))
  listeners.keyup.forEach((handler) => handler(key('ShiftLeft', {})))
  await sleep(300)
  check('exactly one transcription was requested', calls.transcribe === 1, `n=${calls.transcribe}`)
  check('transcript was inserted', calls.insert === 1 && calls.texts[0] === '你好世界', JSON.stringify(calls.texts))
  await sleep(2000)
  check('the result flash clears by itself', controller.phase === 'idle', `phase=${controller.phase}`)
})

// ── 2. tapping the hotkey twice must not leave a dangling recording ───────
await scenario('two quick taps in a row', async () => {
  const { controller, calls, listeners, feedAudio } = mount({
    transcribe: async () => ({ ok: true, value: { text: '第二段' } }),
  })
  listeners.keydown.forEach((handler) => handler(hotkeyDown()))
  await sleep(400)
  feedAudio(0.3)
  listeners.keyup.forEach((handler) => handler(key('Space', combo)))
  await sleep(600)
  listeners.keydown.forEach((handler) => handler(hotkeyDown()))
  await sleep(400)
  feedAudio(0.3)
  listeners.keyup.forEach((handler) => handler(key('ShiftLeft', { ctrl: true })))
  await sleep(600)
  check('both taps produced a transcription', calls.transcribe === 2, `n=${calls.transcribe}`)
  await sleep(2000)
  check('controller returned to idle on its own', controller.phase === 'idle', `phase=${controller.phase}`)
})

// ── 3. ultra-short press is rejected loudly, not silently ─────────────────
await scenario('press shorter than minRecordMs', async () => {
  const { controller, calls, listeners, feedAudio } = mount({
    transcribe: async () => ({ ok: true, value: { text: '不该出现' } }),
  })
  listeners.keydown.forEach((handler) => handler(hotkeyDown()))
  await sleep(10)
  feedAudio(0.05)
  listeners.keyup.forEach((handler) => handler(key('Space', combo)))
  await sleep(700)
  check('no transcription requested', calls.transcribe === 0, `n=${calls.transcribe}`)
  check('nothing inserted', calls.insert === 0)
  check('user sees the short-press notice', controller.message.includes('太短'), `message="${controller.message}"`)
})

// ── 4. empty transcript is surfaced with its audio level ─────────────────
await scenario('recognizer returns empty text', async () => {
  const { controller, calls, listeners, feedAudio } = mount({
    transcribe: async () => ({ ok: true, value: { text: '' } }),
  })
  listeners.keydown.forEach((handler) => handler(hotkeyDown()))
  await sleep(700)
  feedAudio(0.6)
  listeners.keyup.forEach((handler) => handler(key('Space', combo)))
  await sleep(900)
  check('transcription was attempted', calls.transcribe === 1, `n=${calls.transcribe}`)
  check('nothing inserted', calls.insert === 0)
  check(
    'notice explains the empty result',
    controller.message.includes('识别') || controller.message.includes('声音'),
    `message="${controller.message}"`,
  )
})

// ── 5. auto-send path ────────────────────────────────────────────────────
await scenario('autoSend submits the draft', async () => {
  const { calls, listeners, storage, feedAudio } = mount({
    transcribe: async () => ({ ok: true, value: { text: '直接发送' } }),
  })
  storage.setItem('dsh-dictation-hotkey.settings', JSON.stringify({ autoSend: true }))
  listeners.keydown.forEach((handler) => handler(hotkeyDown()))
  await sleep(700)
  feedAudio(0.6)
  listeners.keyup.forEach((handler) => handler(key('Space', combo)))
  await sleep(900)
  check('text inserted', calls.insert === 1, `n=${calls.insert}`)
  check('submit was called once', calls.submit === 1, `n=${calls.submit}`)
})

console.log('')
if (failures.length > 0) {
  console.error(`FAILED (${failures.length}): ${failures.join(' | ')}`)
  process.exit(1)
}
console.log('OK: every key-release scenario behaves as intended')
