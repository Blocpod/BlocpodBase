import { describe, expect, it } from "vitest";
import { MemoryIntentRepository } from "../src/memory-repository";
import { IntentService } from "../src/service";

const creator = "0x1111111111111111111111111111111111111111" as const;
const factory = "0x2222222222222222222222222222222222222222" as const;
const firstHash = `0x${"aa".repeat(32)}` as const;
const replacementHash = `0x${"bb".repeat(32)}` as const;
const rejectedHash = `0x${"cc".repeat(32)}` as const;

describe("intent submission service", () => {
  it("accepts an exactly verified replacement transaction hash", async () => {
    const repository = new MemoryIntentRepository();
    const service = new IntentService(
      repository,
      {
        simulate: async () => ({
          ok: true,
          gasEstimate: "100000",
          predictedToken: "0x3333333333333333333333333333333333333333",
          blockNumber: "1",
          simulatedAt: new Date().toISOString(),
        }),
      },
      () => factory,
      {
        verify: async (_intent, hash) =>
          hash === rejectedHash
            ? { ok: false, reasonCode: "CALLDATA_MISMATCH" }
            : { ok: true, reasonCode: "BOUND_TRANSACTION" },
      },
    );
    const intent = await service.createAndSimulate({
      idempotencyKey: crypto.randomUUID(),
      chainId: 84532,
      creator,
      name: "Blocpod",
      symbol: "BLOC",
      initialSupply: "1",
      initialRecipient: creator,
      userSalt: `0x${"00".repeat(32)}`,
    });
    const submitted = await service.markSubmitted(intent.id, firstHash);
    expect(submitted.transactionHash).toBe(firstHash);
    expect(await service.markSubmitted(intent.id, firstHash)).toEqual(submitted);
    await expect(service.markSubmitted(intent.id, rejectedHash)).rejects.toThrow(
      "CALLDATA_MISMATCH",
    );
    const replaced = await service.markSubmitted(intent.id, replacementHash);
    expect(replaced.status).toBe("submitted");
    expect(replaced.transactionHash).toBe(replacementHash);
    await repository.updateStatus(intent.id, ["submitted"], "confirmed");
    await expect(service.markSubmitted(intent.id, firstHash)).rejects.toThrow(
      "confirmed deployment cannot be replaced",
    );
  });
});
