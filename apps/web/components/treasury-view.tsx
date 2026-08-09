"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useAccount, useReadContract } from "wagmi";
import { erc20Abi, zeroAddress, type Address } from "viem";
import { Icon } from "./icons";
import { formatTokenAmount } from "@/lib/amounts";

type Deployment = {
  chainId: 8453 | 84532;
  token: Address;
  name: string;
  symbol: string;
};

export function TreasuryView() {
  const { address } = useAccount();
  const deployments = useQuery({
    queryKey: ["treasury-deployments", address],
    enabled: Boolean(address),
    queryFn: async () => {
      const records = await Promise.all(
        [84532, 8453].map(async (chainId) => {
          const response = await fetch(
            `/api/deployments?chainId=${chainId}&creator=${address}&limit=100`,
            { cache: "no-store" },
          );
          if (!response.ok) throw new Error("Indexer unavailable");
          const payload = (await response.json()) as {
            deployments: Deployment[];
            source?: string;
          };
          if (payload.source === "indexer_unavailable")
            throw new Error("Indexer unavailable");
          return payload.deployments;
        }),
      );
      return records.flat();
    },
  });
  return (
    <div className="page-stack">
      <div className="page-title">
        <div>
          <span className="page-eyebrow">Connected wallet</span>
          <h1>Treasury</h1>
          <p>Plan allocations without giving Blocpod custody.</p>
        </div>
      </div>
      <div className="custody-banner">
        <Icon name="shield" />
        <div>
          <strong>Your wallet is the treasury</strong>
          <p>
            Blocpod does not hold funds or control your address. Balances below
            are live RPC reads for tokens created by the connected wallet.
          </p>
        </div>
      </div>
      {deployments.isError ? (
        <div className="risk-banner">
          <Icon name="shield" />
          <div>
            <strong>Indexer unavailable</strong>
            <p>
              Blocpod cannot discover your created tokens right now. No
              estimated balances are shown.
            </p>
          </div>
        </div>
      ) : null}
      <section className="panel">
        <div className="panel-heading">
          <div>
            <span>Created assets</span>
            <h2>Live wallet balances</h2>
          </div>
        </div>
        {deployments.data?.map((deployment) => (
          <TreasuryBalance
            key={`${deployment.chainId}:${deployment.token}`}
            deployment={deployment}
            owner={address}
          />
        ))}
        {!address ||
        (!deployments.isPending && deployments.data?.length === 0) ? (
          <div className="empty-panel">
            <div className="empty-icon">
              <Icon name="wallet" />
            </div>
            <h2>
              {address ? "No indexed tokens" : "Connect your treasury wallet"}
            </h2>
            <p>
              {address
                ? "No verified factory deployments were found for this wallet."
                : "See token balances and open each dashboard to prepare reviewed distributions."}
            </p>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function TreasuryBalance({
  deployment,
  owner,
}: {
  deployment: Deployment;
  owner: Address | undefined;
}) {
  const balance = useReadContract({
    chainId: deployment.chainId,
    address: deployment.token,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [owner ?? zeroAddress],
    query: { enabled: Boolean(owner) },
  });
  const decimals = useReadContract({
    chainId: deployment.chainId,
    address: deployment.token,
    abi: erc20Abi,
    functionName: "decimals",
  });
  return (
    <div className="activity-row">
      <div className="table-token">
        <i>{deployment.symbol.slice(0, 1)}</i>
      </div>
      <div>
        <strong>{deployment.name}</strong>
        <span>
          {deployment.chainId === 8453 ? "Base Mainnet" : "Base Sepolia"}
        </span>
      </div>
      <span>
        {balance.isPending || decimals.isPending
          ? "Loading…"
          : balance.isError || decimals.isError
            ? "RPC unavailable"
            : `${formatTokenAmount(balance.data ?? 0n, decimals.data ?? 18)} ${deployment.symbol}`}
      </span>
      <Link
        className="confirmed"
        href={`/studio/tokens/${deployment.chainId}/${deployment.token}`}
      >
        Manage
      </Link>
    </div>
  );
}
