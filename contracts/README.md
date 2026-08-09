# BlocpodBase contracts

This Foundry project contains the immutable token implementation and its permissionless V1
factory. `BaseTokenFactoryV1` is intentionally not upgradeable: a future factory must be a new,
explicitly versioned deployment.

The optional `BlocpodVestingWalletV1` is an externally funded, linear OpenZeppelin vesting wallet.
Its beneficiary is immutable and its schedule cannot be revoked. The token and token factory do not
depend on the vesting module.

## Guarantees

- The complete ERC-20 supply is minted once to the selected recipient in the constructor.
- There is no owner, administrator, post-deployment mint, pause, blacklist, seizure, fee, proxy,
  `delegatecall`, or `selfdestruct` surface.
- The factory cannot hold authority over or modify tokens it deploys.
- CREATE2 salts are `keccak256(abi.encode(creator, userSalt))`; one creator cannot reserve another
  creator's salt.
- `predictTokenAddress` uses the exact constructor arguments and init code used at deployment.
- Names must be 1–64 UTF-8 bytes and symbols 1–12 UTF-8 bytes. Empty or oversized metadata,
  zero supply, and the zero recipient are rejected at both deployment and prediction boundaries.
- Vesting wallets cannot transfer or renounce beneficiary ownership; anyone may trigger release,
  but vested assets are always sent to the immutable beneficiary.

These are code-level guarantees, not claims that a token is valuable, compliant, liquid, or safe
to purchase. Operational modules such as vesting and treasury management must interact with the
standard ERC-20 and never receive hidden token privileges.

## Local setup and verification

Install Foundry v1.7.1, then install the pinned libraries without committing their source:

```sh
./scripts/install-dependencies.sh
./scripts/contract-acceptance.sh
```

The CI profile runs 10,000 cases per fuzz test and 1,000 invariant runs at depth 128. Release
artifacts must be generated from a clean checkout with the pinned compiler and dependencies.

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md). Never expose a deployer private key in shell history, logs,
CI variables available to pull requests, or a checked-in `.env` file.
