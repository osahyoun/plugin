#!/usr/bin/env bash
set -euo pipefail

PLUGIN_NAME="campaign-assistant"
MARKETPLACE_NAME="campaign-assistant"
TOKEN_SCRIPT_NAME="setup-campaign-assistant-token.command"

OPEN_PLUGIN=1
RUN_TOKEN_SETUP=1
PAUSE_AT_END=1

usage() {
  cat <<'USAGE'
Install Campaign Assistant for the Codex desktop app without requiring the Codex CLI.

Usage:
  ./scripts/install-campaign-assistant.command [options]

Options:
  --skip-token   Register and install the plugin, but do not prompt for the MCP token.
  --no-open      Do not open the Codex plugin page after installation.
  --no-pause     Do not wait for Return before exiting.
  -h, --help     Show this help.

For normal setup, double-click this file from Finder after unzipping the plugin.
USAGE
}

die() {
  echo "error: $*" >&2
  exit 1
}

pause_if_needed() {
  if [[ "${PAUSE_AT_END}" -eq 1 && -t 0 ]]; then
    echo
    read -r -p "Press Return to close this window..." _ || true
  fi
}

urlencode() {
  python3 -c 'import sys, urllib.parse; print(urllib.parse.quote(sys.argv[1], safe=""))' "$1"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-token)
      RUN_TOKEN_SETUP=0
      shift
      ;;
    --no-open)
      OPEN_PLUGIN=0
      shift
      ;;
    --no-pause)
      PAUSE_AT_END=0
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      usage >&2
      die "unknown option: $1"
      ;;
  esac
done

if [[ "$(uname -s)" != "Darwin" ]]; then
  die "this installer is for the macOS Codex desktop app"
fi

if ! command -v python3 >/dev/null 2>&1; then
  die "python3 is required; install Python 3 or run this from a Codex desktop environment"
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
MARKETPLACE_JSON="${REPO_ROOT}/.agents/plugins/marketplace.json"
PLUGIN_DIR="${REPO_ROOT}/plugins/${PLUGIN_NAME}"
PLUGIN_JSON="${PLUGIN_DIR}/.codex-plugin/plugin.json"
TOKEN_SCRIPT="${SCRIPT_DIR}/${TOKEN_SCRIPT_NAME}"

CODEX_HOME="${CODEX_HOME:-${HOME}/.codex}"
CONFIG_TOML="${CODEX_HOME}/config.toml"
CACHE_BASE="${CODEX_HOME}/plugins/cache/${MARKETPLACE_NAME}/${PLUGIN_NAME}"

[[ -f "${MARKETPLACE_JSON}" ]] || die "missing marketplace file: ${MARKETPLACE_JSON}"
[[ -d "${PLUGIN_DIR}" ]] || die "missing plugin directory: ${PLUGIN_DIR}"
[[ -f "${PLUGIN_JSON}" ]] || die "missing plugin manifest: ${PLUGIN_JSON}"

PLUGIN_VERSION="$(python3 - <<'PY' "${PLUGIN_JSON}" "${PLUGIN_NAME}"
import json
import sys
path, expected_name = sys.argv[1], sys.argv[2]
with open(path, "r", encoding="utf-8") as f:
    manifest = json.load(f)
name = manifest.get("name")
version = manifest.get("version")
if name != expected_name:
    raise SystemExit(f"manifest name {name!r} does not match {expected_name!r}")
if not version:
    raise SystemExit("manifest is missing version")
print(version)
PY
)"

CACHE_TARGET="${CACHE_BASE}/${PLUGIN_VERSION}"

echo "Installing Campaign Assistant for Codex..."
echo "Marketplace: ${MARKETPLACE_NAME}"
echo "Source: ${REPO_ROOT}"
echo "Version: ${PLUGIN_VERSION}"

mkdir -p "${CODEX_HOME}" "${CACHE_BASE}"

python3 - <<'PY' "${CONFIG_TOML}" "${MARKETPLACE_NAME}" "${REPO_ROOT}" "${PLUGIN_NAME}"
import datetime
import os
import re
import shutil
import sys

config_path, marketplace_name, source_root, plugin_name = sys.argv[1:5]
os.makedirs(os.path.dirname(config_path), exist_ok=True)

