import "server-only";

import postgres from "postgres";
import {
  IntentService,
  MemoryIntentRepository,
  MemoryRateLimiter,
  PostgresIntentRepository,
  PostgresRateLimiter,
  ViemIntentSimulator,
  ViemTransactionVerifier,
  UnavailableIntentRepository,
  createRpcClient,
  factoryForChain,
  parseServerConfig,
  rpcForChain,
} from "@blocpod/backend";

const config = parseServerConfig();
export const backendConfig = config;
const sql = config.DATABASE_URL
  ? postgres(config.DATABASE_URL, { max: 10 })
  : null;
const repository = sql
  ? new PostgresIntentRepository(sql)
  : config.NODE_ENV === "production"
    ? new UnavailableIntentRepository()
    : new MemoryIntentRepository();
export const rpcClients = new Map([
  [84532, createRpcClient(84532, rpcForChain(config, 84532))],
  [8453, createRpcClient(8453, rpcForChain(config, 8453))],
]);
const simulator = new ViemIntentSimulator(rpcClients);

export const intentService = new IntentService(
  repository,
  simulator,
  (chainId) => factoryForChain(config, chainId),
  new ViemTransactionVerifier(rpcClients),
);
export const intentRepository = repository;
export const database = sql;
export const rateLimiter = sql
  ? new PostgresRateLimiter(sql)
  : new MemoryRateLimiter();
