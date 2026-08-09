import { isHash } from "viem";
import { intentRepository, intentService } from "@/lib/server/backend";
import { rateLimiter } from "@/lib/server/backend";
import {
  boundedBody,
  correlationId,
  errorResponse,
  json,
  requireWalletSignature,
} from "@/lib/server/http";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const requestId = correlationId(request);
  try {
    const { id } = await context.params;
    const intent = await intentRepository.findById(id);
    if (!intent) return json({ error: { code: "NOT_FOUND" } }, 404, requestId);
    const rawBody = await boundedBody(request, 2_048);
    await requireWalletSignature(
      request,
      rawBody,
      intent.creator,
      intent.chainId,
    );
    const rate = await rateLimiter.consume(
      "submit-intent",
      intent.creator,
      20,
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
    const body = JSON.parse(rawBody) as { transactionHash?: string };
    if (!body.transactionHash || !isHash(body.transactionHash)) {
      return json(
        { error: { code: "INVALID_TRANSACTION_HASH" } },
        400,
        requestId,
      );
    }
    return json(
      { intent: await intentService.markSubmitted(id, body.transactionHash) },
      200,
      requestId,
    );
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
