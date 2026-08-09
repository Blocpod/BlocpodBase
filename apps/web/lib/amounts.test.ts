import { describe, expect, it } from "vitest";
import {
  formatPercentage,
  formatSupplyPreview,
  formatTokenAmount,
} from "./amounts";

describe("token amount formatting", () => {
  it("formats uint256-scale supplies without Number conversion", () => {
    const huge = 2n ** 256n - 1n;
    expect(formatTokenAmount(huge, 18)).toBe(
      "115,792,089,237,316,195,423,570,985,008,687,907,853,269,984,665,640,564,039,457.584",
    );
  });

  it("formats previews and ratios with bigint arithmetic", () => {
    expect(formatSupplyPreview("1000000000000000000000000")).toBe("1000000Q");
    expect(formatPercentage(1n, 3n)).toBe("33.3%");
  });
});
