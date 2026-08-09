import { ActionProvider, type Action, type Network, type WalletProvider } from "@coinbase/agentkit";
import { keccak256, stringToHex } from "viem";
import {
  draftDistributionSchema,
  evaluateDistributionDraft,
  explainIntentSchema,
  lookupDeploymentsSchema,
  isActor,
  type UnsignedDistributionProposal,
} from "./policy";

export interface AgentAuditEvent {
  actor: string;
  action: string;
  chainId?: number;
  requestHash: string;
  resultHash?: string;
  decision: "allowed" | "denied" | "proposed" | "failed";
  reasonCode: string;
}

export interface BlocpodAgentDependencies {
  actor: string;
  lookupDeployments(input: { chainId: 8453 | 84532; creator: string; limit: number }): Promise<unknown>;
  explainIntent(input: { chainId: 8453 | 84532; intentId: string; creator: string }): Promise<{ creator: string; chainId: number; [key: string]: unknown }>;
  audit(event: AgentAuditEvent): Promise<void>;
}

export function blocpodActionProvider(dependencies: BlocpodAgentDependencies) {
  const actions: Action[] = [
    {
      name: "blocpod_lookup_deployments",
      description: "Read indexed Blocpod token deployments owned by a wallet. This action never signs or submits transactions.",
      schema: lookupDeploymentsSchema,
      invoke: async raw => {
        const input = lookupDeploymentsSchema.parse(raw);
        await assertActor(dependencies, "blocpod_lookup_deployments", input.chainId, input, input.creator);
        return JSON.stringify(await invokeAudited(
          dependencies,
          "blocpod_lookup_deployments",
          input,
          input.chainId,
          "allowed",
          "READ_ONLY",
          () => dependencies.lookupDeployments(input),
        ));
      },
    },
    {
      name: "blocpod_explain_deployment_intent",
      description: "Explain a stored Blocpod deployment intent after checking it belongs to the requesting wallet.",
      schema: explainIntentSchema,
      invoke: async raw => {
        const input = explainIntentSchema.parse(raw);
        await assertActor(dependencies, "blocpod_explain_deployment_intent", input.chainId, input, input.creator);
        return JSON.stringify(await invokeAudited(dependencies, "blocpod_explain_deployment_intent", input, input.chainId, "allowed", "READ_ONLY", async () => {
          const result = await dependencies.explainIntent(input);
          if (!isActor(input.creator, result.creator) || result.chainId !== input.chainId) {
            throw new Error("Intent ownership mismatch");
          }
          return result;
        }));
      },
    },
    {
      name: "blocpod_draft_distribution",
      description: "Draft a bounded token distribution proposal. It cannot sign, approve, or broadcast a transaction; the user must review and sign in their wallet.",
      schema: draftDistributionSchema,
      invoke: async raw => {
        const input = draftDistributionSchema.parse(raw);
        await assertActor(dependencies, "blocpod_draft_distribution", input.chainId, input, input.sender);
        const policy = evaluateDistributionDraft(input);
        if (!policy.allowed) {
          await dependencies.audit({
            actor: dependencies.actor,
            action: "blocpod_draft_distribution",
            chainId: input.chainId,
            requestHash: hash(input),
            decision: "denied",
            reasonCode: policy.reasonCode,
          });
          throw new Error(`Distribution proposal denied: ${policy.reasonCode}`);
        }
        const proposal: UnsignedDistributionProposal = {
          kind: "erc20-batch-transfer-proposal",
          chainId: input.chainId,
          token: input.token,
          sender: input.sender,
          recipients: input.recipients,
          total: input.recipients.reduce((sum, item) => sum + BigInt(item.amount), 0n).toString(),
          execution: "client-signature-required",
        };
        await dependencies.audit({
          actor: dependencies.actor,
          action: "blocpod_draft_distribution",
          chainId: input.chainId,
          requestHash: hash(input),
          resultHash: hash(proposal),
          decision: "proposed",
          reasonCode: policy.reasonCode,
        });
        return JSON.stringify(proposal);
      },
    },
  ];
  return new ExplicitBlocpodActionProvider(actions);
}

class ExplicitBlocpodActionProvider extends ActionProvider {
  constructor(private readonly actions: Action[]) {
    super("blocpod", []);
  }

  override getActions(_walletProvider: WalletProvider): Action[] {
    return this.actions;
  }

  supportsNetwork(network: Network): boolean {
    return network.protocolFamily === "evm" && (network.chainId === "8453" || network.chainId === "84532");
  }
}

async function invokeAudited<TInput, TResult>(
  dependencies: BlocpodAgentDependencies,
  action: string,
  input: TInput,
  chainId: number,
  decision: "allowed",
  reasonCode: string,
  invoke: () => Promise<TResult>,
): Promise<TResult> {
  const requestHash = hash(input);
  try {
    const result = await invoke();
    await dependencies.audit({
      actor: dependencies.actor,
      action,
      chainId,
      requestHash,
      resultHash: hash(result),
      decision,
      reasonCode,
    });
    return result;
  } catch (error) {
    await dependencies.audit({
      actor: dependencies.actor,
      action,
      chainId,
      requestHash,
      decision: "failed",
      reasonCode: "ACTION_FAILED",
    });
    throw error;
  }
}

async function assertActor(
  dependencies: BlocpodAgentDependencies,
  action: string,
  chainId: number,
  input: unknown,
  claimedAddress: string,
): Promise<void> {
  if (isActor(dependencies.actor, claimedAddress)) return;
  await dependencies.audit({
    actor: dependencies.actor,
    action,
    chainId,
    requestHash: hash(input),
    decision: "denied",
    reasonCode: "WALLET_OWNERSHIP_MISMATCH",
  });
  throw new Error("Agent action denied: wallet ownership mismatch");
}

function hash(value: unknown): string {
  return keccak256(stringToHex(stableStringify(value)));
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}
