/**
 * Key listeners and the recording state machine. One instance per page;
 * composer seats register themselves so `insertText` targets the live draft.
 */

import { settings, record } from './settings.js'
import { parseHotkey, matchesHotkey, heldCodesOf } from './hotkey.js'
import { MicRecording, beep, toBase64 } from './audio.js'

function describe(failure) {
  return failure instanceof Error ? failure.message : String(failure)
}

class Controller {
  /**
   * @param remoteThunk - thunk returning the optional `remote` service.
   * @param dottedThunk - thunk returning the dotted `remote.speech` service.
   */
  constructor(remoteThunk, dottedThunk) {
    this.remote = remoteThunk
    this.lookupDotted = dottedThunk
    this.seats = []
    this.capture = null
    this.phase = 'idle'
    this.recordingSince = 0
    this.pendingStop = false
    /** Physical codes still down from the triggering combination. */
    this.heldCodes = null
    this.message = ''
    this.listeners = new Set()
    this.boundKeyDown = (event) => this.onKeyDown(event)
    this.boundKeyUp = (event) => this.onKeyUp(event)
    this.boundBlur = () => void this.cancel()
  }

  /** @returns disposer removing every listener this controller installed. */
  attach() {
    document.addEventListener('keydown', this.boundKeyDown, true)
    document.addEventListener('keyup', this.boundKeyUp, true)
    window.addEventListener('blur', this.boundBlur)
    return () => {
      document.removeEventListener('keydown', this.boundKeyDown, true)
      document.removeEventListener('keyup', this.boundKeyUp, true)
      window.removeEventListener('blur', this.boundBlur)
      void this.cancel()
    }
  }

  /** @param seat - `{actions, locked}` from a mounted composer seat. */
  addSeat(seat) {
    this.seats.push(seat)
    return () => {
      const index = this.seats.indexOf(seat)
      if (index >= 0) this.seats.splice(index, 1)
    }
  }

  /** The most recently mounted session seat is the one the composer shows. */
  active() {
    return this.seats.length === 0 ? null : this.seats[this.seats.length - 1]
  }

