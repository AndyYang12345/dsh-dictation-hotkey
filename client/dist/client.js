window.__ModuleLoader__.load({ id: "dsh-dictation-hotkey", factory: function (require) { var module = { exports: {} }; var exports = module.exports; Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name2 in all)
    __defProp(target, name2, { get: all[name2], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// client/src/index.js
var index_exports = {};
__export(index_exports, {
  apply: () => apply,
  inject: () => inject,
  name: () => name
});
module.exports = __toCommonJS(index_exports);

// client/src/settings.js
var STORE_KEY = "dsh-dictation-hotkey.settings";
var DEFAULTS = {
  hotkey: "Ctrl+Shift+Space",
  mode: "hold",
  autoSend: false,
  providerId: "",
  language: "",
  minRecordMs: 150,
  maxRecordSeconds: 60,
  /** Grace added after release so a word cut off mid-syllable stays whole. */
  tailMs: 180,
  beep: true,
  /** Keep a per-keystroke diagnostic log in localStorage (ring buffer). */
  debug: false
};
var OVERRIDABLE = ["hotkey", "mode", "autoSend", "beep", "language", "debug"];
function readStored() {
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    if (raw === null) return {};
    const parsed = JSON.parse(raw);
    return parsed !== null && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}
function writeStored(patch) {
  try {
    window.localStorage.setItem(STORE_KEY, JSON.stringify({ ...readStored(), ...patch }));
  } catch {
  }
}
function removeStored(key = STORE_KEY) {
  try {
    window.localStorage.removeItem(key);
  } catch {
  }
}
var LOG_KEY = "dsh-dictation-hotkey.log";
var LOG_LIMIT = 20;
function record(entry) {
  const line = { at: (/* @__PURE__ */ new Date()).toISOString(), ...entry };
  try {
    console.info("[dictation-hotkey]", line);
  } catch {
  }
  if (settings().debug !== true) return;
  try {
    const raw = window.localStorage.getItem(LOG_KEY);
    const rows = raw === null ? [] : JSON.parse(raw);
    const next = Array.isArray(rows) ? [...rows, line].slice(-LOG_LIMIT) : [line];
    window.localStorage.setItem(LOG_KEY, JSON.stringify(next));
  } catch {
  }
}
function settings() {
  const stored = readStored();
  const merged = { ...DEFAULTS };
  for (const key of OVERRIDABLE) {
    if (typeof stored[key] === typeof DEFAULTS[key]) merged[key] = stored[key];
  }
  return merged;
}

// client/src/hotkey.js
var MOD_ALIASES = /* @__PURE__ */ new Set(["mod", "cmdorctrl", "commandorcontrol"]);
var MODIFIER_ALIASES = {
  ctrl: "ctrl",
  control: "ctrl",
  alt: "alt",
  option: "alt",
  shift: "shift",
  meta: "meta",
  cmd: "meta",
  command: "meta",
  super: "meta",
  win: "meta"
};
var CODE_ALIASES = {
  space: "Space",
  spacebar: "Space",
  enter: "Enter",
  return: "Enter",
  tab: "Tab",
  escape: "Escape",
  esc: "Escape",
  backspace: "Backspace",
  delete: "Delete",
  insert: "Insert",
  home: "Home",
  end: "End",
  pageup: "PageUp",
  pagedown: "PageDown",
  up: "ArrowUp",
  down: "ArrowDown",
  left: "ArrowLeft",
  right: "ArrowRight",
  "`": "Backquote",
  "~": "Backquote",
  "-": "Minus",
  "=": "Equal",
  "[": "BracketLeft",
  "]": "BracketRight",
  "\\": "Backslash",
  ";": "Semicolon",
  "'": "Quote",
  ",": "Comma",
  ".": "Period",
  "/": "Slash"
};
function parseHotkey(spec) {
  if (typeof spec !== "string" || spec.trim() === "") return null;
  const parts = spec.split("+").map((part) => part.trim()).filter(Boolean);
  const wanted = { ctrl: false, alt: false, shift: false, meta: false };
  let code = null;
  for (const part of parts) {
    const lower = part.toLowerCase();
    if (MOD_ALIASES.has(lower)) {
      wanted.ctrl = true;
      wanted.meta = true;
      continue;
    }
    const modifier = MODIFIER_ALIASES[lower];
    if (modifier !== void 0) {
      wanted[modifier] = true;
      continue;
    }
    if (CODE_ALIASES[lower] !== void 0) {
      code = CODE_ALIASES[lower];
      continue;
    }
    if (/^f([1-9]|1[0-9]|2[0-4])$/.test(lower)) {
      code = "F" + lower.slice(1);
      continue;
    }
    if (/^[a-z]$/.test(lower)) {
      code = "Key" + lower.toUpperCase();
      continue;
    }
    if (/^[0-9]$/.test(lower)) {
      code = "Digit" + lower;
      continue;
    }
  }
  if (code === null) return null;
  return {
    ctrl: wanted.ctrl,
    alt: wanted.alt,
    shift: wanted.shift,
    meta: wanted.meta,
    code,
    display: spec
  };
}
function heldCodesOf(match) {
  if (match === null) return [];
  const codes = [];
  if (match.ctrl) codes.push("ControlLeft", "ControlRight");
  if (match.alt) codes.push("AltLeft", "AltRight");
  if (match.shift) codes.push("ShiftLeft", "ShiftRight");
  if (match.meta) codes.push("MetaLeft", "MetaRight");
  codes.push(match.code);
  return codes;
}
function matchesHotkey(event, match) {
  if (match === null) return false;
  if (event.code !== match.code) return false;
  if (event.ctrlKey !== match.ctrl) return false;
  if (event.altKey !== match.alt) return false;
  if (event.shiftKey !== match.shift) return false;
  if (event.metaKey !== match.meta) return false;
  return true;
}

// client/src/audio.js
var COLLECTOR_SOURCE = `
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
`;
function collectorUrl() {
  if (window.__DSH_PTT_WORKLET_URL__ === void 0) {
    window.__DSH_PTT_WORKLET_URL__ = URL.createObjectURL(
      new Blob([COLLECTOR_SOURCE], { type: "application/javascript" })
    );
  }
  return window.__DSH_PTT_WORKLET_URL__;
}
function mergeChunks(chunks, total) {
  const merged = new Float32Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  return merged;
}
function resampleTo16k(samples, inputRate) {
  const target = 16e3;
  if (inputRate === target) return samples;
  const ratio = inputRate / target;
  const length = Math.max(1, Math.floor(samples.length / ratio));
  const out = new Float32Array(length);
  for (let i = 0; i < length; i += 1) {
    const position = i * ratio;
    const left = Math.floor(position);
    const right = Math.min(left + 1, samples.length - 1);
    const weight = position - left;
    out[i] = samples[left] * (1 - weight) + samples[right] * weight;
  }
  return out;
}
function encodeWav(samples) {
  const bytes = new Uint8Array(44 + samples.length * 2);
  const view = new DataView(bytes.buffer);
  const text = (at, value) => {
    for (let i = 0; i < value.length; i += 1) bytes[at + i] = value.charCodeAt(i);
  };
  text(0, "RIFF");
  view.setUint32(4, bytes.length - 8, true);
  text(8, "WAVE");
  text(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, 16e3, true);
  view.setUint32(28, 32e3, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, "data");
  view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i += 1) {
    const value = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, Math.round(value * (value < 0 ? 32768 : 32767)), true);
  }
  return bytes;
}
function toBase64(bytes) {
  let text = "";
  for (let i = 0; i < bytes.length; i += 8192) {
    text += String.fromCharCode(...bytes.subarray(i, i + 8192));
  }
  return btoa(text);
}
var MicRecording = class {
  constructor() {
    this.stream = null;
    this.context = null;
    this.node = null;
    this.chunks = [];
    this.samples = 0;
    this.sampleRate = 48e3;
    this.stopped = false;
    this.peak = 0;
  }
  async start() {
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      },
      video: false
    });
    const context = new AudioContext();
    this.context = context;
    this.sampleRate = context.sampleRate;
    if (context.state === "suspended") await context.resume();
    await context.audioWorklet.addModule(collectorUrl());
    const source = context.createMediaStreamSource(this.stream);
    const node = new AudioWorkletNode(context, "dsh-ptt-collector", {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [1]
    });
    this.node = node;
    node.port.onmessage = (event) => {
      if (this.stopped) return;
      const frame = event.data;
      this.chunks.push(frame);
      this.samples += frame.length;
      for (let i = 0; i < frame.length; i += 1) {
        const absolute = frame[i] < 0 ? -frame[i] : frame[i];
        if (absolute > this.peak) this.peak = absolute;
      }
    };
    const sink = context.createGain();
    sink.gain.value = 0;
    source.connect(node);
    node.connect(sink);
    sink.connect(context.destination);
  }
  /** Stop capture and return canonical 16 kHz mono PCM16 WAV bytes. */
  async stop() {
    this.stopped = true;
    if (this.node !== null) this.node.port.onmessage = null;
    if (this.context !== null) {
      try {
        await this.context.close();
      } catch {
      }
    }
    if (this.stream !== null) {
      for (const track of this.stream.getTracks()) track.stop();
    }
    const merged = mergeChunks(this.chunks, this.samples);
    const wav = encodeWav(resampleTo16k(merged, this.sampleRate));
    this.chunks = [];
    return wav;
  }
  async dispose() {
    try {
      await this.stop();
    } catch {
    }
  }
};
function beep(kind) {
  try {
    if (window.__DSH_PTT_BEEP_CONTEXT__ === void 0) {
      window.__DSH_PTT_BEEP_CONTEXT__ = new AudioContext();
    }
    const context = window.__DSH_PTT_BEEP_CONTEXT__;
    if (context.state === "suspended") void context.resume();
    const now = context.currentTime;
    const notes = kind === "start" ? [880] : kind === "stop" ? [660] : [320, 240];
    notes.forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      const at = now + index * 0.09;
      gain.gain.setValueAtTime(1e-4, at);
      gain.gain.exponentialRampToValueAtTime(0.12, at + 0.01);
      gain.gain.exponentialRampToValueAtTime(1e-4, at + 0.07);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(at);
      oscillator.stop(at + 0.08);
    });
  } catch {
  }
}

