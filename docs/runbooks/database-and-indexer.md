# Database and indexer runbook

## Initial setup

1. Create a PostgreSQL database and a runtime role with only `SELECT`, `INSERT`, and `UPDATE` access
   to Blocpod tables. Use a separate migration role for DDL.
2. Set `DATABASE_URL` over TLS.
3. Run `pnpm --filter @blocpod/backend migrate` with the migration role.
4. Set each factory address and RPC URL. Record the factory deployment block and update the indexer
   start block before production launch; scanning from block zero is a safe but slow default.
5. Start `pnpm --filter @blocpod/indexer dev` under a supervised worker runtime.

## Alerts

Alert when the worker exits, no cursor advances for 10 minutes while chain head advances, RPC error
rate exceeds 5%, database connections saturate, a checkpoint hash diverges, or indexed lag exceeds 20
minutes. The worker logs `indexer.reorg_detected` with the conflicting hashes and factory-start rewind
point before replay. Treat an unexpected factory address or event-decode failure as security relevant.

## Recovery

1. Stop the worker and record its last cursor plus current chain head.
2. Confirm the configured chain ID and factory address independently.
3. Restore PostgreSQL if needed. Never reconstruct deployment provenance from client submissions.
4. Rewind `indexer_cursors.next_block` to a verified canonical block. Delete `indexed_blocks` and
   `token_deployments` at or above that block in one transaction.
5. Restart one worker and compare a sample of indexed events against two RPC providers and BaseScan.
6. Document the incident, affected window, validation performed, and final cursor.

## Backup and restore

Take encrypted daily logical backups with 30-day retention and point-in-time recovery where
available. Quarterly, restore to an isolated database and verify intent counts, deployment uniqueness,
cursor continuity, and dashboard queries before declaring the backup healthy.
