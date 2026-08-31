# pi-preview

在**真实的 pi TUI** 里预览一个扩展的 UI 效果，不花推理费、不等真实模型。

模型被替换成一个按脚本回放的 mock provider：你在 TUI 里输入任何消息，mock 就按 scenario
吐出下一个回合（thinking / 正文 / 工具调用），从而驱动扩展的 `ctx.ui.setWidget`、
`setStatus`、`setFooter`、`custom()`、`registerMessageRenderer` 等渲染路径走完整流程。
`ExtensionContext` 由 pi SDK 真实提供，不是自己 stub 的。

## 用法

```bash
bun tools/pi-preview/cli.ts <extension-entry> [--scenario <scenario.ts>]

# 等价的 npm script
npm run preview -- extensions/defaults.ts
npm run preview -- extensions/defaults.ts --scenario ./my-scenario.ts
```

- `<extension-entry>`：要预览的扩展入口文件（相对当前目录解析）。
- `--scenario`：回合脚本文件；不传则用内置脚本 `default-scenario.ts`。

退出方式和平常的 pi 一样：`Ctrl+D` 或 `/exit`。

## scenario 文件格式

默认导出一个**回合数组**。数组里每一项 = mock provider 对一次模型请求的应答：

```ts
// my-scenario.ts
export default [
  {
    thinking: "先看一眼目录。", // 可选
    text: "我来看看这里有什么。", // 可选
    toolCalls: [{ name: "bash", arguments: { command: "ls -1" } }], // 可选
  },
  { text: "这是项目根目录。" },
];
```

字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `thinking` | `string` | 思考流内容，会逐字流式输出 |
| `text` | `string` | 正文，会逐字流式输出 |
| `toolCalls` | `{ name, arguments? }[]` | 工具调用；`name` 必须是当前会话里真实存在的工具名 |

三者至少要有一个，否则启动时报错并指出是第几个回合。

**回合是按模型请求计数的，不是按用户消息计数的。** 带 `toolCalls` 的回合执行完工具后，
agent 会再请求一次模型，也就是消耗下一个回合。所以上面这个 2 回合的脚本，只需要用户发
一条消息就会全部跑完。

脚本跑完之后，mock 不会报错，而是持续返回一句 “scenario exhausted” 提示，TUI 依然可用。

## 已知限制 / 选型说明

- **工具是真跑的。** scenario 里的 `toolCalls` 会交给 pi 真实的工具执行（不是伪造结果），
  这样 `tool_call` / `tool_result` / `tool_execution_*` 事件和渲染都是真的。代价是：脚本里
  写 `bash rm -rf` 它就真的会删。请只在 scenario 里写安全命令。
- **只加载被预览的那一个扩展。** 内部用 `noExtensions: true` + 显式扩展路径，所以本仓库
  `package.json` 里 `pi.extensions` 声明的其它扩展、以及全局扩展都不会加载。要一起预览多个
  扩展，目前得自己写一个把它们串起来的入口。
- **不加载 skills。** skills 只进系统提示词，mock 根本不读，而它们的发现告警会淹没启动屏。
- **会话与配置写到临时目录。** 启动时把 `PI_CODING_AGENT_DIR` 指向
  `$TMPDIR/pi-preview-agent`，所以预览会话、`settings.json`、`auth.json` 都不会污染
  `~/.pi/agent/`。副作用是：你真实的 pi 设置（主题、tuiMode 等）在预览里不生效，预览是一份
  干净配置。要清理直接删掉那个目录。
- **强制离线。** 启动时设 `PI_OFFLINE=1`，关掉版本检查、模型目录刷新、包更新检查。可以断网
  或不配 API key 验证——不会有任何鉴权错误。
- **模型被锁定在 mock 上。** 预览用的内联扩展在 `session_start` 里最后一个执行，会把模型强行
  设回 mock，避免被预览的扩展（比如 `extensions/defaults.ts`）把会话切到真实计费模型。手动
  `Ctrl+P` 切模型在预览里没有意义。
- **没有 headless / 快照模式。** v1 只做人肉看效果；`VirtualTerminal` 快照路线留给 v2。

## 目录结构

- `cli.ts` — 参数解析；在导入 SDK **之前**设置环境变量隔离。
- `preview.ts` — 装配 mock provider、resource loader、`InteractiveMode`。
- `scenario.ts` — scenario 类型、校验、推进、转成 assistant 消息（纯逻辑，有单测）。
- `default-scenario.ts` — 内置脚本，也可当作写自己 scenario 的模板。

单测：`node --test test/pi-preview-scenario.test.js`（或 `npm test`）。
TUI 整体启动属集成面，v1 手动验证。
