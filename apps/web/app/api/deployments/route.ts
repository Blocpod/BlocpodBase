import { getAddress, isAddress } from "viem";
import { listIndexedDeployments } from "@blocpod/backend";
import { database, rateLimiter } from "@/lib/server/backend";
import {
  correlationId,
  errorResponse,
  json,
  networkSubject,
} from "@/lib/server/http";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const requestId = correlationId(request);
  try {
    const rate = await rateLimiter.consume(
      "list-deployments",
      networkSubject(request),
      120,
      60_000,
    );
    if (!rate.allowed)
      return json(
        {
          error: {
            code: "RATE_LIMITED",
            retryAfterSeconds: rate.retryAfterSeconds,
          },
        },
        429,
        requestId,
      );
    if (!database)
      return json(
        { deployments: [], source: "indexer_unavailable" },
        200,
        requestId,
      );
    const query = new URL(request.url).searchParams;
    const chainId = Number(query.get("chainId"));
    if (chainId !== 8453 && chainId !== 84532)
      return json({ error: { code: "INVALID_CHAIN" } }, 400, requestId);
    const creatorValue = query.get("creator");
    if (creatorValue && !isAddress(creatorValue))
      return json({ error: { code: "INVALID_CREATOR" } }, 400, requestId);
    const deployments = await listIndexedDeployments(database, {
      chainId,
      ...(creatorValue ? { creator: getAddress(creatorValue) } : {}),
      limit: Number(query.get("limit") ?? 20),
    });
    return json({ deployments }, 200, requestId);
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
