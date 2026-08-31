# 01 — pi-preview：本地最小版 TUI 扩展预览工具

## 目标

扩展开发者不花一分钱推理费、不等真实模型，就能在真实的 pi TUI 里预览一个扩展的 UI 效果（widget、statusline、footer、custom 组件、消息渲染器），并可用脚本化的对话回合驱动 UI 状态变化。先做够自己用的最小版（放本仓库 `tools/pi-preview/`），验证价值后再抽独立 OSS 包。

## 背景事实（调研结论，实现依据）

- pi 的 TUI 是自研组件框架 `@earendil-works/pi-tui`（差分渲染、ANSI 输出），组件契约 `Component { render(width): string[]; handleInput?; invalidate? }`（pi-tui README:206-224）。**不是** React/Ink。
- 扩展画 UI 走 `ctx.ui.setWidget / setStatus / setFooter / custom() / registerMessageRenderer / registerEntryRenderer`，由生命周期事件驱动（`session_start`、`tool_result`、命令等），与模型 token 流解耦（`node_modules/@earendil-works/pi-coding-agent/docs/extensions.md:2556-2856`）。
- **mock 模型的正门**：`pi.registerProvider(createProvider({...}))` 接受任意 `Provider`/`streamSimple` 实现（`docs/custom-provider.md:35-62`）。
- **真实 TUI 的可编程入口**：SDK 暴露 `createAgentSession` / `createAgentSessionRuntime` / `InteractiveMode`（`docs/sdk.md:1029-1067`）。
- pi-tui 自带 `VirtualTerminal`（@xterm/headless），官方为测试而设（pi-tui README:686）——v1 不做快照模式，但架构别堵死这条路。
- RPC 模式会阉割 custom UI（`custom()` 返回 undefined、组件 widget 被降为纯文本，`docs/rpc.md:1166-1176`），所以预览必须走 TUI 路径，不走 RPC。
- 相关文档均在本仓库 `node_modules/@earendil-works/pi-coding-agent/docs/`（extensions.md、custom-provider.md、sdk.md、tui.md）。scout 未读完 `docs/tui.md`，实现前先读。

## 设计（v1 形态）

- CLI：`bun tools/pi-preview/cli.ts <extension-entry> [--scenario <scenario.ts>]`（或等价的 npm script `preview`）。
- 行为：用 scripted mock provider 启动真实 `InteractiveMode` 会话，加载指定扩展；用户在真 TUI 里交互，输入任何消息时 mock provider 按 scenario 脚本吐回合（文本 + 工具调用），从而驱动扩展 UI 全流程。
- scenario 文件：导出一个回合序列（每回合：assistant 文本、可选工具调用及模拟结果）；不传 scenario 时用一个内置默认脚本（几个回合的文本 + 一次 bash 工具调用）。
- 真实的 `ExtensionContext` 由 SDK 会话提供——**不得**自己 stub ctx（stub 会随 pi 版本漂移，是被否决的路线）。

## 验收标准

- [ ] `bun tools/pi-preview/cli.ts extensions/defaults.ts` 能启动真实 pi TUI，加载本仓库自己的 defaults 扩展，零网络推理调用（可用断网或未设 API key 环境验证不报鉴权错）。
- [ ] mock provider 按 scenario 逐回合返回，扩展在 `session_start`/回合事件里做的 `ctx.ui.*` 调用正常渲染。
- [ ] scenario 支持至少：纯文本回合、带工具调用的回合（工具真实执行或按 scenario 提供的假结果，二选一，选型写进报告）。
- [ ] 退出干净（Ctrl+C/退出命令不留孤儿进程、不污染 `~/.pi/agent/sessions`——预览会话写到临时目录或明确隔离的会话目录，选型写进报告）。
- [ ] 解析/脚本推进等纯逻辑有单测（`node --test` 或与仓库现有 test 惯例一致）；TUI 整体启动属集成面，v1 手动验证即可，命令写进报告。
- [ ] README（`tools/pi-preview/README.md`，中文）：用途、用法、scenario 文件格式、已知限制。

## 范围外（v1 不做）

- headless 快照/CI 模式（VirtualTerminal 路线，v2）。
- session JSONL replay 驱动历史渲染。
- 发布为独立 npm 包、进 awesome-pi（验证后再抽）。
- 预览第三方任意扩展的兼容性矩阵——v1 以本仓库 extensions/ 与已装包能跑为准。
