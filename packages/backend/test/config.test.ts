import { describe, expect, it } from "vitest";
import { parseServerConfig } from "../src/config";

describe("server configuration", () => {
  it("treats blank optional factory values from the example environment as unset", () => {
    const config = parseServerConfig({
      NODE_ENV: "development",
      FACTORY_BASE_SEPOLIA: "",
      FACTORY_BASE_MAINNET: "",
      NEXT_PUBLIC_FACTORY_BASE_SEPOLIA: "",
      NEXT_PUBLIC_FACTORY_BASE_MAINNET: "",
    });
    expect(config.FACTORY_BASE_SEPOLIA).toBeUndefined();
    expect(config.FACTORY_BASE_MAINNET).toBeUndefined();
    expect(config.BASE_SEPOLIA_RPC_URL).toBe("https://sepolia.base.org");
  });
});
