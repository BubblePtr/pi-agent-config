# Pi Agent 配置

把本机 `~/.pi/agent` 里**能分发**的部分单独拆出来。目标是 macOS 和 [Omarchy](https://omarchy.org) 装同一套模型、包和全局指令，而不是把整个 `~/.pi` 打成 tar。

## 为什么不能整目录拷

| 路径 | 为什么留下 |
|------|------------|
| `auth.json` | DeepSeek key、Codex OAuth，明文 |
| `trust.json` | 本机绝对路径（`/Users/void/...`） |
| `bin/fd` `bin/rg` | macOS arm64 二进制，Linux 跑不起来 |
| `sessions/` | 会话记录，且很大 |
| `npm/` | 按机器重装，跨架构原生模块会坏 |
| `extensions/muxy-notify.ts` | 已经不存在；Muxy 是 macOS 通知，Omarchy 用不上 |

本仓库只跟踪：

- `settings.json` — 默认模型 / 思考级别 / 包清单 / 主题
- `AGENTS.md` — 全局指令
- `install.sh` — 落到 `~/.pi/agent` 并 `pi install` 那些包

## 当前生效

| 项 | 值 |
|---|---|
| Pi | `@earendil-works/pi-coding-agent` 0.84.2 |
| 模型 | `deepseek` / `deepseek-v4-flash`，思考 `xhigh` |
| 主题 | `dark` |
| 包 | `context-mode`、`pi-subagents`、`nowledge-mem-pi`、`pi-web-access`、`pi-powerline-footer` |

## 安装

### 1. 装 Pi 本体

**macOS：**

```bash
npm install -g --ignore-scripts @earendil-works/pi-coding-agent
```

**Omarchy：** AUR 有预编译包（x86_64 / aarch64）：

```bash
omarchy-pkg-add pi-coding-agent-bin
# 或：yay -S pi-coding-agent-bin
```

`pi install npm:…` 还需要系统里有 `npm`。Omarchy 一般已带 Node。

### 2. 部署这份配置

```bash
git clone https://github.com/BubblePtr/pi-agent-config.git
cd pi-agent-config
chmod +x install.sh
./install.sh
```

脚本会：

1. 覆盖写入 `~/.pi/agent/AGENTS.md`
2. 若还没有 `settings.json` 就拷一份模板；已有则不动（免得冲掉你在那台机器上改的模型）
3. 按清单 `pi install` 五个 npm 包

### 3. 本机登录

```bash
pi
```

进 TUI 后 `/login`：DeepSeek 填 API key，ChatGPT Codex 走 OAuth。凭证只写在本机 `~/.pi/agent/auth.json`。

`nowledge-mem-pi` 另外要配 nmem 客户端（`nmem config client set url …` / `api-key`）。那也不进 git。

## 技能

Pi 会自动扫 `~/.agents/skills/`。本机那些 skill 大多是链到 `~/.mirasim/skills` 的，**不在这个仓库里**。Omarchy 上若也要同一套技能，单独同步 `~/.agents`（或再跑一遍 skill 安装），不要指望克隆本仓库就带上。

`tldraw-offline` 是桌面画布技能，Linux 上一般没用。

## 更新

改完 `AGENTS.md` 或包清单后，在这个仓库提交推送，另一台机器：

```bash
git pull
./install.sh
```
