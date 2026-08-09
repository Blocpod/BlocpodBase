import { describe, expect, it } from "vitest";
import { buildIntent, assertIntentTransition } from "../src/intents";
import { UnavailableIntentRepository } from "../src/memory-repository";

const address = "0x1111111111111111111111111111111111111111";
const factory = "0x2222222222222222222222222222222222222222";

describe("deployment intents", () => {
  it("binds canonical calldata and expires", () => {
    const intent = buildIntent(
      {
        idempotencyKey: "d4d98c18-5b66-4a31-9d23-ecb86bcc9c51",
        chainId: 84532,
        creator: address,
        name: "Blocpod",
        symbol: "BLOC",
        initialSupply: "1000000000000000000",
        initialRecipient: address,
        userSalt: `0x${"ab".repeat(32)}`,
      },
      factory,
      { id: "376cdcd6-c66f-4649-b31f-74f9020f1663", now: new Date("2026-01-01T00:00:00Z") },
    );
    expect(intent.calldata).toMatch(/^0x/);
    expect(intent.calldataHash).toHaveLength(66);
    expect(intent.expiresAt).toBe("2026-01-01T00:15:00.000Z");
  });

  it("rejects invalid lifecycle transitions", () => {
    expect(() => assertIntentTransition("draft", "confirmed")).toThrow("Invalid intent transition");
    expect(() => assertIntentTransition("simulated", "submitted")).not.toThrow();
    expect(() => assertIntentTransition("simulated", "confirmed")).not.toThrow();
    expect(() => assertIntentTransition("submitted", "submitted")).not.toThrow();
  });

  it("caps user-controlled metadata", () => {
    expect(() =>
      buildIntent(
        {
          idempotencyKey: crypto.randomUUID(),
          chainId: 84532,
          creator: address,
          name: "x".repeat(65),
          symbol: "BLOC",
          initialSupply: "1",
          initialRecipient: address,
          userSalt: `0x${"00".repeat(32)}`,
        },
        factory,
        { id: crypto.randomUUID() },
      ),
    ).toThrow();
  });

  it("enforces the contract UTF-8 byte boundary", () => {
    const base = {
      idempotencyKey: crypto.randomUUID(),
      chainId: 84532,
      creator: address,
      symbol: "BLOC",
      initialSupply: "1",
      initialRecipient: address,
      userSalt: `0x${"00".repeat(32)}`,
    };
    expect(() => buildIntent({ ...base, name: "😀".repeat(16) }, factory, { id: crypto.randomUUID() })).not.toThrow();
    expect(() => buildIntent({ ...base, name: "😀".repeat(17) }, factory, { id: crypto.randomUUID() })).toThrow("UTF-8 bytes");
  });

  it("fails closed when production intent storage is unavailable", async () => {
    const repository = new UnavailableIntentRepository();
    await expect(repository.findById("missing")).rejects.toThrow(
      "Production intent storage is unavailable",
    );
  });
});
