import type { SupportedChainId } from "./chains";

export type ContractAddress = `0x${string}`;
export type FactoryVersion = "v1";

export interface FactoryDeployment {
  address: ContractAddress;
  deploymentBlock: bigint;
  transactionHash: `0x${string}`;
  runtimeBytecodeHash: `0x${string}`;
}

// Populated only after source verification and onchain acceptance checks pass.
export const baseTokenFactoryDeployments: Readonly<
  Partial<Record<SupportedChainId, Readonly<Record<FactoryVersion, FactoryDeployment>>>>
> = {};

export const vestingWalletFactoryDeployments: Readonly<
  Partial<Record<SupportedChainId, Readonly<Record<FactoryVersion, FactoryDeployment>>>>
> = {};

export function getBaseTokenFactoryDeployment(
  chainId: SupportedChainId,
  version: FactoryVersion = "v1",
): FactoryDeployment {
  const deployment = baseTokenFactoryDeployments[chainId]?.[version];
  if (!deployment) {
    throw new Error(`BaseTokenFactory ${version} is not configured for chain ${chainId}`);
  }
  return deployment;
}

export function getVestingWalletFactoryDeployment(
  chainId: SupportedChainId,
  version: FactoryVersion = "v1",
): FactoryDeployment {
  const deployment = vestingWalletFactoryDeployments[chainId]?.[version];
  if (!deployment) {
    throw new Error(`BlocpodVestingWalletFactory ${version} is not configured for chain ${chainId}`);
  }
  return deployment;
}
