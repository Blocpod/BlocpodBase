import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

function luminance(hex: string) {
  const channels = hex
    .slice(1)
    .match(/.{2}/g)!
    .map((channel) => Number.parseInt(channel, 16) / 255)
    .map((channel) =>
      channel <= 0.04045
        ? channel / 12.92
        : ((channel + 0.055) / 1.055) ** 2.4,
    );

  return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
}

function contrast(foreground: string, background: string) {
  const brighter = Math.max(luminance(foreground), luminance(background));
  const darker = Math.min(luminance(foreground), luminance(background));
  return (brighter + 0.05) / (darker + 0.05);
}

describe("accessible typography system", () => {
  it("keeps the body and interface scale legible", () => {
    expect(css).toContain("--font-size-xs: 0.8125rem;");
    expect(css).toContain("--font-size-sm: 0.875rem;");
    expect(css).toContain("--font-size-base: 1rem;");

    const undersizedPixelRules = [...css.matchAll(/font-size:\s*([\d.]+)px/g)]
      .map((match) => Number(match[1]))
      .filter((size) => size > 0 && size < 13);

    expect(undersizedPixelRules).toEqual([]);
  });

  it("keeps muted body text above WCAG AA normal-text contrast", () => {
    expect(contrast("#a2b1a8", "#050706")).toBeGreaterThanOrEqual(4.5);
    expect(contrast("#85958c", "#050706")).toBeGreaterThanOrEqual(4.5);
  });
});
