import {
  backendConfig,
  database,
  rateLimiter,
  rpcClients,
} from "@/lib/server/backend";
import { correlationId, json, networkSubject } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const requestId = correlationId(request);
  if (process.env.NODE_ENV === "production" && !database) {
    return json({ status: "not_ready", requestId }, 503, requestId);
  }
  const configuredFactories = [
    backendConfig.FACTORY_BASE_SEPOLIA
      ? { chainId: 84532, address: backendConfig.FACTORY_BASE_SEPOLIA }
      : null,
    backendConfig.FACTORY_BASE_MAINNET
      ? { chainId: 8453, address: backendConfig.FACTORY_BASE_MAINNET }
      : null,
  ].filter((factory) => factory !== null);
  if (process.env.NODE_ENV === "production" && configuredFactories.length === 0) {
    return json(
      { status: "not_ready", reason: "FACTORY_NOT_CONFIGURED", requestId },
      503,
      requestId,
    );
  }
  try {
    const rate = await rateLimiter.consume(
      "health",
      networkSubject(request),
      120,
      60_000,
    );
    if (!rate.allowed)
      return json(
        { status: "rate_limited", retryAfterSeconds: rate.retryAfterSeconds },
        429,
        requestId,
      );
    const heads = await Promise.all(
      [...rpcClients.entries()].map(async ([chainId, client]) => ({
        chainId,
        head: (await client.getBlockNumber()).toString(),
      })),
    );
    const cursors = database
      ? await database<
          Array<{
            chain_id: number;
            factory: string;
            next_block: string;
            updated_at: Date;
          }>
        >`
          SELECT chain_id, factory, next_block, updated_at FROM indexer_cursors ORDER BY chain_id
        `
      : [];
    const now = Date.now();
    const stale = configuredFactories.some((configured) => {
      const cursor = cursors.find(
        (candidate) =>
          candidate.chain_id === configured.chainId &&
          candidate.factory.toLowerCase() === configured.address.toLowerCase(),
      );
      return !cursor || now - cursor.updated_at.getTime() > 20 * 60_000;
    });
    return json(
      {
        status: stale ? "degraded" : "ok",
        time: new Date().toISOString(),
        rpc: heads,
        indexer: { cursors, stale },
      },
      stale ? 503 : 200,
      requestId,
    );
  } catch {
    return json({ status: "not_ready", requestId }, 503, requestId);
  }
}
