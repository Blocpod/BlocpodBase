# Threat model

## Assets and trust boundaries

User wallet keys and wallet approvals are outside Blocpod's custody. Blocpod protects deployment
intent integrity, factory allowlists, indexed provenance, database availability, API credentials, and
the accuracy of review screens. RPC providers, browsers, agent/model output, token metadata, and
client-submitted transaction hashes are untrusted.

## Principal threats and controls

| Threat | Control |
| --- | --- |
| Calldata or chain substitution | Intent binds chain, factory version/address, exact calldata hash; client compares before signing |
| API impersonation/replay | EIP-191 wallet-signed method/path/body hash/timestamp; five-minute freshness; idempotency keys |
| Malicious token metadata | Length/character bounds; escaped rendering; never inserted into prompts as instructions |
| RPC lies or outage | Timeouts/retries, production provider diversity, event/receipt reconciliation, fail-closed simulation |
| Reorg or duplicate logs | Confirmation depth, checkpoint block hashes, transactional rewind/replay, natural unique keys |
| Agent overreach | Explicit custom action allowlist; read/proposal only; no signing tool; deterministic policy and audit hashes |
| Secret leakage | Server-only environment, structured-log redaction, no raw bodies/prompts/signatures in telemetry |
| Database compromise | TLS/least-privilege role, encrypted backups, no wallet secrets, restore testing |
| Dependency or build compromise | Frozen lockfile, audit/CodeQL/secret scanning, protected release environments |

## Residual risk

Simulation cannot guarantee future execution because chain state may change between simulation and
mining. Users must verify wallet-displayed network and calldata, and the UI must clearly distinguish
submitted, confirmed, and finalized/indexed states. Liquidity and market-value outcomes are not
guaranteed by the immutable token factory or by Blocpod.