if os.path.exists(config_path):
    with open(config_path, "r", encoding="utf-8") as f:
        text = f.read()
    backup = config_path + ".campaign-assistant-install-backup"
    shutil.copy2(config_path, backup)
else:
    text = ""

def section_header(name: str) -> str:
    return f"[{name}]"

def replace_or_append_section(current: str, header: str, body: str) -> str:
    pattern = re.compile(
        rf"(?ms)^\[{re.escape(header)}\]\n.*?(?=^\[|\Z)"
    )
    replacement = f"[{header}]\n{body.rstrip()}\n"
    if pattern.search(current):
        return pattern.sub(replacement, current)
    if current and not current.endswith("\n"):
        current += "\n"
    if current and not current.endswith("\n\n"):
        current += "\n"
    return current + replacement

def set_enabled_in_plugin_sections(current: str) -> str:
    pattern = re.compile(
        rf'(?ms)^(\[plugins\."{re.escape(plugin_name)}@([^"]+)"\]\n)(.*?)(?=^\[|\Z)'
    )

    def rewrite(match: re.Match[str]) -> str:
        marketplace = match.group(2)
        body = match.group(3)
        enabled = "true" if marketplace == marketplace_name else "false"
        if re.search(r"(?m)^enabled\s*=", body):
            body = re.sub(r"(?m)^enabled\s*=.*$", f"enabled = {enabled}", body)
        else:
            body = f"enabled = {enabled}\n" + body
        return match.group(1) + body

    return pattern.sub(rewrite, current)

text = set_enabled_in_plugin_sections(text)

plugin_header = f'plugins."{plugin_name}@{marketplace_name}"'
text = replace_or_append_section(text, plugin_header, "enabled = true")

marketplace_header = f"marketplaces.{marketplace_name}"
timestamp = datetime.datetime.now(datetime.UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")
marketplace_body = "\n".join(
    [
        f'last_updated = "{timestamp}"',
        'source_type = "local"',
        f'source = "{source_root.replace(chr(92), chr(92) + chr(92)).replace(chr(34), chr(92) + chr(34))}"',
    ]
)
text = replace_or_append_section(text, marketplace_header, marketplace_body)

with open(config_path, "w", encoding="utf-8") as f:
    f.write(text)
PY

if [[ -d "${CACHE_TARGET}" ]]; then
  rm -rf "${CACHE_TARGET}"
fi

if command -v ditto >/dev/null 2>&1; then
  ditto "${PLUGIN_DIR}" "${CACHE_TARGET}"
else
  mkdir -p "${CACHE_TARGET}"
  cp -R "${PLUGIN_DIR}/." "${CACHE_TARGET}/"
fi

echo "Updated Codex config: ${CONFIG_TOML}"
echo "Seeded plugin cache: ${CACHE_TARGET}"

TOKEN_OK=0
if [[ "${RUN_TOKEN_SETUP}" -eq 1 ]]; then
  if [[ -x "${TOKEN_SCRIPT}" ]]; then
    echo
    echo "Next, enter the Eko MCP token when prompted."
    if "${TOKEN_SCRIPT}"; then
      TOKEN_OK=1
    else
      echo "Token setup was skipped or failed. The plugin is installed, but MCP memory will return 401 until the token is set."
    fi
  else
    echo "Token setup script is missing or not executable: ${TOKEN_SCRIPT}"
    echo "The plugin is installed, but MCP memory will return 401 until the token is set."
  fi
else
  echo "Skipped token setup."
fi

if [[ "${OPEN_PLUGIN}" -eq 1 ]] && command -v open >/dev/null 2>&1; then
  ENCODED_MARKETPLACE="$(urlencode "${MARKETPLACE_JSON}")"
  open "codex://plugins/${PLUGIN_NAME}?marketplacePath=${ENCODED_MARKETPLACE}" >/dev/null 2>&1 || true
fi

cat <<EOF

Done.

What to do in Codex:
  1. Fully quit and reopen Codex.
  2. Open Plugins and confirm Campaign Assistant is installed/enabled.
  3. Start a new thread before testing @campaign-assistant.
EOF

if [[ "${TOKEN_OK}" -eq 0 && "${RUN_TOKEN_SETUP}" -eq 1 ]]; then
  cat <<'EOF'

MCP token note:
  The plugin install completed, but the token was not confirmed. Run:
    scripts/setup-campaign-assistant-token.command
EOF
fi

pause_if_needed
