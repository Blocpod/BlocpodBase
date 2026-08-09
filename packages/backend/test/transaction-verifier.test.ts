import { describe, expect, it } from "vitest";
import { encodeAbiParameters, encodeEventTopics, parseAbiParameters } from "viem";
import { factoryV1Abi } from "../src/factory";
import type { BlocpodPublicClient } from "../src/simulation";
import { buildIntent } from "../src/intents";
import { ViemTransactionVerifier } from "../src/transaction-verifier";

const creator = "0x1111111111111111111111111111111111111111";
const factory = "0x2222222222222222222222222222222222222222";
const txHash = `0x${"ab".repeat(32)}` as const;

const intent = buildIntent(
  {
    idempotencyKey: "d4d98c18-5b66-4a31-9d23-ecb86bcc9c51",
    chainId: 84532,
    creator,
    name: "Blocpod",
    symbol: "BLOC",
    initialSupply: "1",
    initialRecipient: creator,
    userSalt: `0x${"cd".repeat(32)}`,
  },
  factory,
  { id: crypto.randomUUID() },
);

describe("submitted transaction binding", () => {
  it("accepts only exact creator, factory, calldata, and zero value", async () => {
    const client = {
      getTransaction: async () => ({ from: creator, to: factory, input: intent.calldata, value: 0n }),
    } as unknown as BlocpodPublicClient;
    const verifier = new ViemTransactionVerifier(new Map([[84532, client]]));
    expect(await verifier.verify(intent, txHash)).toEqual({ ok: true, reasonCode: "BOUND_TRANSACTION" });
  });

  it("rejects calldata substitution", async () => {
    const client = {
      getTransaction: async () => ({ from: creator, to: factory, input: "0xdeadbeef", value: 0n }),
    } as unknown as BlocpodPublicClient;
    const verifier = new ViemTransactionVerifier(new Map([[84532, client]]));
    expect((await verifier.verify(intent, txHash)).reasonCode).toBe("CALLDATA_MISMATCH");
  });

  it("accepts a successful smart-wallet receipt with the exact factory event", async () => {
    const token = "0x3333333333333333333333333333333333333333";
    const deploymentSalt = `0x${"ef".repeat(32)}` as const;
    const client = {
      getTransactionReceipt: async () => ({
        status: "success",
        logs: [{
          address: factory,
          topics: encodeEventTopics({
            abi: factoryV1Abi,
            eventName: "TokenDeployed",
            args: { creator, token, deploymentSalt },
          }),
          data: encodeAbiParameters(
            parseAbiParameters("address,string,string,uint256,bytes32"),
            [creator, "Blocpod", "BLOC", 1n, intent.userSalt],
          ),
        }],
      }),
    } as unknown as BlocpodPublicClient;
    const verifier = new ViemTransactionVerifier(new Map([[84532, client]]));
    expect(await verifier.verify(intent, txHash)).toEqual({ ok: true, reasonCode: "RECEIPT_EVENT_MATCH" });
  });
});
