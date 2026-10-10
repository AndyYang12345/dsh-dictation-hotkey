/**
 * Contract check for the built browser bundle. Runs without a browser.
 *
 * It executes the bundle against a strict Cordis-like context and fails when
 * the module touches a service it did not declare. That is the failure mode
 * this plugin already hit once: `ctx.slots` without `inject: ['slots']` throws
 * `cannot get property "slots" without inject`, and the Web shell reports only
 * "1 entry did not activate" — no usable diagnostic.
 *
 * Usage: node verify.mjs
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const bundle = readFileSync(join(here, 'client/dist/client.js'), 'utf8')

const failures = []
const calls = []

// ── 1. module-table registration ──────────────────────────────────────────
let registered = null
globalThis.window = {
  __ModuleLoader__: { load: (row) => { registered = row } },
  localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  addEventListener: () => {},
  removeEventListener: () => {},
}
globalThis.document = {
  addEventListener: () => {},
  removeEventListener: () => {},
  createElement: () => ({ style: {}, append() {} }),
  getElementById: () => null,
}
// eslint-disable-next-line no-eval
eval(bundle)

if (registered === null) failures.push('bundle did not call __ModuleLoader__.load')
else if (registered.id !== 'dsh-dictation-hotkey') {
  failures.push(`bundle registered id "${registered.id}", expected "dsh-dictation-hotkey"`)
}

const react = {
  createElement: (...args) => ({ type: args[0], props: args[1] }),
  useState: (value) => [value, () => {}],
  useEffect: () => {},
  useRef: (value) => ({ current: value }),
  useReducer: (_reducer, initial) => [initial, () => {}],
}
const exports_ = registered.factory((name) => {
  if (name === 'react') return react
  throw new Error(`bundle required an unexpected external: ${name}`)
})

// ── 2. declared services cover every ctx.<name> read ──────────────────────
const declared = new Set(exports_.inject ?? [])
if (!Array.isArray(exports_.inject)) failures.push('the module does not export an array `inject`')
if (!declared.has('slots')) failures.push('`inject` must declare the slots service this body uses')
if (!declared.has('remote.speech')) {
  failures.push('`inject` must declare remote.speech: reading it undeclared throws')
}

const accessed = new Set()
const speech = { transcribe: async () => ({ ok: true, value: { text: '' } }) }
const strictCtx = new Proxy(
  {
    // Only declared services resolve; anything else throws like Cordis does.
    slots: {
      inject: (target, callback) => {
        calls.push(`slots.inject(${target})`)
        return callback()
      },
      register: (definition, component) => {
        calls.push(`slots.register(${JSON.stringify(definition)})`)
        if (typeof component !== 'function') failures.push('slot registration got no component')
        return () => {}
      },
    },
    effect: (callback, label) => {
      calls.push(`effect(${label})`)
      const disposer = callback()
      return typeof disposer === 'function' ? disposer : () => {}
    },
    get: (name) => {
      calls.push(`ctx.get(${JSON.stringify(name)})`)
      if (name === 'remote.speech') return speech
      if (name === 'remote') return { speech }
      return undefined
    },
  },
  {
    get(target, key) {
      if (typeof key === 'string' && !(key in target)) {
        accessed.add(key)
        throw new Error(`cannot get property "${key}" without inject`)
      }
      return target[key]
    },
  },
)

try {
  const maybe = exports_.apply(strictCtx)
  if (maybe && typeof maybe.then === 'function') {
    maybe.catch((error) => failures.push(`apply() rejected: ${error.message}`))
  }
} catch (error) {
  failures.push(`apply() threw: ${error.message}`)
}

for (const key of accessed) {
  if (!declared.has(key)) failures.push(`apply() touched undeclared ctx.${key}`)
}

// ── 3. expected registration shape ────────────────────────────────────────
if (!calls.some((call) => call.startsWith('slots.register('))) {
  failures.push('no slot registration was made')
}
if (!calls.some((call) => call.includes('conversation.composer.dock'))) {
  failures.push('the pill must be registered into conversation.composer.dock')
}

// ── report ────────────────────────────────────────────────────────────────
console.log('bundle id:', registered?.id)
console.log('inject:', JSON.stringify([...(exports_.inject ?? [])]))
console.log('calls:', JSON.stringify(calls))
if (failures.length > 0) {
  console.error('\nFAILED:')
  for (const failure of failures) console.error(' -', failure)
  process.exit(1)
}
console.log('\nOK: bundle registers correctly and only touches declared services')
