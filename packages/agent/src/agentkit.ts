import { AgentKit, type WalletProvider } from "@coinbase/agentkit";
import { blocpodActionProvider, type BlocpodAgentDependencies } from "./actions";

/**
 * Builds the deliberately constrained AgentKit instance. Callers must supply a
 * wallet provider, but none of its signing methods are exposed as actions.
 */
export async function createBlocpodAgentKit(
  walletProvider: WalletProvider,
  dependencies: BlocpodAgentDependencies,
): Promise<AgentKit> {
  return AgentKit.from({
    walletProvider,
    actionProviders: [blocpodActionProvider(dependencies)],
  });
}
