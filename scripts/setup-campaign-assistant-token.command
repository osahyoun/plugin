#!/usr/bin/env bash
set -euo pipefail

TOKEN_ENV_VAR="EKO_SUPER_SEARCH_MCP_TOKEN"
ENV_FILE="${HOME}/.codex/campaign-assistant.env"
LAUNCH_AGENT="${HOME}/Library/LaunchAgents/org.eko.campaign-assistant-token.plist"

prompt_token() {
  if command -v osascript >/dev/null 2>&1; then
    osascript <<'APPLESCRIPT'
try
  set dialogResult to display dialog "Paste the Eko super-search MCP token. It will be saved locally and used by Codex." default answer "" with hidden answer buttons {"Cancel", "Save Token"} default button "Save Token" cancel button "Cancel"
  return text returned of dialogResult
on error number -128
  return ""
end try
APPLESCRIPT
    return
  fi

  read -r -s -p "Paste Eko super-search MCP token: " token
  echo
  printf '%s\n' "${token}"
}

TOKEN="$(prompt_token | tr -d '\r\n')"
if [ -z "${TOKEN}" ]; then
  echo "No token supplied. Nothing changed."
  exit 1
fi

mkdir -p "${HOME}/.codex" "${HOME}/Library/LaunchAgents"
umask 077
printf 'export %s=%q\n' "${TOKEN_ENV_VAR}" "${TOKEN}" > "${ENV_FILE}"
chmod 600 "${ENV_FILE}"

cat > "${LAUNCH_AGENT}" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>org.eko.campaign-assistant-token</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/zsh</string>
    <string>-lc</string>
    <string>source "\${HOME}/.codex/campaign-assistant.env" &amp;&amp; launchctl setenv EKO_SUPER_SEARCH_MCP_TOKEN "\${EKO_SUPER_SEARCH_MCP_TOKEN}"</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
</dict>
</plist>
PLIST
chmod 600 "${LAUNCH_AGENT}"

launchctl setenv "${TOKEN_ENV_VAR}" "${TOKEN}" >/dev/null 2>&1 || true
launchctl bootout "gui/${UID}" "${LAUNCH_AGENT}" >/dev/null 2>&1 || true
launchctl bootstrap "gui/${UID}" "${LAUNCH_AGENT}" >/dev/null 2>&1 || true
launchctl kickstart -k "gui/${UID}/org.eko.campaign-assistant-token" >/dev/null 2>&1 || true

echo "Saved token file: ${ENV_FILE}"
echo "Installed login token loader: ${LAUNCH_AGENT}"
echo
echo "Restart Codex.app, then start a new thread and try @campaign-assistant again."

if command -v osascript >/dev/null 2>&1; then
  osascript <<'APPLESCRIPT' >/dev/null 2>&1 || true
display dialog "Campaign Assistant token saved. Restart Codex.app, then start a new thread and try @campaign-assistant again." buttons {"OK"} default button "OK"
APPLESCRIPT
fi
