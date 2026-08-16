#!/usr/bin/env bash
# Deploy this repo onto ~/.pi/agent (or $PI_CODING_AGENT_DIR).
# Never copies auth.json / sessions / platform binaries.
set -euo pipefail

REPO="$(cd "$(dirname "$0")" && pwd)"
DEST="${PI_CODING_AGENT_DIR:-$HOME/.pi/agent}"

ensure_pi() {
  if command -v pi >/dev/null 2>&1; then
    return 0
  fi
  echo "pi 不在 PATH 里，正在安装…"
  if command -v omarchy-pkg-add >/dev/null 2>&1; then
    omarchy-pkg-add pi-coding-agent-bin
  elif command -v yay >/dev/null 2>&1; then
    yay -S --needed pi-coding-agent-bin
  elif command -v npm >/dev/null 2>&1; then
    npm install -g --ignore-scripts @earendil-works/pi-coding-agent
  else
    echo "装不上 pi：需要 omarchy-pkg-add / yay / npm 之一" >&2
    exit 1
  fi
}

mkdir -p "$DEST"
cp "$REPO/AGENTS.md" "$DEST/AGENTS.md"

if [[ ! -f "$DEST/settings.json" ]]; then
  cp "$REPO/settings.json" "$DEST/settings.json"
  echo "写入 $DEST/settings.json"
else
  echo "保留已有 $DEST/settings.json（不覆盖模型/主题）"
fi

ensure_pi

# Re-installing an already-listed package is a no-op besides ensuring node_modules.
while IFS= read -r spec; do
  [[ -z "$spec" ]] && continue
  echo "pi install $spec"
  pi install "$spec"
done <<'PKGS'
npm:context-mode
npm:pi-subagents
npm:nowledge-mem-pi
npm:pi-web-access
npm:pi-powerline-footer
PKGS

echo
echo "配置已落到 $DEST"
echo "下一步在本机登录，不要拷 auth.json："
echo "  pi"
echo "  /login    # DeepSeek API key 或 ChatGPT Codex"
echo
echo "nowledge-mem-pi 还要单独配 nmem 客户端（URL / API key）。"
echo "技能：Pi 会读 ~/.agents/skills/。那套技能库要另同步，不在本仓库。"
