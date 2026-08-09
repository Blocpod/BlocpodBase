import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("production migration", () => {
  it("contains all persistence and operations tables", async () => {
    const sql = await readFile(new URL("../migrations/001_initial.sql", import.meta.url), "utf8");
    for (const table of [
      "deployment_intents",
      "token_deployments",
      "indexer_cursors",
      "indexed_blocks",
      "agent_audit_events",
      "api_rate_limits",
    ]) {
      expect(sql).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
    }
    expect(sql).toMatch(/^BEGIN;/);
    expect(sql).toMatch(/COMMIT;\s*$/);
  });
});
