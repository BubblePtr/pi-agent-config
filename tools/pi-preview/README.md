# pi-preview

在**真实的 pi TUI** 里预览一个扩展的 UI 效果，不花推理费、不等真实模型。

模型被替换成一个按脚本回放的 mock provider：你在 TUI 里输入任何消息，mock 就按 scenario
吐出下一个回合（thinking / 正文 / 工具调用），从而驱动扩展的 `ctx.ui.setWidget`、
`setStatus`、`setFooter`、`custom()`、`registerMessageRenderer` 等渲染路径走完整流程。
`ExtensionContext` 由 pi SDK 真实提供，不是自己 stub 的。

## 用法

```bash
node tools/pi-preview/cli.ts <extension-entry> [--scenario <scenario.ts>]

# 等价的 npm script
npm run preview -- extensions/defaults.ts
npm run preview -- extensions/defaults.ts --scenario tools/pi-preview/scenarios/subagents.ts
```

- `<extension-entry>`：要预览的扩展入口文件（相对当前目录解析）。
- `--scenario`：回合脚本文件；不传则用内置脚本 `default-scenario.ts`。

退出方式和平常的 pi 一样：`Ctrl+D` 或 `/exit`。

### 必须用 Node 跑，不能用 Bun

**Bun 没实现 `node:v8` 的 `promiseHooks.createHook`**，而真实扩展会用到它
（`pi-subagents` 的 workflow runner 直接 `require("node:v8")` 并在缺失时抛
`NotImplementedError`），在 Bun 下预览会把本来正常的扩展显示成坏的。所以入口是
`node`（v22.18+ 自带 TypeScript 类型擦除，无需 `--experimental-strip-types`）；
用 `bun` 启动会直接报错并给出正确命令，不会半跑。

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

## 子进程 mock

有些扩展会自己 spawn `pi` 子进程（`pi-subagents` 的子代理就是），子进程会继承父会话的模型名
`pi-preview/mock`，但自己并不认识这个 provider，于是启动即失败
（`Model "pi-preview/mock:high" not found`），只能看到失败态 UI。

所以预览启动时会往隔离的 `$TMPDIR/pi-preview-agent/settings.json` 里写一条 pi 自己的
`extensions` 配置，指向 `child-extension.ts`。任何走常规扩展发现的 pi 子进程都会加载它，
拿到同一个 mock provider 和一段固定的子回合脚本（一次 `bash ls -1` + 一段总结），从而跑到
成功态——这样 `pi-subagents` 的进度、tool uses、usage 汇总才有东西可看。

这条注入是**扩展无关**的：写的是 pi 的通用设置项，不针对某个扩展。合并是幂等的，不会覆盖
pi 自己写进这个文件的键。

子回合脚本是固定的，不跟父 scenario 联动；要改就改 `child-extension.ts`。

限制：如果某个 subagent 的 agent 定义自己声明了 `extensions`，pi-subagents 会给子进程加
`--no-extensions`，此时环境注入不生效，那个子代理仍会失败。

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

- `cli.ts` — 参数解析、Bun 拦截；在导入 SDK **之前**设置环境变量隔离。
- `preview.ts` — 装配 resource loader、`InteractiveMode`。
- `mock-provider.ts` — faux provider 注册 + 把会话钉死在 mock 上（父子共用）。
- `scenario.ts` — scenario 类型、校验、推进、转成 assistant 消息（纯逻辑，有单测）。
- `child-mock.ts` — 把 `child-extension.ts` 写进隔离 settings.json（合并逻辑有单测）。
- `child-extension.ts` — 子进程侧扩展：注册同一个 mock + 固定子回合脚本。
- `default-scenario.ts` — 内置脚本，也可当作写自己 scenario 的模板。
- `scenarios/` — 现成的示例脚本（如 `subagents.ts`）。

单测：`node --test test/pi-preview-scenario.test.js`（或 `npm test`）。
TUI 整体启动属集成面，v1 手动验证。
