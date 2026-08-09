# BlocpodBase

BlocpodBase is a production-oriented token issuance and management application for Base. It creates
immutable fixed-supply ERC-20 tokens through explicitly versioned factories, presents the exact
deployment intent for wallet approval, indexes verified factory events, and provides separate
distribution and non-revocable vesting workflows without adding hidden authority to a token.

## Product guarantees

- Each token's complete supply is minted once to the chosen recipient.
- Tokens have no owner, administrator, post-deployment minting, pause, blacklist, fees, proxy, or
  upgrade path.
- Factory deployments use creator-namespaced CREATE2 salts and can be predicted before signing.
- Token names are limited to 64 UTF-8 bytes and symbols to 12 UTF-8 bytes onchain.
- Base Sepolia and Base mainnet use explicit, independently verified factory-address configuration.
- Agent actions are policy constrained and cannot deploy, transfer, approve, or manage liquidity
  without the required human authorization.

These properties do not make a token valuable, liquid, compliant, or safe to purchase.

## Repository map

- `apps/web` — Next.js application and wallet transaction UX
- `contracts` — immutable Solidity contracts, deployment scripts, fuzz tests, and invariants
- `packages/contracts` — shared chain configuration and contract ABIs
- `packages/backend` — deployment intents, simulation, persistence, and API services
- `packages/agent` — constrained, allowlisted AgentKit actions
- `services/indexer` — reorg-aware verified-factory event indexer
- `docs` — architecture, security, operations, incident, and release runbooks

## Development

Requirements are Node.js 20.18.0, pnpm 9.4.0, and Foundry v1.7.1. The isolated
AgentKit runtime uses Node.js 22 because Coinbase AgentKit's published dependency graph relies on
Node 22 ESM interoperability; its dedicated CI job enforces that boundary. The adapter is not shipped
as a production dependency while the latest published AgentKit retains an unpatched high-severity
advisory in an unused Solana dependency. It remains available for constrained development and CI
validation; production enablement requires that upstream dependency risk to be removed and reviewed.

```sh
pnpm install --frozen-lockfile
pnpm ci:application
pnpm security:dependencies

cd contracts
./scripts/install-dependencies.sh # only when contracts/lib is absent
./scripts/contract-acceptance.sh
```

Copy `.env.example` to a local environment file and supply only the values needed for the chosen
network. Never commit private keys, wallet secrets, RPC credentials, or production addresses that
have not passed onchain acceptance.

## Release status

A passing local build is not a production release. The candidate is accepted only after every gate
in [the release acceptance checklist](./docs/RELEASE_ACCEPTANCE.md) has evidence and independent
review. Do not push or deploy an unaccepted candidate.

Security reports should follow [contracts/SECURITY.md](./contracts/SECURITY.md). Deployment details
are in [contracts/DEPLOYMENT.md](./contracts/DEPLOYMENT.md), and operational release steps are in
[docs/runbooks/release.md](./docs/runbooks/release.md).
