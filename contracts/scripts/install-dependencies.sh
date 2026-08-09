#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

FORGE_STD_VERSION="v1.9.7"
OPENZEPPELIN_VERSION="v5.6.1"
FORGE_STD_REF="77041d2ce690e692d6e03cc812b57d1ddaa4d505"
OPENZEPPELIN_REF="5fd1781b1454fd1ef8e722282f86f9293cacf256"
FORGE_BIN="${FORGE_BIN:-forge}"

if [[ -e lib/forge-std || -e lib/openzeppelin-contracts ]]; then
  echo "contracts/lib already contains dependencies; remove it before a clean install." >&2
  exit 1
fi

"${FORGE_BIN}" install "foundry-rs/forge-std@${FORGE_STD_REF}" --no-git --shallow
"${FORGE_BIN}" install \
  "OpenZeppelin/openzeppelin-contracts@${OPENZEPPELIN_REF}" --no-git --shallow

grep -Eq '"version"[[:space:]]*:[[:space:]]*"1\.9\.7"' lib/forge-std/package.json
grep -Eq '"version"[[:space:]]*:[[:space:]]*"5\.6\.1"' lib/openzeppelin-contracts/package.json

echo "Installed forge-std ${FORGE_STD_VERSION} (${FORGE_STD_REF})."
echo "Installed OpenZeppelin Contracts ${OPENZEPPELIN_VERSION} (${OPENZEPPELIN_REF})."
