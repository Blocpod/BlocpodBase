#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

FORGE_BIN="${FORGE_BIN:-forge}"

token_methods="$("${FORGE_BIN}" inspect BaseToken methodIdentifiers)"
factory_methods="$("${FORGE_BIN}" inspect BaseTokenFactoryV1 methodIdentifiers)"
vesting_factory_methods="$("${FORGE_BIN}" inspect BlocpodVestingWalletFactoryV1 methodIdentifiers)"
vesting_wallet_methods="$("${FORGE_BIN}" inspect BlocpodVestingWalletV1 methodIdentifiers)"
all_methods="${token_methods}${factory_methods}${vesting_factory_methods}"

for forbidden in \
  'mint(' 'burn(' 'pause(' 'unpause(' 'blacklist' 'seize(' 'setFee' 'owner(' \
  'transferOwnership(' 'renounceOwnership(' 'upgradeTo' 'upgradeToAndCall(' 'initialize('; do
  if grep -Fq "$forbidden" <<<"$all_methods"; then
    echo "Forbidden callable surface found: $forbidden" >&2
    exit 1
  fi
done

for forbidden in 'revoke(' 'withdraw(' 'recover(' 'setBeneficiary(' 'upgradeTo' 'upgradeToAndCall('; do
  if grep -Fq "$forbidden" <<<"$vesting_wallet_methods"; then
    echo "Forbidden vesting wallet surface found: $forbidden" >&2
    exit 1
  fi
done

for forbidden_opcode in 'delegatecall' 'selfdestruct'; do
  if rg -n --glob '*.sol' --glob '!test/**' --glob '!script/**' "$forbidden_opcode" src; then
    echo "Forbidden opcode source found: $forbidden_opcode" >&2
    exit 1
  fi
done

echo "Security surface check passed."
