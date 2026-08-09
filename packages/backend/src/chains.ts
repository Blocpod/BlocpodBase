import { base, baseSepolia } from "viem/chains";
import { z } from "zod";

export const supportedChainIds = [baseSepolia.id, base.id] as const;
export type SupportedChainId = (typeof supportedChainIds)[number];

export const supportedChainIdSchema = z.union([z.literal(baseSepolia.id), z.literal(base.id)]);

export function getChain(chainId: SupportedChainId) {
  return chainId === base.id ? base : baseSepolia;
}

export function isMainnet(chainId: SupportedChainId): boolean {
  return chainId === base.id;
}
