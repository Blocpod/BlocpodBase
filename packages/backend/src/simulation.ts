import {
  createPublicClient,
  getAddress,
  http,
  type Address,
} from "viem";
import { getChain } from "./chains";
import { factoryV1Abi } from "./factory";
import type { DeploymentIntent, SimulationResult } from "./intents";

export interface IntentSimulator {
  simulate(intent: DeploymentIntent): Promise<SimulationResult>;
}

export class ViemIntentSimulator implements IntentSimulator {
  constructor(private readonly clients: ReadonlyMap<number, BlocpodPublicClient>) {}

  async simulate(intent: DeploymentIntent): Promise<SimulationResult> {
    const client = this.clients.get(intent.chainId);
    if (!client) throw new Error(`No RPC client configured for chain ${intent.chainId}`);
    const blockNumber = await client.getBlockNumber();

    try {
      const predictedToken = await client.readContract({
        address: intent.factory,
        abi: factoryV1Abi,
        functionName: "predictTokenAddress",
        args: [
          intent.creator,
          intent.name,
          intent.symbol,
          BigInt(intent.initialSupply),
          intent.initialRecipient,
          intent.userSalt,
        ],
        blockNumber,
      });
      const result = await client.simulateContract({
        account: intent.creator,
        address: intent.factory,
        abi: factoryV1Abi,
        functionName: "deployToken",
        args: [
          intent.name,
          intent.symbol,
          BigInt(intent.initialSupply),
          intent.initialRecipient,
          intent.userSalt,
        ],
        blockNumber,
      });
      const gas = await client.estimateContractGas(result.request);

      return {
        ok: true,
        gasEstimate: gas.toString(),
        predictedToken: getAddress(predictedToken),
        blockNumber: blockNumber.toString(),
        simulatedAt: new Date().toISOString(),
      };
    } catch (error) {
      return {
        ok: false,
        blockNumber: blockNumber.toString(),
        simulatedAt: new Date().toISOString(),
        errorCode: "SIMULATION_REVERTED",
        errorMessage: redactRpcError(error),
      };
    }
  }
}

export function createRpcClient(chainId: 8453 | 84532, rpcUrl: string) {
  return createPublicClient({
    chain: getChain(chainId),
    transport: http(rpcUrl, { retryCount: 2, retryDelay: 250, timeout: 10_000 }),
  });
}

export type BlocpodPublicClient = ReturnType<typeof createRpcClient>;

function redactRpcError(error: unknown): string {
  const message = error instanceof Error ? error.message : "Contract simulation failed";
  return message.replace(/https?:\/\/[^\s]+/g, "[rpc-url-redacted]").slice(0, 500);
}
