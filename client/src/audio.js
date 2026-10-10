/**
 * Microphone capture, resampling, beep tones and WAV/base64 encoding.
 *
 * An AudioWorklet forwards raw mono frames and the graph terminates in a muted
 * gain node, so nothing is played back while recording.
 */

/** Source of the AudioWorklet processor forwarding raw mono frames. */
const COLLECTOR_SOURCE = `
class DshPttCollector extends AudioWorkletProcessor {
  process(inputs) {
    const input = inputs[0]
    if (input !== undefined && input[0] !== undefined) {
      this.port.postMessage(new Float32Array(input[0]))
    }
    return true
  }
}
registerProcessor('dsh-ptt-collector', DshPttCollector)
`

/** One blob URL per page, reused by every recording. */
function collectorUrl() {
  if (window.__DSH_PTT_WORKLET_URL__ === undefined) {
    window.__DSH_PTT_WORKLET_URL__ = URL.createObjectURL(
      new Blob([COLLECTOR_SOURCE], { type: 'application/javascript' }),
    )
  }
  return window.__DSH_PTT_WORKLET_URL__
}

function mergeChunks(chunks, total) {
  const merged = new Float32Array(total)
  let offset = 0
  for (const chunk of chunks) {
    merged.set(chunk, offset)
    offset += chunk.length
  }
  return merged
}

/** Linear resampling is enough for 16 kHz speech input. */
function resampleTo16k(samples, inputRate) {
  const target = 16000
  if (inputRate === target) return samples
  const ratio = inputRate / target
  const length = Math.max(1, Math.floor(samples.length / ratio))
  const out = new Float32Array(length)
  for (let i = 0; i < length; i += 1) {
    const position = i * ratio
    const left = Math.floor(position)
    const right = Math.min(left + 1, samples.length - 1)
    const weight = position - left
    out[i] = samples[left] * (1 - weight) + samples[right] * weight
  }
  return out
}

/** Encode mono samples as the canonical WAV the speech Remote accepts. */
function encodeWav(samples) {
  const bytes = new Uint8Array(44 + samples.length * 2)
  const view = new DataView(bytes.buffer)
  const text = (at, value) => {
    for (let i = 0; i < value.length; i += 1) bytes[at + i] = value.charCodeAt(i)
  }
  text(0, 'RIFF')
  view.setUint32(4, bytes.length - 8, true)
  text(8, 'WAVE')
  text(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, 16000, true)
  view.setUint32(28, 32000, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  text(36, 'data')
  view.setUint32(40, samples.length * 2, true)
  for (let i = 0; i < samples.length; i += 1) {
    const value = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(44 + i * 2, Math.round(value * (value < 0 ? 32768 : 32767)), true)
  }
  return bytes
}

/** The JSON Remote carrier takes base64 without a data-URL prefix. */
function toBase64(bytes) {
  let text = ''
  for (let i = 0; i < bytes.length; i += 8192) {
    text += String.fromCharCode(...bytes.subarray(i, i + 8192))
  }
  return btoa(text)
}

/** One microphone acquisition with its peak level for diagnostics. */
class MicRecording {
  constructor() {
    this.stream = null
    this.context = null
    this.node = null
    this.chunks = []
    this.samples = 0
    this.sampleRate = 48000
    this.stopped = false
    /** Loudest absolute sample seen while recording. */
    this.peak = 0
  }

  async start() {
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: false,
    })
    const context = new AudioContext()
    this.context = context
    this.sampleRate = context.sampleRate
    if (context.state === 'suspended') await context.resume()
    await context.audioWorklet.addModule(collectorUrl())
    const source = context.createMediaStreamSource(this.stream)
    const node = new AudioWorkletNode(context, 'dsh-ptt-collector', {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [1],
    })
    this.node = node
    node.port.onmessage = (event) => {
      if (this.stopped) return
      const frame = event.data
      this.chunks.push(frame)
      this.samples += frame.length
      // Peak level tells "silent recording" apart from "speech not recognized".
      for (let i = 0; i < frame.length; i += 1) {
        const absolute = frame[i] < 0 ? -frame[i] : frame[i]
        if (absolute > this.peak) this.peak = absolute
      }
    }
    const sink = context.createGain()
    sink.gain.value = 0
    source.connect(node)
    node.connect(sink)
    sink.connect(context.destination)
  }

  /** Stop capture and return canonical 16 kHz mono PCM16 WAV bytes. */
  async stop() {
    this.stopped = true
    if (this.node !== null) this.node.port.onmessage = null
    if (this.context !== null) {
      try {
        await this.context.close()
      } catch {
        /* an already-closed context is fine */
      }
    }
    if (this.stream !== null) {
      for (const track of this.stream.getTracks()) track.stop()
    }
    const merged = mergeChunks(this.chunks, this.samples)
    const wav = encodeWav(resampleTo16k(merged, this.sampleRate))
    this.chunks = []
    return wav
  }

  async dispose() {
    try {
      await this.stop()
    } catch {
      /* dispose never throws */
    }
  }
}

/** Short Web Audio blips for start, stop and failure. */
function beep(kind) {
  try {
    if (window.__DSH_PTT_BEEP_CONTEXT__ === undefined) {
      window.__DSH_PTT_BEEP_CONTEXT__ = new AudioContext()
    }
    const context = window.__DSH_PTT_BEEP_CONTEXT__
    if (context.state === 'suspended') void context.resume()
    const now = context.currentTime
    const notes = kind === 'start' ? [880] : kind === 'stop' ? [660] : [320, 240]
    notes.forEach((frequency, index) => {
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      oscillator.type = 'sine'
      oscillator.frequency.value = frequency
      const at = now + index * 0.09
      gain.gain.setValueAtTime(0.0001, at)
      gain.gain.exponentialRampToValueAtTime(0.12, at + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.07)
      oscillator.connect(gain)
      gain.connect(context.destination)
      oscillator.start(at)
      oscillator.stop(at + 0.08)
    })
  } catch {
    /* audio feedback is optional */
  }
}

export { MicRecording, beep, toBase64 }
