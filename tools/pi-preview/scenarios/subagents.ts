// Scenario that fires the pi-subagents `subagent` tool so its live widget,
// progress rendering, and result block can be previewed in the TUI.
// The child pi process really spawns, and it loads the preview's child-side mock
// (see README "子进程 mock"), so the run reaches the success state: progress
// ticks, one real tool use, and the completed result block.
// pi-subagents returns the tool result immediately and finishes the run in the
// background, so this script needs a turn for the background completion too.
export default [
  {
    thinking: "Let me delegate this to a subagent.",
    text: "派一个 worker 子代理看看 widget 效果。",
    toolCalls: [
      {
        name: "subagent",
        arguments: {
          agent: "worker",
          task: "List the files in the current directory and summarize what this repo is.",
        },
      },
    ],
  },
  { text: "子代理已经在后台跑起来了，上面就是 pi-subagents 的工具结果渲染。" },
  { text: "后台运行结束，widget 应该已经变成 complete 成功态。" },
];
