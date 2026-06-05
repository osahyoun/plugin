#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INSTALLER="${ROOT_DIR}/scripts/install-campaign-assistant.command"

if [[ ! -x "${INSTALLER}" ]]; then
  echo "error: installer script is missing or not executable:"
  echo "${INSTALLER}"
  echo
  read -r -p "Press Return to close this window..." _ || true
  exit 1
fi

exec "${INSTALLER}" "$@"
