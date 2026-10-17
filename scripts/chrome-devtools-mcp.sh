#!/usr/bin/env sh
# Chrome DevTools MCP server (performance traces, CPU throttling, console, network) for the AI
# agents, registered in .mcp.json. It drives its own Chrome profile, never your everyday one.
#
# - On your machine it opens your installed Chrome (visible), so you can watch it.
# - In a Claude Code cloud container it uses the pre-installed Chromium, headless.
#
# Typical use: `npm run dev`, then ask the agent to open http://localhost:5173, play, and record a
# performance trace (see proj-mgmt/research/R-010-performance.md).
set -e
VERSION=1.10.1
set -- --isolated --usageStatistics=false --performanceCrux=false --viewport 1280x800 "$@"
if [ -x /opt/pw-browsers/chromium ]; then
  set -- --headless --executablePath /opt/pw-browsers/chromium --chromeArg=--no-sandbox \
    --chromeArg=--autoplay-policy=no-user-gesture-required "$@"
fi
exec npx -y "chrome-devtools-mcp@$VERSION" "$@"
