# Factory deployment runbook

## Release gates

1. Review the exact commit and confirm the worktree is clean.
2. Install Foundry v1.7.1, then run `./scripts/install-dependencies.sh` from a clean checkout.
3. Run `./scripts/contract-acceptance.sh` for formatting, build-size, unit, fuzz, invariant, and
   security-surface checks.
4. Record the `BaseTokenFactoryV1` creation/runtime bytecode hashes from the reviewed build.
5. Use a dedicated, minimally funded deployer. Confirm the RPC chain ID independently.

## Base Sepolia (chain ID 84532)

```sh
cp .env.example .env
# Load secrets using the team's approved secret manager, then:
forge script script/DeployBaseTokenFactoryV1.s.sol:DeployBaseTokenFactoryV1 \
  --rpc-url base_sepolia --broadcast --verify
```

Record the factory address, transaction hash, deployer, block, compiler settings, source verification
URL, creation bytecode hash, and runtime bytecode hash. Copy the reviewed address into the shared
contract-address package. Then use `DeployTestToken.s.sol` to confirm prediction, deployment event,
recipient balance, total supply, transfers, and indexing from actual chain state.

Deploy the optional vesting factory with
`DeployBlocpodVestingWalletFactoryV1.s.sol:DeployBlocpodVestingWalletFactoryV1` only if the vesting
feature is enabled for the release. Verify and record it independently; it is not required by the
token factory.

## Base mainnet (chain ID 8453)

Mainnet deployment is permitted only after the Sepolia acceptance evidence has been reviewed. The
script requires `MAINNET_DEPLOYMENT_CONFIRMATION` to be the bytes32 value of
`keccak256("DEPLOY_BLOCPOD_FACTORY_V1_TO_BASE")`; this is an intentional second gate, not a substitute
for multisignature review.

Simulate first without `--broadcast`, compare bytecode hashes with Sepolia, then broadcast from the
approved deployer. Verify source immediately and repeat the onchain checks. A mismatch in chain ID,
bytecode, predicted address, verified source, or emitted event stops the release.

## Rollback model

The factory and tokens are immutable; they cannot be rolled back or upgraded. If a defect is found,
disable the affected factory address in the application/indexer, publish an incident notice, and
deploy a separately reviewed `BaseTokenFactoryV2`. Never present a replacement as the same factory.
