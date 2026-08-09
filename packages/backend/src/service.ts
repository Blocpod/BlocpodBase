import { randomUUID } from "node:crypto";
import type { Address, Hash } from "viem";
import { buildIntent, createIntentSchema, type DeploymentIntent, type IntentRepository } from "./intents";
import type { IntentSimulator } from "./simulation";

export class IntentService {
  constructor(
    private readonly repository: IntentRepository,
    private readonly simulator: IntentSimulator,
    private readonly resolveFactory: (chainId: 8453 | 84532) => Address,
    private readonly transactionVerifier: TransactionVerifier,
  ) {}

  async createAndSimulate(raw: unknown): Promise<DeploymentIntent> {
    const parsed = createIntentSchema.parse(raw);
    const existing = await this.repository.findByIdempotencyKey(parsed.creator, parsed.idempotencyKey);
    if (existing) return existing;

    const chainId = Number((raw as { chainId?: unknown }).chainId) as 8453 | 84532;
    const intent = buildIntent(raw, this.resolveFactory(chainId), { id: randomUUID() });
    await this.repository.create(intent);
    const simulation = await this.simulator.simulate(intent);
    return this.repository.updateStatus(
      intent.id,
      ["draft"],
      simulation.ok ? "simulated" : "failed",
      { simulation },
    );
  }

  async markSubmitted(id: string, transactionHash: Hash): Promise<DeploymentIntent> {
    const intent = await this.repository.findById(id);
    if (!intent) throw new Error("Intent not found");
    if (
      (intent.status === "submitted" || intent.status === "confirmed") &&
      intent.transactionHash?.toLowerCase() === transactionHash.toLowerCase()
    ) {
      return intent;
    }
    const verification = await this.transactionVerifier.verify(intent, transactionHash);
    if (!verification.ok) throw new Error(`Invalid deployment transaction: ${verification.reasonCode}`);
    if (intent.status === "submitted") {
      return this.repository.updateStatus(id, ["submitted"], "submitted", {
        transactionHash,
      });
    }
    if (intent.status === "confirmed") {
      throw new Error("A confirmed deployment cannot be replaced");
    }
    return this.repository.updateStatus(id, ["simulated"], "submitted", { transactionHash });
  }
}

export interface TransactionVerifier {
  verify(intent: DeploymentIntent, transactionHash: Hash): Promise<{ ok: boolean; reasonCode: string }>;
}
