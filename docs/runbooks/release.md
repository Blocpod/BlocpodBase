# Production release runbook

The evidence-backed definition of done is maintained in
[`docs/RELEASE_ACCEPTANCE.md`](../RELEASE_ACCEPTANCE.md). Every applicable checkbox must be signed
off before production authorization.

1. Freeze the candidate revision and lockfile. Confirm the worktree contains no secrets or unreviewed
   generated artifacts.
2. Run `pnpm install --frozen-lockfile`, `pnpm security:dependencies`, `pnpm ci:application`, the
   PostgreSQL integration job, contract acceptance, and CodeQL.
3. Deploy and verify the exact reviewed factory bytecode on Base Sepolia. Exercise prediction,
   simulation, rejection, receipt, and indexer reconciliation end to end.
4. Apply database migrations, deploy the web/API and indexer with Sepolia configuration, run smoke
   tests, and validate logs contain request IDs but no signatures or secrets.
5. Obtain independent contract, application-security, and UX review. Resolve every release-blocking
   finding and repeat the affected checks.
6. Deploy/verify the factory to Base mainnet only after the address and artifact manifest are approved.
   Enable mainnet in the web configuration in a separate reviewed release.
   At each release, fail the smoke check unless `FACTORY_BASE_*` exactly matches the corresponding
   `NEXT_PUBLIC_FACTORY_BASE_*`; the server allowlist and client review screen must identify the same
   verified factory.
7. Record revision, artifact hashes, factory addresses, deployment blocks/transactions, verification
   links, migration version, configuration owners, rollback owner, and monitoring dashboard.

Rollback the web/API/indexer to the previous immutable artifact if smoke checks fail. Database changes
are forward-only. Never replace an advertised factory address silently; introduce a new version and
retain the old provenance records.
