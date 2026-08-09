"use client";

import "@coinbase/onchainkit/styles.css";
import { OnchainKitProvider } from "@coinbase/onchainkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import {
  http,
  cookieStorage,
  createConfig,
  createStorage,
  WagmiProvider,
} from "wagmi";
import { base, baseSepolia } from "wagmi/chains";
import { coinbaseWallet } from "wagmi/connectors";

const defaultChain =
  process.env.NEXT_PUBLIC_DEFAULT_CHAIN_ID === "8453" ? base : baseSepolia;
const config = createConfig({
  chains: [baseSepolia, base],
  connectors: [coinbaseWallet({ appName: "Blocpod", preference: "all" })],
  ssr: true,
  storage: createStorage({ storage: cookieStorage }),
  transports: {
    [baseSepolia.id]: http(process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL),
    [base.id]: http(process.env.NEXT_PUBLIC_BASE_MAINNET_RPC_URL),
  },
});

export function Web3Provider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 12_000, retry: 2, refetchOnWindowFocus: false },
        },
      }),
  );

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <OnchainKitProvider
          {...(process.env.NEXT_PUBLIC_ONCHAINKIT_API_KEY
            ? { apiKey: process.env.NEXT_PUBLIC_ONCHAINKIT_API_KEY }
            : {})}
          chain={defaultChain}
          config={{
            appearance: { mode: "dark", name: "Blocpod", theme: "base" },
            wallet: {
              display: "modal",
              preference: "all",
              termsUrl: "/terms",
              privacyUrl: "/privacy",
            },
          }}
        >
          {children}
        </OnchainKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
