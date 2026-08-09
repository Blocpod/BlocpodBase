import postgres from "postgres";
import { createRpcClient, factoryForChain, factoryV1TokenDeployedEvent, parseServerConfig, rpcForChain } from "@blocpod/backend";
import type { Log } from "viem";
import { FactoryIndexer } from "./indexer";
import { PostgresIndexerStore } from "./postgres-store";

const config = parseServerConfig();
if (!config.DATABASE_URL) throw new Error("DATABASE_URL is required for the indexer");
const sql = postgres(config.DATABASE_URL, { max: 5 });
const store = new PostgresIndexerStore(sql);

const jobs = ([84532, 8453] as const).flatMap(chainId => {
  try {
    const factory = factoryForChain(config, chainId);
    const client = createRpcClient(chainId, rpcForChain(config, chainId));
    return [
      new FactoryIndexer(
        {
          blockNumber: () => client.getBlockNumber(),
          block: async blockNumber => {
            const block = await client.getBlock({ blockNumber });
            if (!block.hash) throw new Error(`Block ${blockNumber} is not canonical`);
            return { hash: block.hash };
          },
          deploymentLogs: async (address, fromBlock, toBlock) =>
            (await client.getLogs({
              address,
              event: factoryV1TokenDeployedEvent,
              fromBlock,
              toBlock,
              strict: true,
            })) as Log[],
          transactionReceipt: async transactionHash => {
            try {
              const receipt = await client.getTransactionReceipt({ hash: transactionHash });
              return { status: receipt.status };
            } catch {
              return null;
            }
          },
        },
        store,
        {
        chainId,
        factory,
        startBlock: BigInt(
          chainId === 8453 ? config.INDEXER_START_BLOCK_MAINNET : config.INDEXER_START_BLOCK_SEPOLIA,
        ),
        confirmations: BigInt(
          chainId === 8453
            ? config.INDEXER_CONFIRMATIONS_MAINNET
            : config.INDEXER_CONFIRMATIONS_SEPOLIA,
        ),
        },
      ),
    ];
  } catch {
    return [];
  }
});

if (jobs.length === 0) throw new Error("At least one factory address must be configured");

const abort = new AbortController();
process.once("SIGINT", () => abort.abort());
process.once("SIGTERM", () => abort.abort());

let failureCount = 0;
while (!abort.signal.aborted) {
  let caughtUp = true;
  for (const job of jobs) {
    try {
      const result = await job.runOnce();
      if (result) {
        caughtUp = false;
        const isReorg = "reorg" in result;
        const line = `${JSON.stringify({
          level: isReorg ? "warn" : "info",
          event: isReorg ? "indexer.reorg_detected" : "indexer.batch",
          ...result,
        }, (_key, value) => (typeof value === "bigint" ? value.toString() : value))}\n`;
        if (isReorg) process.stderr.write(line);
        else process.stdout.write(line);
      }
      failureCount = 0;
    } catch (error) {
      failureCount += 1;
      process.stderr.write(`${JSON.stringify({
        level: "error",
        event: "indexer.failure",
        errorCode: "INDEXER_BATCH_FAILED",
      })}\n`);
    }
  }
  const delay = failureCount > 0
    ? Math.min(60_000, 1_000 * 2 ** Math.min(failureCount, 6))
    : caughtUp ? 5_000 : 0;
  if (delay > 0) await new Promise(resolve => setTimeout(resolve, delay));
}

await sql.end({ timeout: 5 });
