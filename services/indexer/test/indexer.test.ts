import { describe, expect, it } from "vitest";
import type { Address, Hash } from "viem";
import { FactoryIndexer, type IndexerCursor, type IndexerRpc, type IndexerStore } from "../src/indexer";

const factory = "0x1111111111111111111111111111111111111111" as Address;
const hash = (byte: string) => `0x${byte.repeat(64)}` as Hash;

class MemoryStore implements IndexerStore {
  value: IndexerCursor;
  storedHash: Hash | null = null;
  rewound?: bigint;
  committed?: IndexerCursor;
  pending: Array<{ id: string; transactionHash: Hash }> = [];
  failed: Array<{ id: string; reasonCode: string }> = [];

  constructor(nextBlock: bigint) {
    this.value = { nextBlock };
  }

  async cursor(): Promise<IndexerCursor> { return this.value; }
  async canonicalBlockHash(): Promise<Hash | null> { return this.storedHash; }
  async rewind(_chainId: number, _factory: Address, fromBlock: bigint): Promise<void> {
    this.rewound = fromBlock;
  }
  async pendingSubmissions(): Promise<Array<{ id: string; transactionHash: Hash }>> { return this.pending; }
  async markSubmissionFailed(id: string, reasonCode: string): Promise<void> { this.failed.push({ id, reasonCode }); }
  async commitBatch(
    _chainId: number,
    _factory: Address,
    _deployments: never[],
    _blocks: Array<{ number: bigint; hash: Hash }>,
    cursor: IndexerCursor,
  ): Promise<void> {
    this.committed = cursor;
  }
}

const rpc = (head: bigint, blockHash = hash("a")): IndexerRpc => ({
  blockNumber: async () => head,
  block: async () => ({ hash: blockHash }),
  deploymentLogs: async () => [],
  transactionReceipt: async () => null,
});

describe("factory indexer", () => {
  it("indexes only through the confirmation-safe head", async () => {
    const store = new MemoryStore(100n);
    const result = await new FactoryIndexer(rpc(120n), store, {
      chainId: 84532,
      factory,
      startBlock: 100n,
      confirmations: 2n,
      batchSize: 100n,
    }).runOnce();
    expect(result).toEqual({ from: 100n, to: 118n, indexed: 0 });
    expect(store.committed?.nextBlock).toBe(119n);
  });

  it("rewinds conservatively when the prior checkpoint hash changes", async () => {
    const store = new MemoryStore(1_500n);
    store.storedHash = hash("b");
    const result = await new FactoryIndexer(rpc(2_000n, hash("c")), store, {
      chainId: 8453,
      factory,
      startBlock: 100n,
      confirmations: 12n,
      batchSize: 1_000n,
    }).runOnce();
    expect(result).toEqual({
      reorg: true,
      checkpoint: 1_499n,
      storedHash: hash("b"),
      canonicalHash: hash("c"),
      rewindBlock: 100n,
    });
    expect(store.rewound).toBe(100n);
  });

  it("marks reverted submitted transactions failed", async () => {
    const store = new MemoryStore(100n);
    store.pending = [{ id: "intent-1", transactionHash: hash("d") }];
    const failedRpc = { ...rpc(100n), transactionReceipt: async () => ({ status: "reverted" as const }) };
    await new FactoryIndexer(failedRpc, store, {
      chainId: 84532,
      factory,
      startBlock: 100n,
      confirmations: 2n,
    }).runOnce();
    expect(store.failed).toEqual([{ id: "intent-1", reasonCode: "TRANSACTION_REVERTED" }]);
  });
});