// client/src/controller.js
function describe(failure) {
  return failure instanceof Error ? failure.message : String(failure);
}
var Controller = class {
  /**
   * @param remoteThunk - thunk returning the optional `remote` service.
   * @param dottedThunk - thunk returning the dotted `remote.speech` service.
   */
  constructor(remoteThunk, dottedThunk) {
    this.remote = remoteThunk;
    this.lookupDotted = dottedThunk;
    this.seats = [];
    this.capture = null;
    this.phase = "idle";
    this.recordingSince = 0;
    this.pendingStop = false;
    this.heldCodes = null;
    this.message = "";
    this.listeners = /* @__PURE__ */ new Set();
    this.boundKeyDown = (event) => this.onKeyDown(event);
    this.boundKeyUp = (event) => this.onKeyUp(event);
    this.boundBlur = () => void this.cancel();
  }
  /** @returns disposer removing every listener this controller installed. */
  attach() {
    document.addEventListener("keydown", this.boundKeyDown, true);
    document.addEventListener("keyup", this.boundKeyUp, true);
    window.addEventListener("blur", this.boundBlur);
    return () => {
      document.removeEventListener("keydown", this.boundKeyDown, true);
      document.removeEventListener("keyup", this.boundKeyUp, true);
      window.removeEventListener("blur", this.boundBlur);
      void this.cancel();
    };
  }
  /** @param seat - `{actions, locked}` from a mounted composer seat. */
  addSeat(seat) {
    this.seats.push(seat);
    return () => {
      const index = this.seats.indexOf(seat);
      if (index >= 0) this.seats.splice(index, 1);
    };
  }
  /** The most recently mounted session seat is the one the composer shows. */
  active() {
    return this.seats.length === 0 ? null : this.seats[this.seats.length - 1];
  }
  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  snapshot() {
    return { phase: this.phase, message: this.message, hotkey: settings().hotkey };
  }
  notify() {
    for (const listener of [...this.listeners]) listener();
  }
  setPhase(phase, message = "") {
    this.phase = phase;
    this.message = message;
    this.notify();
  }
  /**
   * The `speech` Remote namespace, or undefined if the transport is genuinely
   * absent. Never cached: the namespace is mounted by another plugin.
   */
  speech() {
    try {
      const dotted = this.lookupDotted();
      if (dotted !== void 0 && dotted !== null) return dotted;
    } catch {
    }
    const remote = this.remote();
    if (remote === void 0 || remote === null) return void 0;
    try {
      return remote.speech;
    } catch {
      return void 0;
    }
  }
  onKeyDown(event) {
    const match = parseHotkey(settings().hotkey);
    if (matchesHotkey(event, match) === false) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.repeat) return;
    if (this.phase === "recording") {
      if (settings().mode === "toggle") void this.finish();
      return;
    }
    if (this.phase === "starting" || this.phase === "transcribing") return;
    this.heldCodes = heldCodesOf(match);
    void this.start();
  }
  onKeyUp(event) {
    const match = parseHotkey(settings().hotkey);
    const isHotkeyKey = matchesHotkey(event, match);
    if (isHotkeyKey) {
      event.preventDefault();
      event.stopPropagation();
    }
    if (settings().mode !== "hold") return;
    const held = this.heldCodes;
    if ((this.phase === "recording" || this.phase === "starting") && held !== null) {
      if (isHotkeyKey || held.includes(event.code)) {
        event.preventDefault();
        this.heldCodes = null;
        void this.finish();
      }
      return;
    }
    if (isHotkeyKey && (this.phase === "recording" || this.phase === "starting")) {
      void this.finish();
    }
  }
  async start() {
    const seat = this.active();
    if (seat === null || seat.locked === true) {
      record({ event: "skip", reason: "no seat or locked" });
      this.flash("\u5F53\u524D\u4F1A\u8BDD\u4E0D\u53EF\u8F93\u5165");
      return;
    }
    const config = settings();
    this.pendingStop = false;
    this.setPhase("starting");
    const capture = new MicRecording();
    this.capture = capture;
    const startedAt = performance.now();
    try {
      await capture.start();
      if (this.capture !== capture) {
        await capture.dispose();
        return;
      }
      this.recordingSince = performance.now();
      record({
        event: "start",
        micStartMs: Math.round(this.recordingSince - startedAt),
        heldCodes: this.heldCodes
      });
      if (config.beep) beep("start");
      this.setPhase("recording");
      if (this.pendingStop) {
        this.pendingStop = false;
        void this.finish();
      }
    } catch (failure) {
      this.capture = null;
      this.pendingStop = false;
      await capture.dispose();
      record({ event: "mic-failed", message: describe(failure) });
      this.fail(`\u65E0\u6CD5\u4F7F\u7528\u9EA6\u514B\u98CE\uFF1A${describe(failure)}`);
    }
  }
  async finish() {
    try {
      await this.finishInner();
    } catch (failure) {
      record({ event: "finish-threw", message: describe(failure) });
      this.fail(`\u542C\u5199\u5F02\u5E38\uFF1A${describe(failure)}`);
    }
  }
  async finishInner() {
    const capture = this.capture;
    if (capture === null) {
      if (this.phase === "starting") this.pendingStop = true;
      return;
    }
    this.capture = null;
    const config = settings();
    const releasedAt = performance.now();
    const held = this.recordingSince === 0 ? 0 : releasedAt - this.recordingSince;
    this.recordingSince = 0;
    this.setPhase("transcribing");
    if (config.beep) beep("stop");
    record({ event: "stop", heldMs: Math.round(held), tailMs: Number(config.tailMs) || 0 });
    const tail = Math.max(0, Number(config.tailMs) || 0);
    if (tail > 0) await new Promise((resolve) => window.setTimeout(resolve, tail));
    let wav;
    try {
      wav = await capture.stop();
    } catch (failure) {
      record({ event: "encode-failed", message: describe(failure) });
      this.fail(`\u5F55\u97F3\u5931\u8D25\uFF1A${describe(failure)}`);
      return;
    }
    const audioBytes = wav.byteLength - 44;
    const audioSeconds = audioBytes / 32e3;
    const peakDb = capture.peak > 0 ? Number((20 * Math.log10(capture.peak)).toFixed(1)) : -Infinity;
    const level = { peakDb, quiet: peakDb < -45 };
    if (audioBytes <= 0) {
      record({ event: "skip", reason: "empty audio", heldMs: Math.round(held), tailMs: tail });
      this.setPhase("idle");
      return;
    }
    if (held < config.minRecordMs) {
      record({
        event: "skip",
        reason: "shorter than minRecordMs",
        heldMs: Math.round(held),
        minRecordMs: config.minRecordMs,
        audioSeconds: Number(audioSeconds.toFixed(2))
      });
      this.flash(`\u6309\u4F4F\u65F6\u95F4\u592A\u77ED\uFF08${Math.round(held)}ms\uFF09`);
      return;
    }
    const seat = this.active();
    if (seat === null) {
      record({ event: "skip", reason: "seat disappeared", heldMs: Math.round(held) });
      this.setPhase("idle");
      return;
    }
    const span = seat.actions.captureInsertion();
    const speech = this.speech();
    if (speech === void 0) {
      record({ event: "skip", reason: "speech remote absent", heldMs: Math.round(held) });
      this.fail("\u8BED\u97F3\u8BC6\u522B\u672A\u6302\u8F7D\uFF1A\u8BF7\u5728\u63D2\u4EF6\u7BA1\u7406\u91CC\u542F\u7528\u300C\u8BED\u97F3\u8F93\u5165\u300D");
      return;
    }
    const request = { audioBase64: toBase64(wav) };
    if (config.providerId !== "") request.providerId = config.providerId;
    if (config.language !== "") request.language = config.language;
    const sentAt = performance.now();
    try {
      const result = await speech.transcribe(request, new AbortController().signal);
      const inferenceMs = Math.round(performance.now() - sentAt);
      if (result?.ok !== true) {
        record({
          event: "transcribe-failed",
          heldMs: Math.round(held),
          audioSeconds: Number(audioSeconds.toFixed(2)),
          inferenceMs,
          message: result?.error?.message ?? "unknown"
        });
        this.fail(`\u8BC6\u522B\u5931\u8D25\uFF1A${result?.error?.message ?? "\u672A\u77E5\u9519\u8BEF"}`);
        return;
      }
      const text = String(result.value?.text ?? "").trim();
      if (text === "") {
        record({
          event: "empty-transcript",
          heldMs: Math.round(held),
          audioSeconds: Number(audioSeconds.toFixed(2)),
          inferenceMs,
          ...level
        });
        this.setPhase("idle");
        this.flash(level.quiet ? "\u6CA1\u542C\u5230\u58F0\u97F3\uFF08\u9EA6\u514B\u98CE\u7535\u5E73\u8FC7\u4F4E\uFF09" : "\u6CA1\u6709\u8BC6\u522B\u5230\u5185\u5BB9");
        return;
      }
      const target = this.active() ?? seat;
      if (target.actions.insertText(text, span) === false) {
        if (target.actions.insertText(text, target.actions.captureInsertion()) === false) {
          record({ event: "insert-conflict", chars: text.length });
          this.fail("\u8F93\u5165\u6846\u5DF2\u88AB\u6539\u52A8\uFF0C\u6587\u5B57\u672A\u63D2\u5165");
          return;
        }
      }
      if (config.autoSend) target.actions.submit();
      record({
        event: "ok",
        heldMs: Math.round(held),
        audioSeconds: Number(audioSeconds.toFixed(2)),
        inferenceMs,
        chars: text.length,
        autoSend: config.autoSend,
        ...level
      });
      this.setPhase("idle");
      this.flash(config.autoSend ? "\u5DF2\u53D1\u9001" : "\u5DF2\u586B\u5165\u8F93\u5165\u6846");
    } catch (failure) {
      record({ event: "transcribe-failed", message: describe(failure) });
      this.fail(`\u8BC6\u522B\u5931\u8D25\uFF1A${describe(failure)}`);
    }
  }
  async cancel() {
    const capture = this.capture;
    this.capture = null;
    this.recordingSince = 0;
    if (capture !== null) await capture.dispose();
    if (this.phase !== "idle") this.setPhase("idle");
  }
  flash(text) {
    this.setPhase("notice", text);
    window.setTimeout(() => {
      if (this.phase === "notice") this.setPhase("idle");
    }, 1800);
  }
  fail(text) {
    if (settings().beep) beep("error");
    this.flash(text);
  }
};

