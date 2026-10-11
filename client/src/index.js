/**
 * Push-to-talk dictation for the DSH Web composer — module entry point.
 *
 * Hold the configured key, speak, release: the page records, encodes 16 kHz
 * mono PCM16 WAV, sends it to DSH's own speech Remote
 * (`ctx.remote.speech.transcribe`, mounted by `dsh-api-remotes` from
 * `@deepseek-ai/dsh-experimental-api-speech-to-text`), and inserts the
 * transcript through the same `inputActions.insertText` the official microphone
 * uses. Optional auto-send calls `inputActions.submit`.
 *
 * Cordis contract notes (each one cost a failed Web boot to learn):
 *
 * - `ctx.<service>` is legal ONLY for services named in this module's `inject`
 *   array. Touching `ctx.slots` without it throws
 *   `cannot get property "slots" without inject`, and the shell then reports
 *   only `web boot: 1 entry did not activate`.
 * - `inject` entries are SERVICE names: `remote.speech` is the generated dotted
 *   service of the official speech API package, and reading it without the
 *   declaration throws. Declaring it also keeps this entry `pending` instead of
 *   failing when a deployment ships without voice input.
 * - The factory must stay side-effect free: listeners are registered inside
 *   `ctx.effect` with their disposers, and styling rides in React elements.
 */

import { Controller } from './controller.js'
import { DictationSeat, HomeSeat } from './ui.js'
import { settings, record } from './settings.js'

export const name = 'dictation-hotkey'

/**
 * Services this body needs.
 *
 * `slots` is where the pill lives. `remote.speech` is the generated dotted
 * service of `@deepseek-ai/dsh-experimental-api-speech-to-text`, mounted by the
 * client half of the voice-input bundle — exactly what the shipped
 * `dsh-experimental-client-ui-voice-input` package declares. Declaring it (a)
 * guarantees the fiber activates only once the recognizer namespace exists, and
 * (b) makes reading it legal; without the declaration Cordis throws
 * `cannot get property "remote.speech" without inject`.
 */
export const inject = ['slots', 'remote.speech']

/**
 * Browser plugin body: one controller, one composer seat.
 * @param ctx - client root context (carries the declared services).
 */
export function apply(ctx) {
  // Activation diary, kept only while the diagnostics toggle is on: it records
  // which slot declarations arrived and which seats mounted, which is how
  // "the hotkey does nothing on the new-conversation screen" became a fact
  // instead of a guess.
  const diary = (...entry) => {
    if (settings().debug !== true) return
    const log = (window.__DSH_PTT_DIARY__ ??= [])
    log.push(entry.join(' '))
    if (log.length > 40) log.shift()
    record({ event: 'diary', detail: entry.join(' ') })
  }
  // `remote` is deliberately NOT injected: only the dotted `remote.speech`
  // service is, so the plain service is looked up defensively and never cached.
  const controller = new Controller(
    () => {
      try {
        return ctx.get('remote')
      } catch {
        return undefined
      }
    },
    () => ctx.get('remote.speech'),
  )
  ctx.effect(() => {
    const detach = controller.attach()
    window.__DSH_PTT_CONTROLLER__ = controller
    return () => {
      detach()
      if (window.__DSH_PTT_CONTROLLER__ === controller) {
        delete window.__DSH_PTT_CONTROLLER__
      }
    }
  }, 'dictation-hotkey: push-to-talk listeners')

  // Inside a session: the pill, seated in the composer dock, which hands this
  // component that session's inputActions.
  ctx.slots.inject('conversation.composer.dock', () => {
    diary('dock declared')
    return ctx.slots.register(
      { name: 'conversation.composer.dock', id: 'dictation-hotkey', order: 90 },
      DictationSeat,
    )
  })

  // Without a session (the new-conversation screen) the dock never renders, so
  // the hotkey would have no seat at all. `shell.overlay` is a root-scope list
  // slot that renders in both states and already carries ten official
  // components; this headless entry keeps the controller armed and routes the
  // transcript into the focused composer.
  ctx.slots.inject('shell.overlay', () => {
    diary('overlay declared')
    return ctx.slots.register(
      { name: 'shell.overlay', id: 'dictation-hotkey-home', order: 95 },
      HomeSeat,
    )
  })
}
