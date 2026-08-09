import {
  isAddress,
  parseUnits,
  stringToHex,
  pad,
  type Address,
  type Hex,
} from "viem";
export { baseTokenFactoryV1Abi as baseTokenFactoryAbi } from "@blocpod/contracts";

export type TokenDraft = {
  name: string;
  symbol: string;
  supply: string;
  recipient: string;
  salt: string;
};

export type ValidTokenDraft = {
  name: string;
  symbol: string;
  initialSupply: bigint;
  recipient: Address;
  userSalt: Hex;
};

export function validateTokenDraft(
  draft: TokenDraft,
):
  | { ok: true; value: ValidTokenDraft }
  | { ok: false; errors: Partial<Record<keyof TokenDraft, string>> } {
  const errors: Partial<Record<keyof TokenDraft, string>> = {};
  const name = draft.name.trim();
  const symbol = draft.symbol.trim().toUpperCase();
  if (!name) errors.name = "Enter a token name.";
  else if (new TextEncoder().encode(name).length > 64)
    errors.name = "Use 64 UTF-8 bytes or fewer.";
  if (!symbol) errors.symbol = "Enter a ticker symbol.";
  else if (!/^[A-Z0-9]{2,12}$/.test(symbol))
    errors.symbol = "Use 2–12 letters or numbers.";
  let initialSupply = 0n;
  try {
    initialSupply = parseUnits(draft.supply.trim(), 18);
    if (initialSupply <= 0n)
      errors.supply = "Supply must be greater than zero.";
  } catch {
    errors.supply = "Enter a valid whole or decimal token amount.";
  }
  if (!isAddress(draft.recipient, { strict: false }))
    errors.recipient = "Enter a valid EVM address.";
  const saltText = draft.salt.trim();
  if (!saltText) errors.salt = "Enter a unique deployment salt.";
  const saltBytes = new TextEncoder().encode(saltText);
  if (saltBytes.length > 32)
    errors.salt = "Salt must be 32 UTF-8 bytes or fewer.";
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      name,
      symbol,
      initialSupply,
      recipient: draft.recipient as Address,
      userSalt: pad(stringToHex(saltText), { size: 32 }),
    },
  };
}

export function shortAddress(address: string, size = 5) {
  return `${address.slice(0, size + 2)}…${address.slice(-size)}`;
}
