import type { Sql } from "postgres";
import type { Address, Hash } from "viem";

export interface DeploymentSummary {
  chainId: 8453 | 84532;
  transactionHash: Hash;
  blockNumber: string;
  creator: Address;
  token: Address;
  initialRecipient: Address;
  name: string;
  symbol: string;
  initialSupply: string;
  indexedAt: string;
}

type DeploymentRow = {
  chain_id: 8453 | 84532;
  transaction_hash: Hash;
  block_number: string;
  creator: Address;
  token: Address;
  initial_recipient: Address;
  name: string;
  symbol: string;
  initial_supply: string;
  indexed_at: Date;
};

export async function listIndexedDeployments(
  sql: Sql,
  input: { chainId: 8453 | 84532; creator?: Address; limit?: number },
): Promise<DeploymentSummary[]> {
  const limit = Math.min(Math.max(input.limit ?? 20, 1), 100);
  const rows = input.creator
    ? await sql<DeploymentRow[]>`
        SELECT chain_id, transaction_hash, block_number, creator, token, initial_recipient,
          name, symbol, initial_supply, indexed_at
        FROM token_deployments WHERE chain_id = ${input.chainId}
          AND lower(creator) = lower(${input.creator})
        ORDER BY block_number DESC, log_index DESC LIMIT ${limit}
      `
    : await sql<DeploymentRow[]>`
        SELECT chain_id, transaction_hash, block_number, creator, token, initial_recipient,
          name, symbol, initial_supply, indexed_at
        FROM token_deployments WHERE chain_id = ${input.chainId}
        ORDER BY block_number DESC, log_index DESC LIMIT ${limit}
      `;
  return rows.map(row => ({
    chainId: row.chain_id,
    transactionHash: row.transaction_hash,
    blockNumber: row.block_number,
    creator: row.creator,
    token: row.token,
    initialRecipient: row.initial_recipient,
    name: row.name,
    symbol: row.symbol,
    initialSupply: row.initial_supply,
    indexedAt: row.indexed_at.toISOString(),
  }));
}
