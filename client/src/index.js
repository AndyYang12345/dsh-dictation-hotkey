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
import { DictationSeat } from './ui.js'

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

  ctx.slots.inject('conversation.composer.dock', () =>
    ctx.slots.register(
      { name: 'conversation.composer.dock', id: 'dictation-hotkey', order: 90 },
      DictationSeat,
    ),
  )
}
