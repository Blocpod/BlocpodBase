import type { Address } from "viem";
import { assertIntentTransition, type DeploymentIntent, type IntentRepository, type IntentStatus } from "./intents";

export class MemoryIntentRepository implements IntentRepository {
  private readonly records = new Map<string, DeploymentIntent>();

  async create(intent: DeploymentIntent): Promise<DeploymentIntent> {
    if (this.records.has(intent.id)) throw new Error("Intent already exists");
    this.records.set(intent.id, structuredClone(intent));
    return structuredClone(intent);
  }

  async findById(id: string): Promise<DeploymentIntent | null> {
    const value = this.records.get(id);
    return value ? structuredClone(value) : null;
  }

  async findByIdempotencyKey(creator: Address, key: string): Promise<DeploymentIntent | null> {
    const value = [...this.records.values()].find(
      item => item.creator.toLowerCase() === creator.toLowerCase() && item.idempotencyKey === key,
    );
    return value ? structuredClone(value) : null;
  }

  async updateStatus(
    id: string,
    expected: IntentStatus[],
    next: IntentStatus,
    patch: Partial<Pick<DeploymentIntent, "simulation" | "transactionHash">> = {},
  ): Promise<DeploymentIntent> {
    const current = this.records.get(id);
    if (!current) throw new Error("Intent not found");
    if (!expected.includes(current.status)) throw new Error("Intent was modified concurrently");
    assertIntentTransition(current.status, next);
    const updated = { ...current, ...patch, status: next, updatedAt: new Date().toISOString() };
    this.records.set(id, updated);
    return structuredClone(updated);
  }
}

/**
 * Build-safe, fail-closed repository for a production process that is missing
 * its database configuration. This prevents accidental ephemeral production
 * intents while still allowing the immutable application artifact to build.
 */
export class UnavailableIntentRepository implements IntentRepository {
  private unavailable(): never {
    throw new Error("Production intent storage is unavailable");
  }

  async create(_intent: DeploymentIntent): Promise<DeploymentIntent> {
    return this.unavailable();
  }

  async findById(_id: string): Promise<DeploymentIntent | null> {
    return this.unavailable();
  }

  async findByIdempotencyKey(
    _creator: Address,
    _key: string,
  ): Promise<DeploymentIntent | null> {
    return this.unavailable();
  }

  async updateStatus(
    _id: string,
    _expected: IntentStatus[],
    _next: IntentStatus,
    _patch: Partial<Pick<DeploymentIntent, "simulation" | "transactionHash">> = {},
  ): Promise<DeploymentIntent> {
    return this.unavailable();
  }
}
