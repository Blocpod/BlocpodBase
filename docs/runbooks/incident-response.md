# Incident response runbook

1. **Triage:** classify impact to signing integrity, factory configuration, indexing, data exposure,
   or availability. Preserve request IDs, deployment intent IDs, transaction hashes, and timestamps.
2. **Contain:** disable the affected API/agent feature flag, pause the indexer if provenance is in
   doubt, rotate exposed RPC/database/AI credentials, and keep wallet-side signing available only if
   chain/factory binding is independently verified.
3. **Verify:** compare configured chain and factory bytecode with the release manifest; check database
   audit records and GitHub deployment provenance; validate affected receipts using two RPC providers.
4. **Recover:** deploy a reviewed fix, migrate forward, replay the indexer from a known canonical
   block, and monitor error and lag budgets.
5. **Communicate:** state what is known, what users should avoid, affected chains/time windows, and
   remediation status. Never claim funds are safe without chain evidence.
6. **Review:** within five business days, record root cause, detection gap, timeline, corrective work,
   owners, and validation evidence.

The factory and issued tokens are immutable. A web/backend incident cannot be repaired by upgrading
them; containment must remove unsafe interfaces and warn users while preserving verifiable addresses.
