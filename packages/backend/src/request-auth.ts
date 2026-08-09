import { keccak256, stringToHex, verifyMessage, type Address, type Hex } from "viem";

export interface SignedRequest {
  method: string;
  path: string;
  rawBody: string;
  issuedAt: string;
  signature: Hex;
  signer: Address;
}

export function requestSigningMessage(input: Omit<SignedRequest, "signature" | "signer">): string {
  const bodyHash = keccak256(stringToHex(input.rawBody));
  return [
    "Blocpod API request",
    input.method.toUpperCase(),
    input.path,
    bodyHash,
    input.issuedAt,
  ].join("\n");
}

export async function verifySignedRequest(
  input: SignedRequest,
  options: {
    now?: number;
    maxAgeMs?: number;
    verifier?: (input: { address: Address; message: string; signature: Hex }) => Promise<boolean>;
  } = {},
): Promise<boolean> {
  const now = options.now ?? Date.now();
  const issuedAt = Date.parse(input.issuedAt);
  const maxAgeMs = options.maxAgeMs ?? 5 * 60_000;
  if (!Number.isFinite(issuedAt) || Math.abs(now - issuedAt) > maxAgeMs) return false;
  const parameters = {
    address: input.signer,
    message: requestSigningMessage(input),
    signature: input.signature,
  };
  return options.verifier ? options.verifier(parameters) : verifyMessage(parameters);
}
