import { getAddress, isAddress, type Address } from "viem";
import { z } from "zod";
import type { SupportedChainId } from "./chains";

const optionalAddress = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim() === "" ? undefined : value,
  z
    .string()
    .trim()
    .refine(isAddress, "Invalid EVM address")
    .transform((value) => getAddress(value))
    .optional(),
);

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().url().optional(),
  BASE_SEPOLIA_RPC_URL: z.string().url().default("https://sepolia.base.org"),
  BASE_MAINNET_RPC_URL: z.string().url().default("https://mainnet.base.org"),
  FACTORY_BASE_SEPOLIA: optionalAddress,
  FACTORY_BASE_MAINNET: optionalAddress,
  NEXT_PUBLIC_FACTORY_BASE_SEPOLIA: optionalAddress,
  NEXT_PUBLIC_FACTORY_BASE_MAINNET: optionalAddress,
  INDEXER_CONFIRMATIONS_SEPOLIA: z.coerce.number().int().min(0).max(1000).default(2),
  INDEXER_CONFIRMATIONS_MAINNET: z.coerce.number().int().min(0).max(1000).default(12),
  INDEXER_START_BLOCK_SEPOLIA: z.coerce.number().int().min(0).default(0),
  INDEXER_START_BLOCK_MAINNET: z.coerce.number().int().min(0).default(0),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

export type ServerConfig = z.infer<typeof envSchema>;

export function parseServerConfig(input: NodeJS.ProcessEnv = process.env): ServerConfig {
  const parsed = envSchema.parse(input);
  if (
    parsed.NODE_ENV === "production" &&
    Boolean(parsed.FACTORY_BASE_SEPOLIA) !== Boolean(parsed.NEXT_PUBLIC_FACTORY_BASE_SEPOLIA)
  ) throw new Error("Server/public Base Sepolia factory configuration must be paired");
  if (
    parsed.NODE_ENV === "production" &&
    Boolean(parsed.FACTORY_BASE_MAINNET) !== Boolean(parsed.NEXT_PUBLIC_FACTORY_BASE_MAINNET)
  ) throw new Error("Server/public Base mainnet factory configuration must be paired");
  if (
    parsed.FACTORY_BASE_SEPOLIA &&
    parsed.NEXT_PUBLIC_FACTORY_BASE_SEPOLIA &&
    parsed.FACTORY_BASE_SEPOLIA !== parsed.NEXT_PUBLIC_FACTORY_BASE_SEPOLIA
  ) throw new Error("Server/public Base Sepolia factory addresses do not match");
  if (
    parsed.FACTORY_BASE_MAINNET &&
    parsed.NEXT_PUBLIC_FACTORY_BASE_MAINNET &&
    parsed.FACTORY_BASE_MAINNET !== parsed.NEXT_PUBLIC_FACTORY_BASE_MAINNET
  ) throw new Error("Server/public Base mainnet factory addresses do not match");
  if (parsed.NODE_ENV === "production" && parsed.FACTORY_BASE_SEPOLIA && parsed.INDEXER_START_BLOCK_SEPOLIA === 0) {
    throw new Error("INDEXER_START_BLOCK_SEPOLIA is required in production");
  }
  if (parsed.NODE_ENV === "production" && parsed.FACTORY_BASE_MAINNET && parsed.INDEXER_START_BLOCK_MAINNET === 0) {
    throw new Error("INDEXER_START_BLOCK_MAINNET is required in production");
  }
  return parsed;
}

export function factoryForChain(config: ServerConfig, chainId: SupportedChainId): Address {
  const address = chainId === 8453 ? config.FACTORY_BASE_MAINNET : config.FACTORY_BASE_SEPOLIA;
  if (!address) throw new Error(`Factory is not configured for chain ${chainId}`);
  return address;
}

export function rpcForChain(config: ServerConfig, chainId: SupportedChainId): string {
  return chainId === 8453 ? config.BASE_MAINNET_RPC_URL : config.BASE_SEPOLIA_RPC_URL;
}
