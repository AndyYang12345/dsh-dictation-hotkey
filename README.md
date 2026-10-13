# dsh-dictation-hotkey

Press-to-talk dictation for the DSH Web composer. Hold a key combination, speak,
release — DSH's own speech engine transcribes it and the text lands in the
composer.

The plugin adds **no second recognizer**: it drives the speech Remote that DSH
already ships with its voice-input bundle (local SenseVoice, CPU) and inserts the
result through the official composer actions.

```
hold Ctrl+Shift+Space ──▶ speak ──▶ release
        │
        ├─ microphone capture in the page (getUserMedia + AudioWorklet, muted output)
        ├─ encoded as the canonical 16 kHz mono PCM16 WAV the Remote requires
        ├─ ctx.remote.speech.transcribe()      ← official speech Remote (SenseVoice)
        └─ inputActions.insertText() / submit() ← official composer
```

## What it does

- **Push to talk**: `hold` (record while held) or `toggle` (press to start, press
  to stop) trigger modes.
- **Fill or send**: insert the transcript for review, or submit it immediately.
- **Reuses DSH's engine**: the same local SenseVoice provider the official
  microphone button uses — no extra process, model download, or cloud API.
- **Composer-native insertion**: text is spliced into the live draft through
  `inputActions.insertText`, so the caret, references, and attachments survive.
- **Configurable per browser**: hotkey, mode, send behaviour, beeps, and
  diagnostics live in a popover on the composer pill (`localStorage`).
- **Works on the new-conversation screen too**: with no session open there is no
  composer draft to splice into, so the transcript is pasted into the focused
  composer as a normal edit, and the pill returns with the first session.
- **Diagnosable**: optional per-keystroke log with audio level, audio length, and
  inference time, which separates "nothing was picked up" from "the recognizer
  missed it".

## Requirements

- DSH `0.2.0-rc.2` or a compatible release, Web profile.
- The official **voice input** bundle enabled (plugin manager → 语音输入). It
  provides the speech engine; without it the pill reports that no recognizer is
  mounted.

## Install

```sh
# from a checkout
dsh plugin --profile web add /path/to/dsh-dictation-hotkey

# or straight from git (no clone, no build: the bundle is committed)
dsh plugin --profile web add github:AndyYang12345/dsh-dictation-hotkey
```

Then reload the Web UI. The bundle is committed at `client/dist/client.js`, so a
checkout works without a build step.

Updating later: `dsh plugin --profile web add github:AndyYang12345/dsh-dictation-hotkey`
again and restart `dsh web` — a profile keeps its own copy of the installed
package, so pushing to GitHub does not update an already-installed profile by
itself.

## Use

A **🎙 Dictation** pill appears under the composer:

| Action | Result |
|---|---|
| Hold `Ctrl+Shift+Space`, speak, release | Transcript inserted into the composer |
| Click the pill | Settings: hotkey (press the keys to capture), fill ↔ send, hold ↔ toggle, beeps, diagnostics |

Releasing **any** key of the combination ends the recording, so there is no need
to lift them together.

On the home screen (no session yet) the pill is absent — the composer dock only
exists inside a session — but the hotkey still works: the controller stays armed
through a root-scope seat and the transcript is pasted into the focused composer.
Auto-send is skipped there, so sending stays your own keystroke.

## Settings

Stored per browser under `localStorage` key `dsh-dictation-hotkey.settings`.

| Field | Default | Meaning |
|---|---|---|
| `hotkey` | `Ctrl+Shift+Space` | `+`-separated combination; `Space`, `F9`, `Alt+~`, letters and digits are understood |
| `mode` | `hold` | `hold` = record while held, `toggle` = press to start/stop |
| `autoSend` | `false` | Submit the draft as soon as the transcript is inserted |
| `beep` | `true` | Short tones for start, stop, and failure |
| `language` | *(empty)* | Recognition language hint; empty follows the DSH speech settings |
| `providerId` | *(empty)* | Speech provider id; empty uses the deployment default |
| `minRecordMs` | `150` | Presses shorter than this are rejected with a visible notice |
| `tailMs` | `180` | Audio kept after release, so a fast release does not clip a syllable |
| `maxRecordSeconds` | `60` | Safety stop |
| `debug` | `false` | Keep the keystroke log |

## Diagnostics

Enable **诊断日志** in the popover; each keystroke then records a structured entry,
mirrored to the DevTools console and kept as a 20-entry ring buffer in
`localStorage` (`dsh-dictation-hotkey.log`, copy/clear buttons in the popover).

| `event` | Meaning |
|---|---|
| `start` | Microphone ready — `micStartMs`, triggering keys `heldCodes` |
| `stop` | Released — `heldMs`, `tailMs` |
| `ok` | Recognized — `audioSeconds`, `inferenceMs`, `chars`, `peakDb` |
| `empty-transcript` | Engine returned nothing — carries `peakDb`; `quiet: true` means the recording itself was near-silent |
| `skip` | Rejected by a threshold: `shorter than minRecordMs`, `empty audio`, `speech remote absent` |
| `transcribe-failed` / `mic-failed` / `insert-conflict` / `finish-threw` | Corresponding failure |

`peakDb > -45` with an empty transcript points at the recognizer (adjust
`language`); `peakDb < -45` means that take carried no usable sound.

## Development

```sh
npm run build     # build client/dist/client.js (esbuild)
npm run verify    # contract check: the bundle only touches injected services
npm test          # behaviour suite: fake microphone + recognizer
```

`verify.mjs` exists because Cordis throws when a plugin reads a service it did
not declare (`cannot get property "slots" without inject`) while the Web shell
only prints `web boot: 1 entry did not activate` — a diagnostic dead end this
plugin hit once, now a build-time check. `test-release.mjs` covers sloppy release
order, double taps, sub-threshold presses, empty transcripts, and auto-send.

## How it is wired

| Piece | Where |
|---|---|
| Hotkey, microphone, WAV encoding, state | `client/src/{index,controller,hotkey,audio,settings,ui}.js` |
| Composer seat (session-scoped) | `conversation.composer.dock` slot |
| Session-less seat | headless component in the root-scope `shell.overlay` slot |
| Recognition | `ctx.remote.speech.transcribe` — official speech Remote |
| Host half | `host/index.js`, intentionally a no-op (`apply() {}`) |
| Bundle layer | `cordis.patch.yml` inserts the plugin row |

The host half deliberately has no `@deepseek-ai/*` import and no service access:
a profile installs this package through a link, which resolves no dependencies for
it, so a host-side import would abort activation with `ERR_MODULE_NOT_FOUND` and
DSH would refuse to boot the Web GUI.

## Limitations

- Keys are handled while the DSH page is focused. A key pressed with another
  window in front never reaches the plugin; system-wide support needs an OS-level
  helper and is not implemented.
- Microphone permission is granted for the DSH origin. The first ever use may
  require clicking the official microphone button once.
- Recording is capped by `maxRecordSeconds` and by the Remote's own audio limits.

## License

[MIT](LICENSE) © 2026 AndyYang12345
