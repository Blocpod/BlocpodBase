import postgres, { type Sql } from "postgres";
import type { Address, Hash } from "viem";
import type { IndexedDeployment, IndexerCursor, IndexerStore } from "./indexer";

export class PostgresIndexerStore implements IndexerStore {
  constructor(private readonly sql: Sql = postgres(process.env.DATABASE_URL ?? "", { max: 5 })) {}

  async cursor(chainId: number, factory: Address, startBlock: bigint): Promise<IndexerCursor> {
    const rows = await this.sql<Array<{ next_block: string; last_block_hash: Hash | null }>>`
      INSERT INTO indexer_cursors (chain_id, factory, next_block)
      VALUES (${chainId}, ${factory}, ${startBlock.toString()})
      ON CONFLICT (chain_id, factory) DO UPDATE SET factory = excluded.factory
      RETURNING next_block, last_block_hash
    `;
    const row = rows[0];
    if (!row) throw new Error("Unable to initialize indexer cursor");
    return {
      nextBlock: BigInt(row.next_block),
      ...(row.last_block_hash ? { lastBlockHash: row.last_block_hash } : {}),
    };
  }

  async canonicalBlockHash(chainId: number, factory: Address, block: bigint): Promise<Hash | null> {
    const rows = await this.sql<Array<{ block_hash: Hash }>>`
      SELECT block_hash FROM indexed_blocks
      WHERE chain_id = ${chainId} AND factory = ${factory} AND block_number = ${block.toString()}
    `;
    return rows[0]?.block_hash ?? null;
  }

  async rewind(chainId: number, factory: Address, fromBlock: bigint): Promise<void> {
    await this.sql.begin(async tx => {
      await tx`
        UPDATE deployment_intents AS intent
        SET status = 'submitted', updated_at = now()
        WHERE intent.status = 'confirmed'
          AND intent.chain_id = ${chainId}
          AND lower(intent.factory) = lower(${factory})
          AND EXISTS (
            SELECT 1 FROM token_deployments AS deployment
            WHERE deployment.chain_id = intent.chain_id
              AND deployment.transaction_hash = intent.transaction_hash
              AND lower(deployment.factory) = lower(intent.factory)
              AND deployment.block_number >= ${fromBlock.toString()}
          )
      `;
      await tx`DELETE FROM token_deployments
        WHERE chain_id = ${chainId} AND lower(factory) = lower(${factory}) AND block_number >= ${fromBlock.toString()}`;
      await tx`DELETE FROM indexed_blocks
        WHERE chain_id = ${chainId} AND lower(factory) = lower(${factory}) AND block_number >= ${fromBlock.toString()}`;
      await tx`UPDATE indexer_cursors SET next_block = ${fromBlock.toString()}, last_block_hash = NULL, updated_at = now()
        WHERE chain_id = ${chainId} AND factory = ${factory}`;
    });
  }

  async pendingSubmissions(chainId: number, factory: Address, limit: number) {
    return this.sql<Array<{ id: string; transactionHash: Hash }>>`
      SELECT id, transaction_hash AS "transactionHash" FROM deployment_intents
      WHERE chain_id = ${chainId} AND lower(factory) = lower(${factory})
        AND status = 'submitted' AND transaction_hash IS NOT NULL
      ORDER BY updated_at ASC LIMIT ${limit}
    `;
  }

  async markSubmissionFailed(id: string, reasonCode: string): Promise<void> {
    await this.sql`
      UPDATE deployment_intents SET status = 'failed',
        simulation = coalesce(simulation, '{}'::jsonb) || ${this.sql.json({ reconciliationError: reasonCode })},
        updated_at = now()
      WHERE id = ${id} AND status = 'submitted'
    `;
  }

  async commitBatch(
    chainId: number,
    factory: Address,
    deployments: IndexedDeployment[],
    blocks: Array<{ number: bigint; hash: Hash }>,
    cursor: IndexerCursor,
  ): Promise<void> {
    await this.sql.begin(async tx => {
      for (const deployment of deployments) {
        await tx`
          INSERT INTO token_deployments (
            chain_id, transaction_hash, log_index, block_number, block_hash, factory,
            factory_version, creator, token, deployment_salt, initial_recipient,
            name, symbol, initial_supply, user_salt
          ) VALUES (
            ${deployment.chainId}, ${deployment.transactionHash}, ${deployment.logIndex},
            ${deployment.blockNumber.toString()}, ${deployment.blockHash}, ${deployment.factory},
            ${deployment.factoryVersion}, ${deployment.creator}, ${deployment.token},
            ${deployment.deploymentSalt}, ${deployment.initialRecipient}, ${deployment.name},
            ${deployment.symbol}, ${deployment.initialSupply}, ${deployment.userSalt}
          ) ON CONFLICT (chain_id, transaction_hash, log_index) DO NOTHING
        `;
        await tx`
          UPDATE deployment_intents SET status = 'confirmed',
            transaction_hash = ${deployment.transactionHash}, updated_at = now()
          WHERE status IN ('simulated', 'submitted')
            AND chain_id = ${deployment.chainId}
            AND lower(factory) = lower(${deployment.factory})
            AND lower(creator) = lower(${deployment.creator})
            AND lower(parameters->>'initialRecipient') = lower(${deployment.initialRecipient})
            AND parameters->>'name' = ${deployment.name}
            AND parameters->>'symbol' = ${deployment.symbol}
            AND parameters->>'initialSupply' = ${deployment.initialSupply}
            AND lower(parameters->>'userSalt') = lower(${deployment.userSalt})
            AND (status = 'simulated' OR transaction_hash = ${deployment.transactionHash})
        `;
      }
      for (const block of blocks) {
        await tx`
          INSERT INTO indexed_blocks (chain_id, factory, block_number, block_hash)
          VALUES (${chainId}, ${factory}, ${block.number.toString()}, ${block.hash})
          ON CONFLICT (chain_id, factory, block_number)
          DO UPDATE SET block_hash = excluded.block_hash
        `;
      }
      await tx`
        UPDATE indexer_cursors SET next_block = ${cursor.nextBlock.toString()},
          last_block_hash = ${cursor.lastBlockHash ?? null}, updated_at = now()
        WHERE chain_id = ${chainId} AND factory = ${factory}
      `;
    });
  }
}
