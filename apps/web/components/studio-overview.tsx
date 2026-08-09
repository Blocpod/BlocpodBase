"use client";

import { useQuery } from "@tanstack/react-query";
import Image from "next/image";
import Link from "next/link";
import { useAccount } from "wagmi";
import type { Address } from "viem";
import { Icon } from "./icons";
import { formatTokenAmount } from "@/lib/amounts";
import { factoryAddress } from "@/lib/chains";

type Deployment = {
  chainId: 8453 | 84532;
  token: Address;
  name: string;
  symbol: string;
  initialSupply: string;
  blockNumber: string;
};

export function StudioOverview() {
  const { address } = useAccount();
  const isSepoliaConfigured = Boolean(factoryAddress(84532));
  const deployments = useQuery({
    queryKey: ["creator-deployments", address],
    enabled: Boolean(address),
    queryFn: async () => {
      const results = await Promise.all(
        [84532, 8453].map(async (chainId) => {
          const response = await fetch(
            `/api/deployments?chainId=${chainId}&creator=${address}&limit=100`,
            { cache: "no-store" },
          );
          if (!response.ok) throw new Error("Deployment index unavailable");
          const payload = (await response.json()) as {
            deployments: Deployment[];
            source?: string;
          };
          if (payload.source === "indexer_unavailable")
            throw new Error("Deployment index unavailable");
          return payload.deployments;
        }),
      );
      return results.flat();
    },
  });
  const activeNetworks = new Set(
    deployments.data?.map((deployment) => deployment.chainId) ?? [],
  ).size;
  return (
    <div className="page-stack">
      <div className="page-title">
        <div>
          <span className="page-eyebrow">Token studio</span>
          <h1>Good morning.</h1>
          <p>Your launch workspace is ready.</p>
        </div>
        <Link className="button primary small" href="/studio/create">
          <Icon name="plus" /> Create token
        </Link>
      </div>
      <section className="overview-banner">
        <div>
          <span className="status-chip">
            <i />
            {isSepoliaConfigured
              ? "Base Sepolia ready"
              : "Base Sepolia configuration required"}
          </span>
          <h2>
            {isSepoliaConfigured
              ? "Start with a test deployment"
              : "Configure the testnet factory"}
          </h2>
          <p>
            {isSepoliaConfigured
              ? "Deploy on Sepolia to validate your name, supply, recipient, and workflow before using real funds."
              : "Set the verified Base Sepolia factory address in the deployment environment before token creation is available."}
          </p>
          {isSepoliaConfigured ? (
            <Link href="/studio/create">
              Create on testnet <Icon name="arrow" />
            </Link>
          ) : (
            <Link href="/studio/settings">
              View configuration status <Icon name="arrow" />
            </Link>
          )}
        </div>
        <div className="banner-orb" aria-hidden="true">
          <Image src="/blocpod-mark.svg" alt="" width={130} height={203} />
        </div>
      </section>
      <div className="metric-row">
        <article>
          <span>Indexed tokens</span>
          <strong>
            {!address || deployments.isPending
              ? "—"
              : (deployments.data?.length ?? 0)}
          </strong>
          <small>
            {!address
              ? "Connect wallet to load"
              : deployments.isError
                ? "Indexer unavailable"
                : "Across Base networks"}
          </small>
        </article>
        <article>
          <span>Active networks</span>
          <strong>{deployments.data ? activeNetworks : "—"}</strong>
          <small>Networks with indexed deployments</small>
        </article>
        <article>
          <span>Pending actions</span>
          <strong>—</strong>
          <small>Transaction activity is device-local</small>
        </article>
      </div>
      <section>
        <div className="subheading">
          <h2>Your indexed tokens</h2>
          <span>Verified factory deployments only.</span>
        </div>
        {deployments.data && deployments.data.length > 0 ? (
          <div className="quick-grid">
            {deployments.data.slice(0, 6).map((deployment) => (
              <Link
                href={`/studio/tokens/${deployment.chainId}/${deployment.token}`}
                key={`${deployment.chainId}:${deployment.token}`}
              >
                <span className="quick-icon">
                  {deployment.symbol.slice(0, 1)}
                </span>
                <h3>{deployment.name}</h3>
                <p>
                  {formatTokenAmount(BigInt(deployment.initialSupply), 18)}{" "}
                  {deployment.symbol} ·{" "}
                  {deployment.chainId === 8453 ? "Base" : "Sepolia"}
                </p>
                <Icon className="quick-arrow" name="arrow" />
              </Link>
            ))}
          </div>
        ) : (
          <div className="empty-panel">
            <div className="empty-icon">
              <Icon name="token" />
            </div>
            <h2>
              {deployments.isError
                ? "Deployment index unavailable"
                : "No indexed tokens found"}
            </h2>
            <p>
              {address
                ? "Create your first token or wait for a recent confirmed deployment to be indexed."
                : "Connect the wallet you used to deploy, or create your first token with Blocpod."}
            </p>
            <Link className="button secondary small" href="/explore">
              Browse verified deployments
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
