# 任务简报：pi-preview 本地最小版

## 关联 Spec

`/Users/void/code/pi-agent-config/.scratch/pi-preview/issues/01-pi-preview-minimal.md` — 目标与验收标准以该文件为准。

## 背景

仓库 `/Users/void/code/pi-agent-config`（用户的 pi 预设配置仓，main 分支干净）。这是一个新的开发者工具，最终会抽成 OSS 包，但 v1 只求自己够用。spec 的"背景事实"节含全部调研结论与文档定位；动手前先读 `node_modules/@earendil-works/pi-coding-agent/docs/` 下的 sdk.md、custom-provider.md、tui.md、extensions.md 相关章节（scout 未读完 tui.md，SDK bootstrap 细节以文档为准，不要按 spec 里的行号盲信——先核对）。

## 涉及文件

- `tools/pi-preview/` — 新建，全部实现放这里
- `extensions/defaults.ts` — 验收用的被预览扩展
- `package.json` — 如需加 `preview` script 或 devDependency（SDK 包已在 node_modules）
- `test/` — 仓库现有测试惯例（`node --test`）

## 约束

- 新分支 `feat/pi-preview`（基于 main），不 push。
- TypeScript 用 Bun 跑（仓库惯例）；不引入新的重依赖——pi SDK、pi-tui 都已在 node_modules。
- 不得自己 stub `ExtensionContext`（spec 已否决该路线）。
- 不改 `defaults.json`、`AGENTS.md` 与现有 extensions 行为。
- 代码注释英文；README 中文；Conventional Commits。
- 如果 SDK 实际不暴露 spec 假设的入口（如 `InteractiveMode` 不可编程构造），停下来返回 needs-decision，附你在文档/类型里查到的证据和可行替代，不要自行换大方向。

## 范围外

见 spec"范围外"节。