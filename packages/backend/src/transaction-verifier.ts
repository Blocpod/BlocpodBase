import { decodeEventLog, getAddress, type Hash } from "viem";
import { factoryV1Abi } from "./factory";
import type { BlocpodPublicClient } from "./simulation";
import type { DeploymentIntent } from "./intents";
import type { TransactionVerifier } from "./service";

export class ViemTransactionVerifier implements TransactionVerifier {
  constructor(private readonly clients: ReadonlyMap<number, BlocpodPublicClient>) {}

  async verify(intent: DeploymentIntent, transactionHash: Hash) {
    const client = this.clients.get(intent.chainId);
    if (!client) return { ok: false, reasonCode: "CHAIN_NOT_CONFIGURED" };
    try {
      const receipt = await client.getTransactionReceipt({ hash: transactionHash });
      if (receipt.status !== "success") return { ok: false, reasonCode: "TRANSACTION_REVERTED" };
      for (const log of receipt.logs) {
        if (getAddress(log.address) !== intent.factory) continue;
        try {
          const decoded = decodeEventLog({ abi: factoryV1Abi, data: log.data, topics: log.topics });
          if (decoded.eventName !== "TokenDeployed") continue;
          const args = decoded.args;
          const matches =
            getAddress(args.creator) === intent.creator &&
            getAddress(args.initialRecipient) === intent.initialRecipient &&
            args.name === intent.name &&
            args.symbol === intent.symbol &&
            args.initialSupply.toString() === intent.initialSupply &&
            args.userSalt.toLowerCase() === intent.userSalt.toLowerCase() &&
            (!intent.simulation?.predictedToken || getAddress(args.token) === intent.simulation.predictedToken);
          if (matches) return { ok: true, reasonCode: "RECEIPT_EVENT_MATCH" };
        } catch {
          // Ignore unrelated logs emitted by the factory transaction.
        }
      }
      return { ok: false, reasonCode: "FACTORY_EVENT_MISMATCH" };
    } catch {
      // A receipt may not exist yet. Permit only the exact direct EOA transaction fast path below.
    }
    try {
      const transaction = await client.getTransaction({ hash: transactionHash });
      if (getAddress(transaction.from) !== intent.creator) return { ok: false, reasonCode: "CREATOR_MISMATCH" };
      if (!transaction.to || getAddress(transaction.to) !== intent.factory) return { ok: false, reasonCode: "FACTORY_MISMATCH" };
      if (transaction.input.toLowerCase() !== intent.calldata.toLowerCase()) return { ok: false, reasonCode: "CALLDATA_MISMATCH" };
      if (transaction.value !== 0n) return { ok: false, reasonCode: "UNEXPECTED_VALUE" };
      return { ok: true, reasonCode: "BOUND_TRANSACTION" };
    } catch {
      return { ok: false, reasonCode: "TRANSACTION_NOT_FOUND" };
    }
  }
}
