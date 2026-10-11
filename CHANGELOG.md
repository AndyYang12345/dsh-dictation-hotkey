# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.1] - 2026-10-12

### Added

- Dictation works on the new-conversation screen: with no session the composer
  dock never renders, so a headless seat in the root-scope `shell.overlay` slot
  keeps the controller armed and the transcript is pasted into the focused
  composer as a normal edit (auto-send is skipped there).
- An activation diary (diagnostics toggle) records which slot declarations
  arrived and which seats mounted, which is how the session-less miss was
  pinned down.
- `test-release.mjs` gained a home-screen scenario asserting that the bridge
  seat registers, the take transcribes without a session, and the transcript
  reaches the focused composer.

## [0.2.0] - 2026-10-11

First public release.

### Added

- Push-to-talk dictation in the DSH Web composer: hold a key combination to
  record, release to transcribe. `hold` and `toggle` trigger modes.
- Recognition through DSH's own speech Remote (`ctx.remote.speech.transcribe`,
  the local SenseVoice engine from the official voice-input bundle) — no second
  model, process, or cloud API.
- Transcript insertion through the official composer actions
  (`inputActions.insertText` / `captureInsertion`), with an optional auto-send
  (`inputActions.submit`).
- Pill in `conversation.composer.dock` with an inline settings popover: hotkey
  capture, fill-vs-send, trigger mode, beeps, diagnostics. Stored per browser in
  `localStorage`.
- Audio-level diagnostics: every keystroke can be logged (console +
  `localStorage` ring buffer) with `peakDb`, `audioSeconds`, `inferenceMs`, so a
  silent recording is distinguishable from a recognizer miss.
- `verify.mjs` contract check: the built bundle may only touch services declared
  in its `inject` array.
- `test-release.mjs` behaviour suite with a fake microphone and recognizer:
  sloppy release order, double taps, sub-threshold presses, empty transcripts,
  auto-send.

### Fixed

- Release no longer requires the exact combination: the controller remembers the
  physical keys that started the recording, so letting go of any one of them
  ends it.
- `remote.speech` is declared in `inject` (it is a generated dotted service, and
  reading it without the declaration throws `cannot get property "remote.speech"
  without inject`, which failed the whole Web boot).
- The host half is a no-op with no `@deepseek-ai/*` import and no undeclared
  service access, so a linked install cannot break Web startup.
- 180 ms tail grace keeps the last syllable of a fast release, and the minimum
  hold dropped from 300 ms to 150 ms; a shorter press now says so instead of
  failing silently.

### Security

- No credentials in the repository: `.npmrc` documents the token variable
  instead of holding one.
