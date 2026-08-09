import { describe, expect, it } from "vitest";
import { draftDistributionSchema, evaluateDistributionDraft } from "../src/policy";

const a = "0x1111111111111111111111111111111111111111";
const b = "0x2222222222222222222222222222222222222222";

describe("agent policy", () => {
  it("allows a bounded unsigned distribution proposal", () => {
    const draft = draftDistributionSchema.parse({
      chainId: 84532,
      token: a,
      sender: b,
      recipients: [{ address: a, amount: "1" }],
    });
    expect(evaluateDistributionDraft(draft)).toEqual({ allowed: true, reasonCode: "PROPOSAL_ONLY" });
  });

  it("denies duplicate recipients", () => {
    const draft = draftDistributionSchema.parse({
      chainId: 8453,
      token: a,
      sender: b,
      recipients: [
        { address: a, amount: "1" },
        { address: a, amount: "2" },
      ],
    });
    expect(evaluateDistributionDraft(draft).reasonCode).toBe("DUPLICATE_RECIPIENT");
  });
});
