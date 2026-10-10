/**
 * Composer pill, settings popover and their styles, rendered as React elements.
 */

import { settings, writeStored, removeStored, LOG_KEY } from './settings.js'

const REACT = require('react')
const h = REACT.createElement

function useController(controller) {
  const [, force] = REACT.useReducer((value) => value + 1, 0)
  REACT.useEffect(() => controller.subscribe(force), [controller])
  return controller.snapshot()
}

function StatusPill({ controller }) {
  const state = useController(controller)
  const [open, setOpen] = REACT.useState(false)
  const label =
    state.phase === 'recording'
      ? '● 录音中'
      : state.phase === 'starting'
        ? '… 启动麦克风'
        : state.phase === 'transcribing'
          ? '… 识别中'
          : state.phase === 'notice'
            ? state.message
            : '🎙 听写'
  const title =
    state.phase === 'idle'
      ? `按住 ${state.hotkey} 说话，松开写入输入框（点击改键位）`
      : state.message !== ''
        ? state.message
        : `按住 ${state.hotkey} 说话`
  return h(
    'span',
    { className: 'ptt-wrap' },
    h(
      'button',
      {
        type: 'button',
        className:
          'ptt-pill' +
          (state.phase === 'recording' ? ' ptt-pill--live' : '') +
          (state.phase === 'notice' ? ' ptt-pill--notice' : ''),
        title,
        onClick: () => setOpen((value) => !value),
      },
      label,
    ),
    open ? h(SettingsPopover, { onClose: () => setOpen(false) }) : null,
  )
}

function SettingsPopover({ onClose }) {
  const [config, setConfig] = REACT.useState(settings())
  const [capturing, setCapturing] = REACT.useState(false)
  const [message, setMessage] = REACT.useState('')
  const update = (patch) => {
    writeStored(patch)
    setConfig(settings())
  }
  REACT.useEffect(() => {
    if (capturing === false) return undefined
    const onKey = (event) => {
      event.preventDefault()
      event.stopPropagation()
      if (event.key === 'Escape') {
        setCapturing(false)
        return
      }
      if (['Control', 'Alt', 'Shift', 'Meta'].includes(event.key)) return
      const parts = []
      if (event.ctrlKey) parts.push('Ctrl')
      if (event.altKey) parts.push('Alt')
      if (event.shiftKey) parts.push('Shift')
      if (event.metaKey) parts.push('Meta')
      const key =
        event.code.startsWith('Key') && event.code.length === 4
          ? event.code.slice(3)
          : event.code
      parts.push(key)
      update({ hotkey: parts.join('+') })
      setMessage(`已改为 ${parts.join('+')}`)
      setCapturing(false)
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [capturing])
  return h(
    'div',
    { className: 'ptt-popover' },
    h('div', { className: 'ptt-popover__title' }, '听写快捷键'),
    h(
      'button',
      {
        type: 'button',
        className: 'ptt-row ptt-row--button',
        onClick: () => setCapturing(true),
      },
      h('span', null, '组合键'),
      h('b', null, capturing ? '按下新的组合键…' : config.hotkey),
    ),
    h(
      'label',
      { className: 'ptt-row' },
      h('span', null, '松键后'),
      h(
        'select',
        {
          value: config.autoSend ? 'send' : 'fill',
          onChange: (event) => update({ autoSend: event.target.value === 'send' }),
        },
        h('option', { value: 'fill' }, '只填入输入框'),
        h('option', { value: 'send' }, '自动发送'),
      ),
    ),
    h(
      'label',
      { className: 'ptt-row' },
      h('span', null, '触发方式'),
      h(
        'select',
        {
          value: config.mode,
          onChange: (event) => update({ mode: event.target.value }),
        },
        h('option', { value: 'hold' }, '按住说话'),
        h('option', { value: 'toggle' }, '按一下开始 / 再按结束'),
      ),
    ),
    h(
      'label',
      { className: 'ptt-row' },
      h('span', null, '提示音'),
      h('input', {
        type: 'checkbox',
        checked: config.beep,
        onChange: (event) => update({ beep: event.target.checked }),
      }),
    ),
    h(
      'label',
      { className: 'ptt-row' },
      h('span', null, '诊断日志'),
      h('input', {
        type: 'checkbox',
        checked: config.debug,
        onChange: (event) => update({ debug: event.target.checked }),
      }),
    ),
    config.debug
      ? h(
          'div',
          { className: 'ptt-row' },
          h(
            'button',
            {
              type: 'button',
              className: 'ptt-close',
              onClick: () => {
                const raw = window.localStorage.getItem(LOG_KEY)
                setMessage(raw === null ? '还没有记录' : `已复制 ${JSON.parse(raw).length} 条到剪贴板`)
                void navigator.clipboard?.writeText(raw ?? '[]').catch(() => {})
              },
            },
            '复制日志',
          ),
          h(
            'button',
            {
              type: 'button',
              className: 'ptt-close',
              onClick: () => {
                removeStored(LOG_KEY)
                setMessage('日志已清空')
              },
            },
            '清空',
          ),
        )
      : null,
    message !== '' ? h('div', { className: 'ptt-hint' }, message) : null,
    h(
      'div',
      { className: 'ptt-hint' },
      `识别语言：${config.language === '' ? '跟随 DSH 语音设置' : config.language}`,
    ),
    h('button', { type: 'button', className: 'ptt-close', onClick: onClose }, '关闭'),
  )
}

/** Styles ride with the component tree, so unmounting removes them. */
function Styles() {
  return h('style', {
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
      `,
    },
  })
}

/**
 * Session-scoped seat in the composer dock. Sitting in a session slot is what
 * hands the plugin that Session's `inputActions`, so a transcript lands where
 * the caret is while drafts and reference chips stay intact.
 */
function DictationSeat(props) {
  const { inputActions, locked } = props
  const actionsRef = REACT.useRef(inputActions)
  actionsRef.current = inputActions
  const lockedRef = REACT.useRef(locked)
  lockedRef.current = locked
  REACT.useEffect(() => {
    const seat = {
      get actions() {
        return actionsRef.current
      },
      get locked() {
        return Boolean(lockedRef.current)
      },
    }
    return window.__DSH_PTT_CONTROLLER__.addSeat(seat)
  }, [])
  return h(
    'div',
    { className: 'ptt-dock' },
    h(Styles),
    h(StatusPill, { controller: window.__DSH_PTT_CONTROLLER__ }),
  )
}

export { StatusPill, SettingsPopover, Styles, DictationSeat }
