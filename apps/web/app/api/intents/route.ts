import { intentService } from "@/lib/server/backend";
import { rateLimiter } from "@/lib/server/backend";
import {
  boundedBody,
  correlationId,
  errorResponse,
  json,
  requireWalletSignature,
} from "@/lib/server/http";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const requestId = correlationId(request);
  try {
    if (!request.headers.get("content-type")?.startsWith("application/json")) {
      return json(
        { error: { code: "UNSUPPORTED_MEDIA_TYPE" } },
        415,
        requestId,
      );
    }
    const rawBody = await boundedBody(request);
    const body = JSON.parse(rawBody) as { creator?: string; chainId?: number };
    if (body.chainId !== 8453 && body.chainId !== 84532) {
      return json({ error: { code: "INVALID_CHAIN" } }, 400, requestId);
    }
    await requireWalletSignature(
      request,
      rawBody,
      body.creator ?? "",
      body.chainId,
    );
    const rate = await rateLimiter.consume(
      "create-intent",
      body.creator ?? "invalid",
      10,
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
    const intent = await intentService.createAndSimulate(body);
    return json({ intent }, 201, requestId);
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
