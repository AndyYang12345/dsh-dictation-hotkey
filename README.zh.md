# dsh-dictation-hotkey（中文说明）

给 DSH Web 输入框加一个「按住说话」入口：按住组合键说话，松开后由 **DSH 自带的语音引擎**识别，文字直接落进输入框。

本插件**不引入第二个识别器** —— 它调用 DSH 语音输入 Bundle 已经在用的那个语音 Remote（本地 SenseVoice，CPU 推理），并通过官方 composer 动作写入文字。

```
按住 Ctrl+Shift+Space ──▶ 说话 ──▶ 松开
        │
        ├─ 页面内麦克风采集（getUserMedia + AudioWorklet，静音输出不外放）
        ├─ 编码为 Remote 要求的规范 16 kHz 单声道 PCM16 WAV
        ├─ ctx.remote.speech.transcribe()      ← 官方语音 Remote（SenseVoice）
        └─ inputActions.insertText() / submit() ← 官方 composer
```

## 功能

- **按住说话**：`按住`（按住期间录音）或 `开关`（按一下开始、再按一下结束）两种触发方式。
- **填入或发送**：识别结果只填入输入框供你检查，或立刻发送。
- **复用 DSH 引擎**：与官方麦克风按钮同一个本地 SenseVoice Provider，不额外起进程、不下载模型、不走云端 API。
- **原生插入**：通过 `inputActions.insertText` 写进当前草稿，光标位置、引用与附件都不受影响。
- **按浏览器配置**：热键、触发方式、是否发送、提示音、诊断日志都在输入框下方胶囊的弹窗里改（存 `localStorage`）。
- **新会话页同样可用**：没有会话时不存在可插入的草稿，识别结果会以正常编辑的方式粘贴进当前聚焦的输入框；进入会话后胶囊回来。
- **可诊断**：可选逐次按键日志，含音频电平、音频长度、识别耗时，能明确区分「没拾到声音」与「引擎漏识」。

## 环境要求

- DSH `0.2.0-rc.2` 或兼容版本，web profile。
- 已启用官方**语音输入** Bundle（插件管理页 → 语音输入），它提供识别引擎；未启用时胶囊会提示识别未挂载。

## 安装

```sh
# 从本地目录
dsh plugin --profile web add /path/to/dsh-dictation-hotkey

# 或直接从 git 安装
dsh plugin --profile web add github:AndyYang12345/dsh-dictation-hotkey
```

然后刷新 Web 页面。构建产物 `client/dist/client.js` 已随仓库提交，直接 checkout 也能用，无需构建。

## 使用

输入框下方出现 **🎙 听写** 胶囊：

| 操作 | 结果 |
|---|---|
| 按住 `Ctrl+Shift+Space` 说话，松开 | 识别结果写入输入框 |
| 点击胶囊 | 设置：热键（按下即录制）、只填入 ↔ 自动发送、按住 ↔ 开关、提示音、诊断日志 |

松键时**抬起组合键中的任意一个键**都会结束录音，不需要三个键同时松开。

在**新会话页**（还没有会话时）看不到胶囊 —— 输入框停靠槽只在会话内存在 —— 但快捷键依然可用：
控制器通过一个根作用域的席位保持待命，识别结果粘贴进当前聚焦的输入框；该页面不自动发送，发送仍由你回车决定。

## 诊断

在弹窗里勾选**诊断日志**后，每次按键都会记录一条结构化数据（同时打到 DevTools 控制台，并在 `localStorage` 的 `dsh-dictation-hotkey.log` 保留最近 20 条，弹窗内可复制/清空）：

| `event` | 含义 |
|---|---|
| `start` | 麦克风就绪 —— `micStartMs`、触发键 `heldCodes` |
| `stop` | 松键 —— `heldMs`、`tailMs` |
| `ok` | 识别成功 —— `audioSeconds`、`inferenceMs`、`chars`、`peakDb` |
| `empty-transcript` | 引擎返回空 —— 含 `peakDb`；`quiet: true` 表示那一次几乎没有有效声音 |
| `skip` | 被门槛拦下：`shorter than minRecordMs`、`empty audio`、`speech remote absent` |
| `transcribe-failed` / `mic-failed` / `insert-conflict` / `finish-threw` | 对应故障 |

`peakDb > -45` 却识别为空 → 问题在识别（可调 `language`）；`peakDb < -45` → 那一次本来就没拾到有效声音。

## 开发

```sh
npm run build     # 构建 client/dist/client.js（esbuild）
npm run verify    # 契约自检：产物只触碰 inject 中声明的服务
npm test          # 行为测试：假麦克风 + 假识别引擎
```

`verify.mjs` 的由来：Cordis 里读未声明的服务会抛
`cannot get property "slots" without inject`，而 Web 外壳只显示一行
`web boot: 1 entry did not activate` —— 本插件踩过一次，现在把它变成构建期检查。
`test-release.mjs` 覆盖松键顺序、连点、过短按住、空结果、自动发送。

## 限制

- 只在 DSH 页面获得焦点时响应按键；其他窗口在前台时按键不会到达插件，系统级支持需要额外的操作系统层守护进程（未实现）。
- 麦克风授权按 DSH 站点授予；首次使用可能需要先点一次官方麦克风按钮。
- 录音受 `maxRecordSeconds` 与 Remote 自身的音频上限约束。

## 许可

[MIT](LICENSE) © 2026 AndyYang12345
