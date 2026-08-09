import { intentRepository, rateLimiter } from "@/lib/server/backend";
import {
  correlationId,
  errorResponse,
  json,
  requireWalletSignature,
} from "@/lib/server/http";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const requestId = correlationId(request);
  try {
    const { id } = await context.params;
    const intent = await intentRepository.findById(id);
    if (!intent) return json({ error: { code: "NOT_FOUND" } }, 404, requestId);
    await requireWalletSignature(request, "", intent.creator, intent.chainId);
    const rate = await rateLimiter.consume(
      "read-intent",
      intent.creator,
      60,
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
    return json({ intent }, 200, requestId);
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
