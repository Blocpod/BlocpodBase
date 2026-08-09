import {
  decodeEventLog,
  getAddress,
  type Address,
  type Hash,
  type Log,
} from "viem";
import { factoryV1Abi } from "@blocpod/backend";

export interface IndexerCursor {
  nextBlock: bigint;
  lastBlockHash?: Hash;
}

export interface IndexedDeployment {
  chainId: 8453 | 84532;
  transactionHash: Hash;
  logIndex: number;
  blockNumber: bigint;
  blockHash: Hash;
  factory: Address;
  factoryVersion: "1";
  creator: Address;
  token: Address;
  deploymentSalt: Hash;
  initialRecipient: Address;
  name: string;
  symbol: string;
  initialSupply: string;
  userSalt: Hash;
}

export interface IndexerStore {
  cursor(chainId: number, factory: Address, startBlock: bigint): Promise<IndexerCursor>;
  canonicalBlockHash(chainId: number, factory: Address, block: bigint): Promise<Hash | null>;
  rewind(chainId: number, factory: Address, fromBlock: bigint): Promise<void>;
  pendingSubmissions(chainId: number, factory: Address, limit: number): Promise<Array<{ id: string; transactionHash: Hash }>>;
  markSubmissionFailed(id: string, reasonCode: string): Promise<void>;
  commitBatch(
    chainId: number,
    factory: Address,
    deployments: IndexedDeployment[],
    blocks: Array<{ number: bigint; hash: Hash }>,
    cursor: IndexerCursor,
  ): Promise<void>;
}

export interface IndexerOptions {
  chainId: 8453 | 84532;
  factory: Address;
  startBlock: bigint;
  confirmations: bigint;
  batchSize?: bigint;
}

export interface IndexerRpc {
  blockNumber(): Promise<bigint>;
  block(blockNumber: bigint): Promise<{ hash: Hash }>;
  deploymentLogs(factory: Address, fromBlock: bigint, toBlock: bigint): Promise<Log[]>;
  transactionReceipt(transactionHash: Hash): Promise<{ status: "success" | "reverted" } | null>;
}

export class FactoryIndexer {
  constructor(
    private readonly client: IndexerRpc,
    private readonly store: IndexerStore,
    private readonly options: IndexerOptions,
  ) {}

  async runOnce(): Promise<
    | { from: bigint; to: bigint; indexed: number }
    | {
        reorg: true;
        checkpoint: bigint;
        storedHash: Hash;
        canonicalHash: Hash;
        rewindBlock: bigint;
      }
    | null
  > {
    await this.reconcileFailedSubmissions();
    const cursor = await this.store.cursor(
      this.options.chainId,
      this.options.factory,
      this.options.startBlock,
    );
    if (cursor.nextBlock > this.options.startBlock) {
      const previous = cursor.nextBlock - 1n;
      const storedHash = await this.store.canonicalBlockHash(
        this.options.chainId,
        this.options.factory,
        previous,
      );
      const current = await this.client.block(previous);
      if (storedHash && current.hash !== storedHash) {
        // Factory start blocks are explicit release metadata. Replaying from
        // that boundary is rare but guarantees no orphaned provenance survives
        // a reorg deeper than an arbitrary rolling window.
        const rewindBlock = this.options.startBlock;
        await this.store.rewind(this.options.chainId, this.options.factory, rewindBlock);
        return {
          reorg: true,
          checkpoint: previous,
          storedHash,
          canonicalHash: current.hash,
          rewindBlock,
        };
      }
    }

    const head = await this.client.blockNumber();
    if (head < this.options.confirmations) return null;
    const safeHead = head - this.options.confirmations;
    if (cursor.nextBlock > safeHead) return null;
    const batchSize = this.options.batchSize ?? 1_000n;
    const to = min(cursor.nextBlock + batchSize - 1n, safeHead);
    const logs = await this.client.deploymentLogs(this.options.factory, cursor.nextBlock, to);
    const deployments = logs.map(log => decodeDeployment(this.options, log));
    const blockNumbers = new Set<bigint>([
      to,
      ...logs.flatMap(log => (log.blockNumber == null ? [] : [log.blockNumber])),
    ]);
    const blocks = await Promise.all(
      [...blockNumbers].map(async number => {
        const block = await this.client.block(number);
        return { number, hash: block.hash };
      }),
    );
    const endHash = blocks.find(block => block.number === to)?.hash;
    if (!endHash) throw new Error("Unable to checkpoint indexer batch");
    await this.store.commitBatch(this.options.chainId, this.options.factory, deployments, blocks, {
      nextBlock: to + 1n,
      lastBlockHash: endHash,
    });
    return { from: cursor.nextBlock, to, indexed: deployments.length };
  }

  private async reconcileFailedSubmissions(): Promise<void> {
    const pending = await this.store.pendingSubmissions(
      this.options.chainId,
      this.options.factory,
      100,
    );
    for (const submission of pending) {
      const receipt = await this.client.transactionReceipt(submission.transactionHash);
      if (receipt?.status === "reverted") {
        await this.store.markSubmissionFailed(submission.id, "TRANSACTION_REVERTED");
      }
    }
  }
}

function decodeDeployment(options: IndexerOptions, log: Log): IndexedDeployment {
  if (!log.transactionHash || log.logIndex == null || !log.blockHash || log.blockNumber == null) {
    throw new Error("Pending or incomplete log returned by finalized indexer query");
  }
  const decoded = decodeEventLog({ abi: factoryV1Abi, data: log.data, topics: log.topics });
  if (decoded.eventName !== "TokenDeployed") throw new Error("Unexpected factory event");
  const args = decoded.args;
  return {
    chainId: options.chainId,
    transactionHash: log.transactionHash,
    logIndex: log.logIndex,
    blockNumber: log.blockNumber,
    blockHash: log.blockHash,
    factory: options.factory,
    factoryVersion: "1",
    creator: getAddress(args.creator),
    token: getAddress(args.token),
    deploymentSalt: args.deploymentSalt,
    initialRecipient: getAddress(args.initialRecipient),
    name: args.name,
    symbol: args.symbol,
    initialSupply: args.initialSupply.toString(),
    userSalt: args.userSalt,
  };
}

const min = (a: bigint, b: bigint) => (a < b ? a : b);
