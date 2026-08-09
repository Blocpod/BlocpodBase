import { describe, expect, it, vi } from "vitest";
import type { WalletProvider } from "@coinbase/agentkit";
import { blocpodActionProvider } from "../src/actions";

const actor = "0x1111111111111111111111111111111111111111";
const other = "0x2222222222222222222222222222222222222222";

describe("constrained AgentKit actions", () => {
  it("denies and audits cross-wallet reads with chain context", async () => {
    const audit = vi.fn(async () => undefined);
    const provider = blocpodActionProvider({
      actor,
      lookupDeployments: vi.fn(async () => []),
      explainIntent: vi.fn(async input => ({ ...input })),
      audit,
    });
    const action = provider
      .getActions({} as WalletProvider)
      .find(item => item.name === "blocpod_lookup_deployments");
    expect(action).toBeDefined();
    await expect(action!.invoke({ chainId: 8453, creator: other, limit: 10 })).rejects.toThrow(
      "wallet ownership mismatch",
    );
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({
      chainId: 8453,
      decision: "denied",
      reasonCode: "WALLET_OWNERSHIP_MISMATCH",
    }));
  });
});
