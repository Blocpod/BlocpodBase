# Backend and indexing architecture

BlocpodBase separates preparation from authority. The server creates bounded deployment intents,
simulates exact factory calldata, indexes canonical factory events, and exposes read models. The
connected wallet remains the only component that signs a user's deployment or management
transaction.

## Runtime boundaries

- `apps/web/app/api` is the authenticated HTTP adapter. Request bodies are capped and wallet-signed.
- `packages/backend` owns chain configuration, intent state, simulation, persistence, and read models.
- `services/indexer` is the only writer of indexed onchain deployment records.
- `packages/agent` is an optional server-only AgentKit adapter. It exposes read and proposal actions,
  never wallet transfer or contract-write actions.
- PostgreSQL is mandatory in production. In-memory intent storage exists only for local development
  and tests.

## Deployment intent lifecycle

The normal path is `draft -> simulated -> submitted -> confirmed`. A finalized, exactly matching
factory event may also reconcile `simulated -> confirmed` when a wallet/page refresh prevents the
client from reporting an early transaction hash.

Failures may terminate a draft, simulation, or submission. After 15 minutes the client must create,
simulate, and sign a new intent rather than initiate a transaction from stale review data. Expiry is
a signing-safety boundary, not a provenance boundary: an exact finalized event from an allowlisted
factory can still reconcile a transaction signed before expiry or a lost wallet callback. Every
transition uses compare-and-set persistence so concurrent requests cannot advance a stale intent.
The intent binds chain, versioned factory, creator, calldata, calldata hash, and expiry.

The client must compare the wallet transaction request against those bound fields immediately before
signature. A mainnet deployment must use a fresh successful simulation and a separate explicit UI
confirmation. The backend does not treat a submitted transaction hash as success; the indexer must
observe a matching `TokenDeployed` event from the allowlisted factory.

Submission verification supports both direct EOA transactions and Base Account/batched execution.
For a mined smart-wallet operation, the successful receipt must contain an exact factory event whose
creator, recipient, metadata, supply, salt, and predicted token match the intent. Direct EOA
transactions may use the stricter sender/factory/calldata/value fast path before a receipt propagates.

## Indexing and reorg handling

Each `(chain, factory)` has an independent cursor. The worker reads only the versioned factory's
`TokenDeployed` event, waits for the configured confirmation depth, and commits deployments, block
hashes, and the next cursor in one database transaction. Natural onchain identity
`(chainId, transactionHash, logIndex)` makes replay idempotent.

Before every batch, the worker compares the prior checkpoint hash to the RPC's canonical hash. A
mismatch emits `indexer.reorg_detected`, removes deployments/checkpoints back to the configured
factory deployment block, demotes affected intents from `confirmed` back to `submitted`, then fully
replays and reconfirms only canonical events. This deliberately favors provenance correctness over
fast recovery after a rare divergence. Run one
active worker unless database advisory locking is added; duplicate workers are data-safe but wasteful.

## Availability model

RPC reads use finite timeouts and retries. Failure to simulate is fail-closed for deployment. Indexer
lag affects dashboards but never contract safety or wallet access. Health checks require the database
in production. Public RPC endpoints are acceptable for development; production should use independent
primary and fallback providers with alerts on disagreement and lag.
