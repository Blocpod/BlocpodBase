import { base, baseSepolia } from "wagmi/chains";
import type { Address } from "viem";

export const supportedChains = [baseSepolia, base] as const;

export type SupportedChainId = (typeof supportedChains)[number]["id"];

export function isSupportedChainId(value: number): value is SupportedChainId {
  return value === base.id || value === baseSepolia.id;
}

export function chainForId(chainId: number) {
  return chainId === base.id ? base : baseSepolia;
}

export function explorerAddressUrl(chainId: number, address: Address | string) {
  return `${chainForId(chainId).blockExplorers.default.url}/address/${address}`;
}

export function explorerTxUrl(chainId: number, hash: string) {
  return `${chainForId(chainId).blockExplorers.default.url}/tx/${hash}`;
}

export function factoryAddress(chainId: number): Address | undefined {
  const value =
    chainId === base.id
      ? process.env.NEXT_PUBLIC_FACTORY_BASE_MAINNET
      : process.env.NEXT_PUBLIC_FACTORY_BASE_SEPOLIA;
  return value && /^0x[a-fA-F0-9]{40}$/.test(value)
    ? (value as Address)
    : undefined;
}

export function vestingFactoryAddress(chainId: number): Address | undefined {
  const value =
    chainId === base.id
      ? process.env.NEXT_PUBLIC_VESTING_FACTORY_BASE_MAINNET
      : process.env.NEXT_PUBLIC_VESTING_FACTORY_BASE_SEPOLIA;
  return value && /^0x[a-fA-F0-9]{40}$/.test(value)
    ? (value as Address)
    : undefined;
}
