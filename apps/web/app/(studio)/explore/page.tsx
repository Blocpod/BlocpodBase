"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import type { Address } from "viem";
import { Icon } from "@/components/icons";
import { formatTokenAmount } from "@/lib/amounts";

type Deployment = {
  chainId: 8453 | 84532;
  token: Address;
  name: string;
  symbol: string;
  initialSupply: string;
  blockNumber: string;
  indexedAt: string;
};

export default function ExplorePage() {
  const [chainId, setChainId] = useState<8453 | 84532>(84532);
  const [query, setQuery] = useState("");
  const deployments = useQuery({
    queryKey: ["deployments", chainId],
    queryFn: async () => {
      const response = await fetch(
        `/api/deployments?chainId=${chainId}&limit=100`,
        { cache: "no-store" },
      );
      if (!response.ok) throw new Error("Deployment index is unavailable.");
      return (await response.json()) as {
        deployments: Deployment[];
        source?: string;
      };
    },
  });
  const normalizedQuery = query.trim().toLowerCase();
  const visible =
    deployments.data?.deployments.filter(
      (item) =>
        !normalizedQuery ||
        item.name.toLowerCase().includes(normalizedQuery) ||
        item.symbol.toLowerCase().includes(normalizedQuery) ||
        item.token.toLowerCase().includes(normalizedQuery),
    ) ?? [];
  return (
    <div className="page-stack">
      <div className="page-title">
        <div>
          <span className="page-eyebrow">Verified provenance</span>
          <h1>Explore deployments</h1>
          <p>Tokens emitted by versioned Blocpod factories on Base.</p>
        </div>
        <Link className="button primary small" href="/studio/create">
          <Icon name="plus" /> Create token
        </Link>
      </div>
      <div className="explore-toolbar">
        <label>
          <span className="sr-only">Search tokens</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search name, symbol, or contract"
          />
        </label>
        <div>
          <button
            className={chainId === 84532 ? "active" : ""}
            onClick={() => setChainId(84532)}
          >
            Sepolia
          </button>
          <button
            className={chainId === 8453 ? "active" : ""}
            onClick={() => setChainId(8453)}
          >
            Base
          </button>
        </div>
      </div>
      <section className="deployment-table">
        <div className="table-head">
          <span>Token</span>
          <span>Network</span>
          <span>Supply</span>
          <span>Indexed</span>
          <span />
        </div>
        {deployments.isPending ? (
          <div className="table-empty">
            <Icon name="spark" />
            <p>Loading indexed deployments…</p>
          </div>
        ) : null}
        {deployments.isError ||
        deployments.data?.source === "indexer_unavailable" ? (
          <div className="table-empty">
            <Icon name="shield" />
            <p>
              The deployment index is unavailable. No unverified results are
              shown.
            </p>
          </div>
        ) : null}
        {!deployments.isPending &&
          !deployments.isError &&
          visible.map((item) => (
            <Link
              key={`${item.chainId}:${item.token}`}
              href={`/studio/tokens/${item.chainId}/${item.token}`}
            >
              <span className="table-token">
                <i>{item.symbol.slice(0, 1)}</i>
                <b>
                  {item.name}
                  <small>{item.symbol}</small>
                </b>
              </span>
              <span>
                <i
                  className={item.chainId === 8453 ? "base-dot" : "testnet-dot"}
                />{" "}
                {item.chainId === 8453 ? "Base Mainnet" : "Base Sepolia"}
              </span>
              <span>
                {formatTokenAmount(BigInt(item.initialSupply), 18)}{" "}
                {item.symbol}
              </span>
              <span>
                {new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(
                  new Date(item.indexedAt),
                )}
              </span>
              <Icon name="arrow" />
            </Link>
          ))}
        {!deployments.isPending &&
        !deployments.isError &&
        visible.length === 0 ? (
          <div className="table-empty">
            <Icon name="shield" />
            <p>
              {query
                ? "No indexed deployments match this search."
                : "No verified deployments are indexed on this network yet."}
            </p>
          </div>
        ) : null}
      </section>
    </div>
  );
}
