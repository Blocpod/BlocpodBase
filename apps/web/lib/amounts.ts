import { formatUnits } from "viem";

export function formatTokenAmount(
  value: bigint,
  decimals = 18,
  fractionDigits = 4,
) {
  const [whole = "0", fraction = ""] = formatUnits(value, decimals).split(".");
  const grouped = BigInt(whole).toLocaleString("en-US");
  const visibleFraction = fraction.slice(0, fractionDigits).replace(/0+$/, "");
  return visibleFraction ? `${grouped}.${visibleFraction}` : grouped;
}

export function formatSupplyPreview(value: string) {
  const normalized = value.trim().replaceAll(",", "");
  if (!/^\d+(?:\.\d+)?$/.test(normalized)) return "—";
  const [whole = "0"] = normalized.split(".");
  const integer = BigInt(whole);
  const units = [
    { size: 1_000_000_000_000_000_000n, suffix: "Q" },
    { size: 1_000_000_000_000_000n, suffix: "q" },
    { size: 1_000_000_000_000n, suffix: "T" },
    { size: 1_000_000_000n, suffix: "B" },
    { size: 1_000_000n, suffix: "M" },
    { size: 1_000n, suffix: "K" },
  ];
  const unit = units.find((item) => integer >= item.size);
  if (!unit) return integer.toLocaleString("en-US");
  const tenths = (integer * 10n) / unit.size;
  return `${tenths / 10n}${tenths % 10n === 0n ? "" : `.${tenths % 10n}`}${unit.suffix}`;
}

export function formatPercentage(part: bigint, total: bigint) {
  if (total <= 0n) return "—";
  const tenths = (part * 1_000n) / total;
  return `${tenths / 10n}.${tenths % 10n}%`;
}
