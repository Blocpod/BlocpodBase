import postgres, { type Sql } from "postgres";
import type { Address, Hash, Hex } from "viem";
import { assertIntentTransition, type DeploymentIntent, type IntentRepository, type IntentStatus } from "./intents";

type IntentRow = {
  id: string;
  idempotency_key: string;
  creator: Address;
  chain_id: 8453 | 84532;
  factory: Address;
  factory_version: "1";
  calldata: Hex;
  calldata_hash: Hash;
  parameters: Omit<DeploymentIntent, "id" | "factory" | "factoryVersion" | "calldata" | "calldataHash" | "status" | "simulation" | "transactionHash" | "expiresAt" | "createdAt" | "updatedAt">;
  status: IntentStatus;
  simulation: DeploymentIntent["simulation"] | null;
  transaction_hash: Hash | null;
  expires_at: Date;
  created_at: Date;
  updated_at: Date;
};

export class PostgresIntentRepository implements IntentRepository {
  constructor(private readonly sql: Sql = postgres(process.env.DATABASE_URL ?? "", { max: 10 })) {}

  async create(intent: DeploymentIntent): Promise<DeploymentIntent> {
    const parameters = {
      idempotencyKey: intent.idempotencyKey,
      chainId: intent.chainId,
      creator: intent.creator,
      name: intent.name,
      symbol: intent.symbol,
      initialSupply: intent.initialSupply,
      initialRecipient: intent.initialRecipient,
      userSalt: intent.userSalt,
    };
    const rows = await this.sql<IntentRow[]>`
      INSERT INTO deployment_intents (
        id, idempotency_key, creator, chain_id, factory, factory_version, calldata,
        calldata_hash, parameters, status, expires_at, created_at, updated_at
      ) VALUES (
        ${intent.id}, ${intent.idempotencyKey}, ${intent.creator}, ${intent.chainId},
        ${intent.factory}, ${intent.factoryVersion}, ${intent.calldata}, ${intent.calldataHash},
        ${this.sql.json(parameters)}, ${intent.status}, ${intent.expiresAt},
        ${intent.createdAt}, ${intent.updatedAt}
      ) RETURNING *
    `;
    return fromRow(requiredRow(rows));
  }

  async findById(id: string): Promise<DeploymentIntent | null> {
    const rows = await this.sql<IntentRow[]>`SELECT * FROM deployment_intents WHERE id = ${id}`;
    return rows[0] ? fromRow(rows[0]) : null;
  }

  async findByIdempotencyKey(creator: Address, key: string): Promise<DeploymentIntent | null> {
    const rows = await this.sql<IntentRow[]>`
      SELECT * FROM deployment_intents
      WHERE lower(creator) = lower(${creator}) AND idempotency_key = ${key}
    `;
    return rows[0] ? fromRow(rows[0]) : null;
  }

  async updateStatus(
    id: string,
    expected: IntentStatus[],
    next: IntentStatus,
    patch: Partial<Pick<DeploymentIntent, "simulation" | "transactionHash">> = {},
  ): Promise<DeploymentIntent> {
    const current = await this.findById(id);
    if (!current) throw new Error("Intent not found");
    if (!expected.includes(current.status)) throw new Error("Intent was modified concurrently");
    assertIntentTransition(current.status, next);
    const rows = await this.sql<IntentRow[]>`
      UPDATE deployment_intents SET
        status = ${next},
        simulation = ${patch.simulation ? this.sql.json(toJson(patch.simulation)) : current.simulation ? this.sql.json(toJson(current.simulation)) : null},
        transaction_hash = ${patch.transactionHash ?? current.transactionHash ?? null},
        updated_at = now()
      WHERE id = ${id} AND status = ${current.status}
      RETURNING *
    `;
    if (!rows[0]) throw new Error("Intent was modified concurrently");
    return fromRow(rows[0]);
  }
}

type PostgresJson = Parameters<Sql["json"]>[0];

function toJson(value: unknown): PostgresJson {
  return JSON.parse(JSON.stringify(value)) as PostgresJson;
}

function requiredRow(rows: IntentRow[]): IntentRow {
  if (!rows[0]) throw new Error("Database did not return an intent");
  return rows[0];
}

function fromRow(row: IntentRow): DeploymentIntent {
  return {
    ...row.parameters,
    id: row.id,
    factory: row.factory,
    factoryVersion: row.factory_version,
    calldata: row.calldata,
    calldataHash: row.calldata_hash,
    status: row.status,
    ...(row.simulation ? { simulation: row.simulation } : {}),
    ...(row.transaction_hash ? { transactionHash: row.transaction_hash } : {}),
    expiresAt: row.expires_at.toISOString(),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}
