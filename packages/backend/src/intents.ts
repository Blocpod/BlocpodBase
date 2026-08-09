import {
  encodeFunctionData,
  getAddress,
  isAddress,
  keccak256,
  stringToHex,
  type Address,
  type Hash,
  type Hex,
} from "viem";
import { z } from "zod";
import { supportedChainIdSchema, type SupportedChainId } from "./chains";
import { factoryV1Abi, FACTORY_VERSION } from "./factory";

const addressSchema = z
  .string()
  .refine(isAddress, "Invalid EVM address")
  .transform(value => getAddress(value));

export const createIntentSchema = z.object({
  idempotencyKey: z.string().uuid(),
  chainId: supportedChainIdSchema,
  creator: addressSchema,
  name: z.string().trim().min(1).refine(
    value => new TextEncoder().encode(value).length <= 64,
    "Name exceeds 64 UTF-8 bytes",
  ),
  symbol: z.string().trim().min(1).max(12).regex(/^[A-Za-z0-9]+$/),
  initialSupply: z.string().regex(/^[1-9][0-9]{0,77}$/),
  initialRecipient: addressSchema,
  userSalt: z.string().regex(/^0x[0-9a-fA-F]{64}$/).transform(value => value.toLowerCase() as Hash),
});

export type CreateIntentInput = z.infer<typeof createIntentSchema>;
export type IntentStatus = "draft" | "simulated" | "submitted" | "confirmed" | "failed" | "expired";

export interface SimulationResult {
  ok: boolean;
  gasEstimate?: string;
  predictedToken?: Address;
  blockNumber: string;
  simulatedAt: string;
  errorCode?: string;
  errorMessage?: string;
}

export interface DeploymentIntent extends CreateIntentInput {
  id: string;
  factory: Address;
  factoryVersion: typeof FACTORY_VERSION;
  calldata: Hex;
  calldataHash: Hash;
  status: IntentStatus;
  simulation?: SimulationResult;
  transactionHash?: Hash;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface IntentRepository {
  create(intent: DeploymentIntent): Promise<DeploymentIntent>;
  findById(id: string): Promise<DeploymentIntent | null>;
  findByIdempotencyKey(creator: Address, key: string): Promise<DeploymentIntent | null>;
  updateStatus(
    id: string,
    expected: IntentStatus[],
    next: IntentStatus,
    patch?: Partial<Pick<DeploymentIntent, "simulation" | "transactionHash">>,
  ): Promise<DeploymentIntent>;
}

export function buildIntent(
  raw: unknown,
  factory: Address,
  options: { id: string; now?: Date; ttlMs?: number },
): DeploymentIntent {
  const input = createIntentSchema.parse(raw);
  const now = options.now ?? new Date();
  const calldata = encodeFunctionData({
    abi: factoryV1Abi,
    functionName: "deployToken",
    args: [input.name, input.symbol, BigInt(input.initialSupply), input.initialRecipient, input.userSalt],
  });

  return {
    ...input,
    id: options.id,
    factory,
    factoryVersion: FACTORY_VERSION,
    calldata,
    calldataHash: keccak256(calldata),
    status: "draft",
    expiresAt: new Date(now.getTime() + (options.ttlMs ?? 15 * 60_000)).toISOString(),
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
}

const transitions: Record<IntentStatus, ReadonlySet<IntentStatus>> = {
  draft: new Set(["simulated", "failed", "expired"]),
  // A finalized, exactly matching factory event may reconcile a client that
  // refreshed before its wallet exposed a transaction hash.
  simulated: new Set(["submitted", "confirmed", "failed", "expired"]),
  // submitted -> submitted records a wallet replacement after re-verifying
  // that the replacement remains bound to the exact reviewed intent.
  submitted: new Set(["submitted", "confirmed", "failed"]),
  confirmed: new Set(),
  failed: new Set(),
  expired: new Set(),
};

export function assertIntentTransition(from: IntentStatus, to: IntentStatus): void {
  if (!transitions[from].has(to)) throw new Error(`Invalid intent transition: ${from} -> ${to}`);
}

export function intentBindingMessage(intent: DeploymentIntent): Hex {
  return stringToHex(
    `Blocpod deployment intent\nID: ${intent.id}\nChain: ${intent.chainId}\nCalldata hash: ${intent.calldataHash}\nExpires: ${intent.expiresAt}`,
  );
}

export function requiresMainnetConfirmation(chainId: SupportedChainId): boolean {
  return chainId === 8453;
}