  subscribe(listener) {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  snapshot() {
    return { phase: this.phase, message: this.message, hotkey: settings().hotkey }
  }

  notify() {
    for (const listener of [...this.listeners]) listener()
  }

  setPhase(phase, message = '') {
    this.phase = phase
    this.message = message
    this.notify()
  }

  /**
   * The `speech` Remote namespace, or undefined if the transport is genuinely
   * absent. Never cached: the namespace is mounted by another plugin.
   */
  speech() {
    try {
      const dotted = this.lookupDotted()
      if (dotted !== undefined && dotted !== null) return dotted
    } catch {
      /* not mounted (or not injected) this instant — fall through */
    }
    const remote = this.remote()
    if (remote === undefined || remote === null) return undefined
    try {
      return remote.speech
    } catch {
      return undefined
    }
  }

  onKeyDown(event) {
    const match = parseHotkey(settings().hotkey)
    if (matchesHotkey(event, match) === false) return
    event.preventDefault()
    event.stopPropagation()
    if (event.repeat) return
    if (this.phase === 'recording') {
      if (settings().mode === 'toggle') void this.finish()
      return
    }
    if (this.phase === 'starting' || this.phase === 'transcribing') return
    // Remember which physical keys are still down. Release is matched against
    // this set, never against the combination again (see onKeyUp).
    this.heldCodes = heldCodesOf(match)
    void this.start()
  }

  onKeyUp(event) {
    const match = parseHotkey(settings().hotkey)
    const isHotkeyKey = matchesHotkey(event, match)
    if (isHotkeyKey) {
      event.preventDefault()
      event.stopPropagation()
    }
    if (settings().mode !== 'hold') return

    // Any key that took part in starting the recording ends it, even when the
    // human lets go of Space a moment before Ctrl. Requiring the exact
    // combination here used to lose whole utterances: releasing fast produced a
    // keyup that matched nothing, so `finish()` never ran and that recording
    // simply dangled.
    const held = this.heldCodes
    if ((this.phase === 'recording' || this.phase === 'starting') && held !== null) {
      if (isHotkeyKey || held.includes(event.code)) {
        event.preventDefault()
        this.heldCodes = null
        void this.finish()
      }
      return
    }
    if (isHotkeyKey && (this.phase === 'recording' || this.phase === 'starting')) {
      void this.finish()
    }
  }

  async start() {
    const seat = this.active()
    if (seat === null || seat.locked === true) {
      record({ event: 'skip', reason: 'no seat or locked' })
      this.flash('当前会话不可输入')
      return
    }
    const config = settings()
    this.pendingStop = false
    this.setPhase('starting')
    const capture = new MicRecording()
    this.capture = capture
    const startedAt = performance.now()
    try {
      await capture.start()
      if (this.capture !== capture) {
        await capture.dispose()
        return
      }
      this.recordingSince = performance.now()
      record({
        event: 'start',
        micStartMs: Math.round(this.recordingSince - startedAt),
        heldCodes: this.heldCodes,
      })
      if (config.beep) beep('start')
      this.setPhase('recording')
      if (this.pendingStop) {
        this.pendingStop = false
        void this.finish()
      }
    } catch (failure) {
      this.capture = null
      this.pendingStop = false
      await capture.dispose()
      record({ event: 'mic-failed', message: describe(failure) })
      this.fail(`无法使用麦克风：${describe(failure)}`)
    }
  }

  async finish() {
    try {
      await this.finishInner()
    } catch (failure) {
      record({ event: 'finish-threw', message: describe(failure) })
      this.fail(`听写异常：${describe(failure)}`)
    }
  }

  async finishInner() {
    const capture = this.capture
    if (capture === null) {
      if (this.phase === 'starting') this.pendingStop = true
      return
    }
    this.capture = null
    const config = settings()
    const releasedAt = performance.now()
    const held = this.recordingSince === 0 ? 0 : releasedAt - this.recordingSince
    this.recordingSince = 0
    this.setPhase('transcribing')
    if (config.beep) beep('stop')

    record({ event: 'stop', heldMs: Math.round(held), tailMs: Number(config.tailMs) || 0 })
    // Let the tail of the last syllable finish: without this a fast release can
    // clip the final word, which reads as "sometimes it did not recognize".
    const tail = Math.max(0, Number(config.tailMs) || 0)
    if (tail > 0) await new Promise((resolve) => window.setTimeout(resolve, tail))

    let wav
    try {
      wav = await capture.stop()
    } catch (failure) {
      record({ event: 'encode-failed', message: describe(failure) })
      this.fail(`录音失败：${describe(failure)}`)
      return
    }
    const audioBytes = wav.byteLength - 44
    const audioSeconds = audioBytes / 32000
    const peakDb = capture.peak > 0 ? Number((20 * Math.log10(capture.peak)).toFixed(1)) : -Infinity
    const level = { peakDb, quiet: peakDb < -45 }
    if (audioBytes <= 0) {
      record({ event: 'skip', reason: 'empty audio', heldMs: Math.round(held), tailMs: tail })
      this.setPhase('idle')
      return
    }
    if (held < config.minRecordMs) {
      record({
        event: 'skip',
        reason: 'shorter than minRecordMs',
        heldMs: Math.round(held),
        minRecordMs: config.minRecordMs,
        audioSeconds: Number(audioSeconds.toFixed(2)),
      })
      this.flash(`按住时间太短（${Math.round(held)}ms）`)
      return
    }
    const seat = this.active()
    if (seat === null) {
      record({ event: 'skip', reason: 'seat disappeared', heldMs: Math.round(held) })
      this.setPhase('idle')
      return
    }
    const span = seat.actions.captureInsertion()
    const speech = this.speech()
    if (speech === undefined) {
      record({ event: 'skip', reason: 'speech remote absent', heldMs: Math.round(held) })
      this.fail('语音识别未挂载：请在插件管理里启用「语音输入」')
      return
    }
    const request = { audioBase64: toBase64(wav) }
    if (config.providerId !== '') request.providerId = config.providerId
    if (config.language !== '') request.language = config.language
    const sentAt = performance.now()
    try {
      const result = await speech.transcribe(request, new AbortController().signal)
      const inferenceMs = Math.round(performance.now() - sentAt)
      if (result?.ok !== true) {
        record({
          event: 'transcribe-failed',
          heldMs: Math.round(held),
          audioSeconds: Number(audioSeconds.toFixed(2)),
          inferenceMs,
          message: result?.error?.message ?? 'unknown',
        })
        this.fail(`识别失败：${result?.error?.message ?? '未知错误'}`)
        return
      }
      const text = String(result.value?.text ?? '').trim()
      if (text === '') {
        record({
          event: 'empty-transcript',
          heldMs: Math.round(held),
          audioSeconds: Number(audioSeconds.toFixed(2)),
          inferenceMs,
          ...level,
        })
        this.setPhase('idle')
        this.flash(level.quiet ? '没听到声音（麦克风电平过低）' : '没有识别到内容')
        return
      }
      const target = this.active() ?? seat
      if (target.actions.insertText(text, span) === false) {
        if (target.actions.insertText(text, target.actions.captureInsertion()) === false) {
          record({ event: 'insert-conflict', chars: text.length })
          this.fail('输入框已被改动，文字未插入')
          return
        }
      }
      if (config.autoSend) target.actions.submit()
      record({
        event: 'ok',
        heldMs: Math.round(held),
        audioSeconds: Number(audioSeconds.toFixed(2)),
        inferenceMs,
        chars: text.length,
        autoSend: config.autoSend,
        ...level,
      })
      this.setPhase('idle')
      this.flash(config.autoSend ? '已发送' : '已填入输入框')
    } catch (failure) {
      record({ event: 'transcribe-failed', message: describe(failure) })
      this.fail(`识别失败：${describe(failure)}`)
    }
  }

  async cancel() {
    const capture = this.capture
    this.capture = null
    this.recordingSince = 0
    if (capture !== null) await capture.dispose()
    if (this.phase !== 'idle') this.setPhase('idle')
  }

  flash(text) {
    this.setPhase('notice', text)
    window.setTimeout(() => {
      if (this.phase === 'notice') this.setPhase('idle')
    }, 1800)
  }

  fail(text) {
    if (settings().beep) beep('error')
    this.flash(text)
  }
}

export { Controller, describe }
