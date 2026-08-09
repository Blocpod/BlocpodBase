import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("Postgres reorg repair", () => {
  it("demotes affected confirmed intents before deleting orphaned deployments", async () => {
    const source = await readFile(new URL("../src/postgres-store.ts", import.meta.url), "utf8");
    const demote = source.indexOf("SET status = 'submitted'");
    const deleteDeployments = source.indexOf("DELETE FROM token_deployments");
    expect(demote).toBeGreaterThan(0);
    expect(deleteDeployments).toBeGreaterThan(demote);
    expect(source.slice(demote, deleteDeployments)).toContain("deployment.block_number >=");
    expect(source.slice(demote, deleteDeployments)).toContain("deployment.transaction_hash = intent.transaction_hash");
  });

  it("recovers a simulated intent from an exact canonical factory event", async () => {
    const source = await readFile(
      new URL("../src/postgres-store.ts", import.meta.url),
      "utf8",
    );
    const reconcile = source.slice(source.indexOf("status IN ('simulated'"));
    for (const binding of [
      "parameters->>'initialRecipient'",
      "parameters->>'initialSupply'",
      "parameters->>'userSalt'",
      "parameters->>'name'",
      "parameters->>'symbol'",
      "deployment.creator",
      "deployment.factory",
    ]) {
      expect(reconcile).toContain(binding);
    }
    expect(reconcile).toContain("transaction_hash = ${deployment.transactionHash}");
  });
});
