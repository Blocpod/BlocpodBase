#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

FORGE_BIN="${FORGE_BIN:-forge}"

"${FORGE_BIN}" --version
"${FORGE_BIN}" fmt --check
"${FORGE_BIN}" build --sizes
FOUNDRY_PROFILE=ci "${FORGE_BIN}" test -vvv
./scripts/check-security-surface.sh

echo "Contract acceptance passed."
