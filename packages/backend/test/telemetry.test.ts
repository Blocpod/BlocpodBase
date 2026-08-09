import { describe, expect, it } from "vitest";
import { safeLog } from "../src/telemetry";

describe("telemetry redaction", () => {
  it("removes secrets recursively", () => {
    let line = "";
    safeLog({ level: "info", event: "test", metadata: { signature: "0xsecret" } }, value => {
      line = value;
    });
    expect(line).not.toContain("0xsecret");
    expect(line).toContain("[redacted]");
  });
});
