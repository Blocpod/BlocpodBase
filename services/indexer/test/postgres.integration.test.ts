import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import {
  buildIntent,
  PostgresIntentRepository,
  type SimulationResult,
} from "@blocpod/backend";
import postgres, { type Sql } from "postgres";
import type { Address, Hash } from "viem";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { IndexedDeployment } from "../src/indexer";
import { PostgresIndexerStore } from "../src/postgres-store";

const databaseUrl = process.env.TEST_DATABASE_URL;
const databaseDescribe = databaseUrl ? describe : describe.skip;

databaseDescribe("PostgreSQL intent/indexer integration", () => {
  let sql: Sql;

  beforeAll(async () => {
    // max: 1 is required while applying the multi-statement transactional
    // migration with postgres.js `unsafe`; the same connection then exercises
    // repository transactions against the resulting schema.
    sql = postgres(databaseUrl!, { max: 1 });
    const migrationUrl = new URL(
      "../../../packages/backend/migrations/001_initial.sql",
      import.meta.url,
    );
    await sql.unsafe(await readFile(fileURLToPath(migrationUrl), "utf8"));
  });

  beforeEach(async () => {
    await sql`
      TRUNCATE deployment_intents, token_deployments, indexed_blocks, indexer_cursors
    `;
  });

  afterAll(async () => {
    await sql?.end({ timeout: 5 });
  });

  it("reconciles an exact event and safely demotes it during a reorg", async () => {
    const creator = "0x1111111111111111111111111111111111111111" as Address;
    const factory = "0x2222222222222222222222222222222222222222" as Address;
    const initialRecipient = "0x3333333333333333333333333333333333333333" as Address;
    const token = "0x4444444444444444444444444444444444444444" as Address;
    const userSalt = `0x${"aa".repeat(32)}` as Hash;
    const deploymentSalt = `0x${"bb".repeat(32)}` as Hash;
    const transactionHash = `0x${"cc".repeat(32)}` as Hash;
    const blockHash = `0x${"dd".repeat(32)}` as Hash;
    const repository = new PostgresIntentRepository(sql);
    const store = new PostgresIndexerStore(sql);

    const intent = buildIntent(
      {
        idempotencyKey: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        chainId: 84532,
        creator,
        name: "Blocpod Integration",
        symbol: "BPIT",
        initialSupply: "1000000000000000000000",
        initialRecipient,
        userSalt,
      },
      factory,
      {
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        now: new Date("2026-08-08T00:00:00.000Z"),
      },
    );
    await repository.create(intent);
    const simulation: SimulationResult = {
      ok: true,
      blockNumber: "99",
      simulatedAt: "2026-08-08T00:00:01.000Z",
      predictedToken: token,
      gasEstimate: "500000",
    };
    await repository.updateStatus(intent.id, ["draft"], "simulated", { simulation });
    await store.cursor(84532, factory, 100n);

    const deployment: IndexedDeployment = {
      chainId: 84532,
      transactionHash,
      logIndex: 0,
      blockNumber: 100n,
      blockHash,
      factory,
      factoryVersion: "1",
      creator,
      token,
      deploymentSalt,
      initialRecipient,
      name: intent.name,
      symbol: intent.symbol,
      initialSupply: intent.initialSupply,
      userSalt,
    };
    await store.commitBatch(
      84532,
      factory,
      [deployment],
      [{ number: 100n, hash: blockHash }],
      { nextBlock: 101n, lastBlockHash: blockHash },
    );

    const confirmed = await repository.findById(intent.id);
    expect(confirmed).toMatchObject({ status: "confirmed", transactionHash });
    const deploymentRows = await sql<Array<{ token: Address }>>`
      SELECT token FROM token_deployments WHERE chain_id = 84532
    `;
    expect(deploymentRows).toEqual([{ token }]);

    await store.rewind(84532, factory, 100n);

    const rewound = await repository.findById(intent.id);
    expect(rewound).toMatchObject({ status: "submitted", transactionHash });
    const remaining = await sql<Array<{ count: string }>>`
      SELECT count(*)::text AS count FROM token_deployments
    `;
    expect(remaining[0]?.count).toBe("0");
    expect(await store.cursor(84532, factory, 100n)).toEqual({ nextBlock: 100n });
  });
});
