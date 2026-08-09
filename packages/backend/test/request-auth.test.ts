import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { describe, expect, it } from "vitest";
import { requestSigningMessage, verifySignedRequest } from "../src/request-auth";

describe("signed API requests", () => {
  it("verifies a fresh request and rejects a replay outside the freshness window", async () => {
    const account = privateKeyToAccount(generatePrivateKey());
    const unsigned = {
      method: "POST",
      path: "/api/intents",
      rawBody: '{"chainId":84532}',
      issuedAt: "2026-01-01T00:00:00.000Z",
    };
    const signature = await account.signMessage({ message: requestSigningMessage(unsigned) });
    const request = { ...unsigned, signature, signer: account.address };
    expect(await verifySignedRequest(request, { now: Date.parse(unsigned.issuedAt) })).toBe(true);
    expect(await verifySignedRequest(request, { now: Date.parse(unsigned.issuedAt) + 600_000 })).toBe(false);
  });
});
