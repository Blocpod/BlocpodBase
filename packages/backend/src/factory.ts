import { baseTokenFactoryV1Abi } from "@blocpod/contracts";
import type { AbiEvent } from "viem";

export const factoryV1Abi = baseTokenFactoryV1Abi;
const tokenDeployedEvent = baseTokenFactoryV1Abi.find(
  item => item.type === "event" && item.name === "TokenDeployed",
);
if (!tokenDeployedEvent) throw new Error("Shared factory ABI is missing TokenDeployed");
export const factoryV1TokenDeployedEvent = tokenDeployedEvent as AbiEvent;

export const FACTORY_VERSION = "1" as const;
