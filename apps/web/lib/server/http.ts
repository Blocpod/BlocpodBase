import "server-only";

import { getAddress, isAddress, isHex, type Address, type Hex } from "viem";
import { requestId, safeLog, verifySignedRequest } from "@blocpod/backend";
import { rpcClients } from "./backend";

export const jsonHeaders = {
  "cache-control": "no-store",
  "content-type": "application/json; charset=utf-8",
};

export function json(
  body: unknown,
  status = 200,
  correlationId?: string,
): Response {
  return Response.json(body, {
    status,
    headers: {
      ...jsonHeaders,
      ...(correlationId ? { "x-request-id": correlationId } : {}),
    },
  });
}

export function errorResponse(
  error: unknown,
  correlationId = crypto.randomUUID(),
): Response {
  const message =
    error instanceof Error ? error.message : "Unexpected request failure";
  const status = message.includes("not found")
    ? 404
    : message.includes("Invalid")
      ? 400
      : 422;
  safeLog({
    level: status >= 500 ? "error" : "warn",
    event: "api.request_rejected",
    requestId: correlationId,
    errorCode: "REQUEST_REJECTED",
  });
  return json(
    {
      error: {
        code: "REQUEST_REJECTED",
        message: "The request could not be accepted.",
        requestId: correlationId,
      },
    },
    status,
    correlationId,
  );
}

export const correlationId = (request: Request) => requestId(request.headers);

export function networkSubject(request: Request): string {
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  ).slice(0, 128);
}

export async function requireWalletSignature(
  request: Request,
  rawBody: string,
  expectedSigner: string,
  chainId: 8453 | 84532,
): Promise<Address> {
  const issuedAt = request.headers.get("x-blocpod-issued-at") ?? "";
  const signature = request.headers.get("x-blocpod-signature") ?? "";
  if (!isAddress(expectedSigner) || !isHex(signature))
    throw new Error("Invalid wallet signature headers");
  const signer = getAddress(expectedSigner);
  const valid = await verifySignedRequest(
    {
      method: request.method,
      path: new URL(request.url).pathname,
      rawBody,
      issuedAt,
      signature: signature as Hex,
      signer,
    },
    {
      verifier: (parameters) => {
        const client = rpcClients.get(chainId);
        return client
          ? client.verifyMessage(parameters)
          : Promise.resolve(false);
      },
    },
  );
  if (!valid) throw new Error("Invalid or expired wallet signature");
  return signer;
}

export async function boundedBody(
  request: Request,
  maxBytes = 16_384,
): Promise<string> {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > maxBytes) throw new Error("Invalid request body: too large");
  const body = await request.text();
  if (new TextEncoder().encode(body).byteLength > maxBytes) {
    throw new Error("Invalid request body: too large");
  }
  return body;
}
