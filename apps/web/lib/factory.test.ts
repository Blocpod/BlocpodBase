import { describe, expect, it } from "vitest";
import { validateTokenDraft } from "./factory";

const recipient = "0x0000000000000000000000000000000000000001";

describe("validateTokenDraft", () => {
  it("normalizes symbol and parses 18 decimal supply", () => {
    const result = validateTokenDraft({
      name: "Blocpod",
      symbol: "bloc",
      supply: "1000",
      recipient,
      salt: "launch",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.symbol).toBe("BLOC");
      expect(result.value.initialSupply).toBe(1_000n * 10n ** 18n);
    }
  });

  it("rejects an invalid address and zero supply", () => {
    const result = validateTokenDraft({
      name: "Blocpod",
      symbol: "BLOC",
      supply: "0",
      recipient: "nope",
      salt: "launch",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.recipient).toBeDefined();
      expect(result.errors.supply).toBeDefined();
    }
  });

  it("enforces the name limit in UTF-8 bytes", () => {
    expect(
      validateTokenDraft({
        name: "é".repeat(32),
        symbol: "OK",
        supply: "1",
        recipient,
        salt: "launch",
      }).ok,
    ).toBe(true);
    const tooLong = validateTokenDraft({
      name: `${"é".repeat(32)}a`,
      symbol: "NO",
      supply: "1",
      recipient,
      salt: "launch",
    });
    expect(tooLong.ok).toBe(false);
    if (!tooLong.ok) expect(tooLong.errors.name).toContain("UTF-8 bytes");
  });
});
