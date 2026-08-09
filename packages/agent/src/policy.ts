import { getAddress, isAddress, zeroAddress, type Address } from "viem";
import { z } from "zod";

export const chainIdSchema = z.union([z.literal(8453), z.literal(84532)]);
export const addressSchema = z
  .string()
  .refine(isAddress, "Invalid EVM address")
  .transform(value => getAddress(value));

export const lookupDeploymentsSchema = z.object({
  chainId: chainIdSchema,
  creator: addressSchema,
  limit: z.number().int().min(1).max(50).default(20),
});

export const explainIntentSchema = z.object({
  chainId: chainIdSchema,
  intentId: z.string().uuid(),
  creator: addressSchema,
});

export const draftDistributionSchema = z.object({
  chainId: chainIdSchema,
  token: addressSchema,
  sender: addressSchema,
  recipients: z
    .array(
      z.object({
        address: addressSchema,
        amount: z.string().regex(/^[1-9][0-9]*$/),
      }),
    )
    .min(1)
    .max(200),
});

export type DistributionDraft = z.infer<typeof draftDistributionSchema>;

export function isActor(actor: string, claimedAddress: string): boolean {
  return isAddress(actor) && getAddress(actor) === getAddress(claimedAddress);
}

export interface PolicyDecision {
  allowed: boolean;
  reasonCode: string;
}

export function evaluateDistributionDraft(input: DistributionDraft): PolicyDecision {
  if (input.token === zeroAddress || input.sender === zeroAddress) {
    return { allowed: false, reasonCode: "ZERO_ADDRESS" };
  }
  const unique = new Set(input.recipients.map(item => item.address.toLowerCase()));
  if (unique.size !== input.recipients.length) {
    return { allowed: false, reasonCode: "DUPLICATE_RECIPIENT" };
  }
  const total = input.recipients.reduce((sum, item) => sum + BigInt(item.amount), 0n);
  if (total <= 0n || total >= 2n ** 256n) {
    return { allowed: false, reasonCode: "INVALID_TOTAL" };
  }
  return { allowed: true, reasonCode: "PROPOSAL_ONLY" };
}

export interface UnsignedDistributionProposal {
  kind: "erc20-batch-transfer-proposal";
  chainId: 8453 | 84532;
  token: Address;
  sender: Address;
  recipients: Array<{ address: Address; amount: string }>;
  total: string;
  execution: "client-signature-required";
}