// client/src/ui.js
var REACT = require("react");
var h = REACT.createElement;
function useController(controller) {
  const [, force] = REACT.useReducer((value) => value + 1, 0);
  REACT.useEffect(() => controller.subscribe(force), [controller]);
  return controller.snapshot();
}
function StatusPill({ controller }) {
  const state = useController(controller);
  const [open, setOpen] = REACT.useState(false);
  const label = state.phase === "recording" ? "\u25CF \u5F55\u97F3\u4E2D" : state.phase === "starting" ? "\u2026 \u542F\u52A8\u9EA6\u514B\u98CE" : state.phase === "transcribing" ? "\u2026 \u8BC6\u522B\u4E2D" : state.phase === "notice" ? state.message : "\u{1F399} \u542C\u5199";
  const title = state.phase === "idle" ? `\u6309\u4F4F ${state.hotkey} \u8BF4\u8BDD\uFF0C\u677E\u5F00\u5199\u5165\u8F93\u5165\u6846\uFF08\u70B9\u51FB\u6539\u952E\u4F4D\uFF09` : state.message !== "" ? state.message : `\u6309\u4F4F ${state.hotkey} \u8BF4\u8BDD`;
  return h(
    "span",
    { className: "ptt-wrap" },
    h(
      "button",
      {
        type: "button",
        className: "ptt-pill" + (state.phase === "recording" ? " ptt-pill--live" : "") + (state.phase === "notice" ? " ptt-pill--notice" : ""),
        title,
        onClick: () => setOpen((value) => !value)
      },
      label
    ),
    open ? h(SettingsPopover, { onClose: () => setOpen(false) }) : null
  );
}
function SettingsPopover({ onClose }) {
  const [config, setConfig] = REACT.useState(settings());
  const [capturing, setCapturing] = REACT.useState(false);
  const [message, setMessage] = REACT.useState("");
  const update = (patch) => {
    writeStored(patch);
    setConfig(settings());
  };
  REACT.useEffect(() => {
    if (capturing === false) return void 0;
    const onKey = (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (event.key === "Escape") {
        setCapturing(false);
        return;
      }
      if (["Control", "Alt", "Shift", "Meta"].includes(event.key)) return;
      const parts = [];
      if (event.ctrlKey) parts.push("Ctrl");
      if (event.altKey) parts.push("Alt");
      if (event.shiftKey) parts.push("Shift");
      if (event.metaKey) parts.push("Meta");
      const key = event.code.startsWith("Key") && event.code.length === 4 ? event.code.slice(3) : event.code;
      parts.push(key);
      update({ hotkey: parts.join("+") });
      setMessage(`\u5DF2\u6539\u4E3A ${parts.join("+")}`);
      setCapturing(false);
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [capturing]);
  return h(
    "div",
    { className: "ptt-popover" },
    h("div", { className: "ptt-popover__title" }, "\u542C\u5199\u5FEB\u6377\u952E"),
    h(
      "button",
      {
        type: "button",
        className: "ptt-row ptt-row--button",
        onClick: () => setCapturing(true)
      },
      h("span", null, "\u7EC4\u5408\u952E"),
      h("b", null, capturing ? "\u6309\u4E0B\u65B0\u7684\u7EC4\u5408\u952E\u2026" : config.hotkey)
    ),
    h(
      "label",
      { className: "ptt-row" },
      h("span", null, "\u677E\u952E\u540E"),
      h(
        "select",
        {
          value: config.autoSend ? "send" : "fill",
          onChange: (event) => update({ autoSend: event.target.value === "send" })
        },
        h("option", { value: "fill" }, "\u53EA\u586B\u5165\u8F93\u5165\u6846"),
        h("option", { value: "send" }, "\u81EA\u52A8\u53D1\u9001")
      )
    ),
    h(
      "label",
      { className: "ptt-row" },
      h("span", null, "\u89E6\u53D1\u65B9\u5F0F"),
      h(
        "select",
        {
          value: config.mode,
          onChange: (event) => update({ mode: event.target.value })
        },
        h("option", { value: "hold" }, "\u6309\u4F4F\u8BF4\u8BDD"),
        h("option", { value: "toggle" }, "\u6309\u4E00\u4E0B\u5F00\u59CB / \u518D\u6309\u7ED3\u675F")
      )
    ),
    h(
      "label",
      { className: "ptt-row" },
      h("span", null, "\u63D0\u793A\u97F3"),
      h("input", {
        type: "checkbox",
        checked: config.beep,
        onChange: (event) => update({ beep: event.target.checked })
      })
    ),
    h(
      "label",
      { className: "ptt-row" },
      h("span", null, "\u8BCA\u65AD\u65E5\u5FD7"),
      h("input", {
        type: "checkbox",
        checked: config.debug,
        onChange: (event) => update({ debug: event.target.checked })
      })
    ),
    config.debug ? h(
      "div",
      { className: "ptt-row" },
      h(
        "button",
        {
          type: "button",
          className: "ptt-close",
          onClick: () => {
            const raw = window.localStorage.getItem(LOG_KEY);
            setMessage(raw === null ? "\u8FD8\u6CA1\u6709\u8BB0\u5F55" : `\u5DF2\u590D\u5236 ${JSON.parse(raw).length} \u6761\u5230\u526A\u8D34\u677F`);
            void navigator.clipboard?.writeText(raw ?? "[]").catch(() => {
            });
          }
        },
        "\u590D\u5236\u65E5\u5FD7"
      ),
      h(
        "button",
        {
          type: "button",
          className: "ptt-close",
          onClick: () => {
            removeStored(LOG_KEY);
            setMessage("\u65E5\u5FD7\u5DF2\u6E05\u7A7A");
          }
        },
        "\u6E05\u7A7A"
      )
    ) : null,
    message !== "" ? h("div", { className: "ptt-hint" }, message) : null,
    h(
      "div",
      { className: "ptt-hint" },
      `\u8BC6\u522B\u8BED\u8A00\uFF1A${config.language === "" ? "\u8DDF\u968F DSH \u8BED\u97F3\u8BBE\u7F6E" : config.language}`
    ),
    h("button", { type: "button", className: "ptt-close", onClick: onClose }, "\u5173\u95ED")
  );
}
function Styles() {
  return h("style", {
    dangerouslySetInnerHTML: {
      __html: `
        .ptt-wrap{position:relative;display:inline-flex;align-items:center}
        .ptt-pill{min-height:26px;padding:0 8px;border:0;border-radius:6px;background:0;
          color:var(--dsw-alias-label-tertiary,#9a9ba1);font-size:12px;line-height:26px;
          cursor:pointer;white-space:nowrap;}
        .ptt-pill:hover{color:var(--dsw-alias-label-secondary,#c9cad0);
          background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.08));}
        .ptt-pill--live{color:#e8605c;}
        .ptt-pill--notice{color:var(--dsw-alias-brand-text,#8ab4ff);}
        .ptt-popover{position:absolute;bottom:calc(100% + 8px);right:0;z-index:1000;width:260px;
          display:flex;flex-direction:column;gap:6px;padding:12px;border-radius:10px;
          border:1px solid var(--dsw-alias-border-l2,#33353a);
          background:var(--dsw-specific-menu,var(--dsw-alias-bg-overlay,#1f2023));
          color:var(--dsw-alias-label-primary,#e8e8ea);font-size:12px;
          box-shadow:0 12px 32px rgba(0,0,0,.4);text-align:left;}
        .ptt-popover__title{font-size:13px;font-weight:600;margin-bottom:2px;}
        .ptt-row{display:flex;align-items:center;justify-content:space-between;gap:8px;}
        .ptt-row--button{cursor:pointer;border:1px solid var(--dsw-alias-border-l2,#33353a);
          background:var(--dsw-alias-bg-layer-1,transparent);border-radius:6px;padding:4px 8px;
          color:inherit;font:inherit;}
        .ptt-row select{background:var(--dsw-alias-bg-layer-2,rgba(255,255,255,.06));
          color:inherit;border:1px solid var(--dsw-alias-border-l2,#33353a);border-radius:6px;
          padding:2px 4px;font-size:12px;}
        .ptt-hint{color:var(--dsw-alias-label-caption,#8b8d94);font-size:11px;line-height:1.5;}
        .ptt-close{align-self:flex-end;border:1px solid var(--dsw-alias-border-l2,#33353a);
          background:0;color:var(--dsw-alias-label-secondary,#c9cad0);border-radius:6px;
          padding:2px 10px;font-size:12px;cursor:pointer;}
      `
    }
  });
}
function DictationSeat(props) {
  const { inputActions, locked } = props;
  const actionsRef = REACT.useRef(inputActions);
  actionsRef.current = inputActions;
  const lockedRef = REACT.useRef(locked);
  lockedRef.current = locked;
  REACT.useEffect(() => {
    const seat = {
      get actions() {
        return actionsRef.current;
      },
      get locked() {
        return Boolean(lockedRef.current);
      }
    };
    return window.__DSH_PTT_CONTROLLER__.addSeat(seat);
  }, []);
  return h(
    "div",
    { className: "ptt-dock" },
    h(Styles),
    h(StatusPill, { controller: window.__DSH_PTT_CONTROLLER__ })
  );
}

// client/src/index.js
var name = "dictation-hotkey";
var inject = ["slots", "remote.speech"];
function apply(ctx) {
  const controller = new Controller(
    () => {
      try {
        return ctx.get("remote");
      } catch {
        return void 0;
      }
    },
    () => ctx.get("remote.speech")
  );
  ctx.effect(() => {
    const detach = controller.attach();
    window.__DSH_PTT_CONTROLLER__ = controller;
    return () => {
      detach();
      if (window.__DSH_PTT_CONTROLLER__ === controller) {
        delete window.__DSH_PTT_CONTROLLER__;
      }
    };
  }, "dictation-hotkey: push-to-talk listeners");
  ctx.slots.inject(
    "conversation.composer.dock",
    () => ctx.slots.register(
      { name: "conversation.composer.dock", id: "dictation-hotkey", order: 90 },
      DictationSeat
    )
  );
}
return module.exports; } });
