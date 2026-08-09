"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Transaction,
  TransactionButton,
  TransactionStatus,
  TransactionStatusAction,
  TransactionStatusLabel,
  TransactionToast,
} from "@coinbase/onchainkit/transaction";
import type { TransactionResponseType } from "@coinbase/onchainkit/transaction";
import {
  decodeEventLog,
  erc20Abi,
  isAddress,
  pad,
  parseUnits,
  stringToHex,
  zeroAddress,
  type Address,
} from "viem";
import { useAccount, usePublicClient, useReadContract } from "wagmi";
import {
  chainForId,
  explorerAddressUrl,
  vestingFactoryAddress,
} from "@/lib/chains";
import {
  blocpodVestingWalletFactoryV1Abi,
  blocpodVestingWalletV1Abi,
} from "@blocpod/contracts";
import { shortAddress } from "@/lib/factory";
import { formatPercentage, formatTokenAmount } from "@/lib/amounts";
import { Icon } from "./icons";

const tabs = [
  "Overview",
  "Distribution",
  "Vesting",
  "Liquidity",
  "Activity",
] as const;
type Tab = (typeof tabs)[number];

export function TokenDashboard({
  chainId,
  tokenAddress,
}: {
  chainId: number;
  tokenAddress: string;
}) {
  const { address: connectedAddress } = useAccount();
  const [tab, setTab] = useState<Tab>("Overview");
  const [shareLabel, setShareLabel] = useState("Share");
  const [panel, setPanel] = useState<
    "distribution" | "vesting" | "liquidity"
  >();
  const network = chainForId(chainId);
  const safeAddress = isAddress(tokenAddress)
    ? (tokenAddress as Address)
    : "0x0000000000000000000000000000000000000000";
  const nameRead = useReadContract({
    chainId,
    address: safeAddress,
    abi: erc20Abi,
    functionName: "name",
    query: { retry: 2 },
  });
  const symbolRead = useReadContract({
    chainId,
    address: safeAddress,
    abi: erc20Abi,
    functionName: "symbol",
    query: { retry: 2 },
  });
  const supplyRead = useReadContract({
    chainId,
    address: safeAddress,
    abi: erc20Abi,
    functionName: "totalSupply",
    query: { retry: 2 },
  });
  const decimalsRead = useReadContract({
    chainId,
    address: safeAddress,
    abi: erc20Abi,
    functionName: "decimals",
    query: { retry: 2 },
  });
  const balanceRead = useReadContract({
    chainId,
    address: safeAddress,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [connectedAddress ?? zeroAddress],
    query: { enabled: Boolean(connectedAddress), retry: 2 },
  });
  const provenance = useQuery({
    queryKey: ["deployment", chainId, safeAddress],
    queryFn: async () => {
      const response = await fetch(
        `/api/deployments?chainId=${chainId}&limit=100`,
        { cache: "no-store" },
      );
      if (!response.ok) throw new Error("Deployment index is unavailable.");
      const payload = (await response.json()) as {
        deployments?: DeploymentSummary[];
        source?: string;
      };
      return {
        deployment: payload.deployments?.find(
          (item) => item.token.toLowerCase() === safeAddress.toLowerCase(),
        ),
        source: payload.source,
      };
    },
  });
  if (
    nameRead.isPending ||
    symbolRead.isPending ||
    supplyRead.isPending ||
    decimalsRead.isPending
  )
    return (
      <div className="empty-panel standalone">
        <div className="empty-icon">
          <Icon name="token" />
        </div>
        <h1>Reading token from Base…</h1>
        <p>
          Loading immutable supply and contract metadata directly from the
          selected network.
        </p>
      </div>
    );
  if (
    nameRead.isError ||
    symbolRead.isError ||
    supplyRead.isError ||
    decimalsRead.isError
  ) {
    return (
      <div className="empty-panel standalone">
        <h1>Token contract unavailable</h1>
        <p>
          This address did not return standard ERC-20 metadata on {network.name}
          . Check the address and network.
        </p>
      </div>
    );
  }
  const name = String(nameRead.data);
  const symbol = String(symbolRead.data ?? "TOKEN");
  const decimals = Number(decimalsRead.data ?? 18);
  const totalSupply = BigInt(supplyRead.data?.toString() ?? "0");
  const walletBalance =
    balanceRead.data === undefined
      ? undefined
      : BigInt(balanceRead.data.toString());
  const indexedDeployment = provenance.data?.deployment;
  const shareDashboard = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: `${name} (${symbol}) on Blocpod`, url: window.location.href });
      } else {
        await navigator.clipboard.writeText(window.location.href);
      }
      setShareLabel("Shared");
      window.setTimeout(() => setShareLabel("Share"), 2_000);
    } catch {
      setShareLabel("Not shared");
      window.setTimeout(() => setShareLabel("Share"), 2_000);
    }
  };
  return (
    <div className="page-stack token-dashboard">
      <Link className="back-link" href="/studio">
        ← All tokens
      </Link>
      <header className="token-header">
        <div className="token-avatar">{symbol.slice(0, 1)}</div>
        <div className="token-title">
          <span className="status-chip">
            <i /> Fixed supply contract
          </span>
          <h1>
            {name} <small>{symbol}</small>
          </h1>
          <div>
            <a
              className="mono"
              href={explorerAddressUrl(chainId, safeAddress)}
              target="_blank"
              rel="noreferrer"
            >
              {shortAddress(safeAddress, 8)} <Icon name="external" />
            </a>
            <span>·</span>
            <b>
              <i className={chainId === 8453 ? "base-dot" : "testnet-dot"} />
              {network.name}
            </b>
          </div>
        </div>
        <div className="token-header-actions">
          <button className="button secondary small" onClick={shareDashboard}>
            {shareLabel}
          </button>
          <button
            className="button primary small"
            onClick={() => setPanel("distribution")}
          >
            <Icon name="plus" /> New action
          </button>
        </div>
      </header>
      <nav className="token-tabs" aria-label="Token sections">
        {tabs.map((item) => (
          <button
            type="button"
            key={item}
            className={tab === item ? "active" : ""}
            onClick={() => setTab(item)}
          >
            {item}
          </button>
        ))}
      </nav>
      {provenance.isPending ? (
        <div className="data-source">Checking Blocpod factory provenance…</div>
      ) : null}
      {provenance.isError ||
      provenance.data?.source === "indexer_unavailable" ? (
        <div className="risk-banner">
          <Icon name="shield" />
          <div>
            <strong>Indexer unavailable</strong>
            <p>
              Contract facts below are live RPC reads. Factory provenance and
              activity cannot be confirmed right now.
            </p>
          </div>
        </div>
      ) : null}
      {!provenance.isPending && !provenance.isError && !indexedDeployment ? (
        <div className="risk-banner">
          <Icon name="shield" />
          <div>
            <strong>Unverified factory provenance</strong>
            <p>
              This ERC-20 is readable onchain but was not found in the Blocpod
              deployment index.
            </p>
          </div>
        </div>
      ) : null}
      {tab === "Overview" ? (
        <Overview
          onOpen={setPanel}
          address={safeAddress}
          chainId={chainId}
          symbol={symbol}
          totalSupply={totalSupply}
          decimals={decimals}
          walletBalance={walletBalance}
          deployment={indexedDeployment}
        />
      ) : null}
      {tab === "Distribution" ? (
        <DistributionModule
          onOpen={() => setPanel("distribution")}
          symbol={symbol}
          decimals={decimals}
          walletBalance={walletBalance}
        />
      ) : null}
      {tab === "Vesting" ? (
        <VestingModule onOpen={() => setPanel("vesting")} />
      ) : null}
      {tab === "Liquidity" ? (
        <LiquidityModule onOpen={() => setPanel("liquidity")} />
      ) : null}
      {tab === "Activity" ? <ActivityModule /> : null}
      {panel ? (
        <ManagementPanel
          kind={panel}
          onClose={() => setPanel(undefined)}
          token={safeAddress}
          chainId={chainId}
          symbol={symbol}
          decimals={decimals}
          walletBalance={walletBalance}
        />
      ) : null}
    </div>
  );
}

type DeploymentSummary = {
  chainId: number;
  transactionHash: HashString;
  blockNumber: string;
  creator: Address;
  token: Address;
  initialRecipient: Address;
  name: string;
  symbol: string;
  initialSupply: string;
  indexedAt: string;
};
type HashString = `0x${string}`;

function Overview({
  onOpen,
  address,
  chainId,
  symbol,
  totalSupply,
  decimals,
  walletBalance,
  deployment,
}: {
  onOpen: (panel: "distribution" | "vesting" | "liquidity") => void;
  address: Address;
  chainId: number;
  symbol: string;
  totalSupply: bigint;
  decimals: number;
  walletBalance: bigint | undefined;
  deployment: DeploymentSummary | undefined;
}) {
  const supplyLabel = formatTokenAmount(totalSupply, decimals);
  const balanceLabel =
    walletBalance === undefined
      ? "Connect wallet"
      : formatTokenAmount(walletBalance, decimals);
  return (
    <div className="dashboard-body">
      <div className="metric-row token-metrics">
        <article>
          <span>Total supply</span>
          <strong>
            {supplyLabel} <small>{symbol}</small>
          </strong>
          <small>
            <Icon name="shield" /> Live RPC read
          </small>
        </article>
        <article>
          <span>Your balance</span>
          <strong>{balanceLabel}</strong>
          <small>
            {walletBalance === undefined ? "Wallet not connected" : symbol}
          </small>
        </article>
        <article>
          <span>Factory provenance</span>
          <strong>{deployment ? "Verified" : "Unknown"}</strong>
          <small>
            {deployment
              ? `Factory event at block ${deployment.blockNumber}`
              : "Not in current index"}
          </small>
        </article>
        <article>
          <span>Vesting balances</span>
          <strong>—</strong>
          <small>No module index configured</small>
        </article>
      </div>
      <div className="dashboard-grid">
        <section className="panel supply-panel">
          <div className="panel-heading">
            <div>
              <span>Wallet position</span>
              <h2>Connected wallet balance</h2>
            </div>
          </div>
          <div className="supply-visual">
            <div className="donut">
              <span>
                {walletBalance === undefined
                  ? "—"
                  : formatPercentage(walletBalance, totalSupply)}
                <small>of supply</small>
              </span>
            </div>
            <div className="legend">
              <div>
                <i />
                <span>Connected wallet</span>
                <strong>{balanceLabel}</strong>
                <small>{symbol}</small>
              </div>
              <div>
                <i />
                <span>Total fixed supply</span>
                <strong>{supplyLabel}</strong>
                <small>{symbol}</small>
              </div>
              <div>
                <i />
                <span>Other holders</span>
                <strong>See explorer</strong>
                <small>live</small>
              </div>
            </div>
          </div>
          <div className="data-source">
            Balances read directly from {chainForId(chainId).name}. Holder
            counts require the indexer.
          </div>
        </section>
        <section className="panel contract-panel">
          <div className="panel-heading">
            <div>
              <span>Token contract</span>
              <h2>Observable properties</h2>
            </div>
            {deployment ? (
              <span className="verified-badge">
                <Icon name="check" /> Factory indexed
              </span>
            ) : null}
          </div>
          <dl>
            <div>
              <dt>Total supply</dt>
              <dd>
                {supplyLabel} {symbol}
              </dd>
            </div>
            <div>
              <dt>Decimals</dt>
              <dd>{decimals}</dd>
            </div>
            <div>
              <dt>Factory version</dt>
              <dd>{deployment ? "V1" : "Unverified"}</dd>
            </div>
            <div>
              <dt>Token address</dt>
              <dd className="mono">{shortAddress(address)}</dd>
            </div>
          </dl>
          <a
            href={explorerAddressUrl(chainId, address)}
            target="_blank"
            rel="noreferrer"
          >
            Inspect contract on explorer <Icon name="external" />
          </a>
        </section>
      </div>
      <section>
        <div className="subheading">
          <h2>Manage supply</h2>
          <span>
            External modules never change the token&apos;s core rules.
          </span>
        </div>
        <div className="module-grid">
          <ModuleCard
            icon="wallet"
            title="Distribute"
            copy="Send allocations to contributors, community members, or other wallets."
            action="Prepare distribution"
            onClick={() => onOpen("distribution")}
          />
          <ModuleCard
            icon="shield"
            title="Create linear vesting"
            copy="Lock tokens in transparent, non-revocable linear release schedules."
            action="Build a schedule"
            onClick={() => onOpen("vesting")}
          />
          <ModuleCard
            icon="spark"
            title="Plan liquidity"
            copy="Review market risks, then continue to a vetted external venue."
            action="Review liquidity"
            onClick={() => onOpen("liquidity")}
          />
        </div>
      </section>
      {deployment ? (
        <section className="panel activity-preview">
          <div className="panel-heading">
            <div>
              <span>Indexed provenance</span>
              <h2>Factory deployment</h2>
            </div>
          </div>
          <div className="activity-row">
            <div className="activity-icon">
              <Icon name="check" />
            </div>
            <div>
              <strong>Token deployed</strong>
              <span>
                Supply minted to {shortAddress(deployment.initialRecipient)}
              </span>
            </div>
            <time>Block {deployment.blockNumber}</time>
            <span className="confirmed">Indexed</span>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function ModuleCard({
  icon,
  title,
  copy,
  action,
  onClick,
}: {
  icon: "wallet" | "shield" | "spark";
  title: string;
  copy: string;
  action: string;
  onClick: () => void;
}) {
  return (
    <article className="module-card">
      <span>
        <Icon name={icon} />
      </span>
      <h3>{title}</h3>
      <p>{copy}</p>
      <button type="button" onClick={onClick}>
        {action} <Icon name="arrow" />
      </button>
    </article>
  );
}

function DistributionModule({
  onOpen,
  symbol,
  decimals,
  walletBalance,
}: {
  onOpen: () => void;
  symbol: string;
  decimals: number;
  walletBalance: bigint | undefined;
}) {
  return (
    <section className="module-page">
      <div className="module-hero">
        <div>
          <span className="page-eyebrow">Distribution</span>
          <h2>Move supply with a clear record.</h2>
          <p>
            Prepare manual allocations, validate every recipient, and review
            the exact batch before signing.
          </p>
        </div>
        <button className="button primary small" onClick={onOpen}>
          <Icon name="plus" /> Prepare distribution
        </button>
      </div>
      <div className="metric-row">
        <article>
          <span>Transfer history</span>
          <strong>—</strong>
          <small>Activity index unavailable</small>
        </article>
        <article>
          <span>Indexed recipients</span>
          <strong>—</strong>
          <small>Requires transfer index</small>
        </article>
        <article>
          <span>Wallet balance</span>
          <strong>
            {walletBalance === undefined
              ? "—"
              : formatTokenAmount(walletBalance, decimals)}
          </strong>
          <small>
            {walletBalance === undefined ? "Connect wallet to load" : symbol}
          </small>
        </article>
      </div>
      <div className="empty-panel">
        <div className="empty-icon">
          <Icon name="wallet" />
        </div>
        <h2>Distribution history is not indexed</h2>
        <p>
          Prepare a new manual batch here. Use the block explorer for existing
          transfer history; duplicate addresses and totals are checked before
          review.
        </p>
        <button className="button secondary small" onClick={onOpen}>
          Create first batch
        </button>
      </div>
    </section>
  );
}

function VestingModule({ onOpen }: { onOpen: () => void }) {
  return (
    <section className="module-page">
      <div className="module-hero">
        <div>
          <span className="page-eyebrow">Linear vesting</span>
          <h2>Make unlocks predictable.</h2>
          <p>
            Create external, transparent linear schedules without adding control
            or mint authority to the token itself.
          </p>
        </div>
        <button className="button primary small" onClick={onOpen}>
          <Icon name="plus" /> Create schedule
        </button>
      </div>
      <div className="vesting-explainer">
        <div className="timeline">
          <i />
          <i />
          <i />
          <span className="now">Start</span>
          <span className="cliff">Linear release</span>
          <span className="end">Fully vested</span>
        </div>
        <div>
          <strong>Independent module</strong>
          <p>
            Tokens move into a separate, non-revocable vesting wallet and
            release continuously to its immutable beneficiary.
          </p>
        </div>
      </div>
      <div className="empty-panel">
        <div className="empty-icon">
          <Icon name="shield" />
        </div>
        <h2>Vesting history is not indexed</h2>
        <p>
          Create a new schedule or release from a known vesting wallet. Use the
          explorer for existing schedules; deployment and funding are reviewed
          as separate actions.
        </p>
        <button className="button secondary small" onClick={onOpen}>
          Build a linear schedule
        </button>
      </div>
    </section>
  );
}

function LiquidityModule({ onOpen }: { onOpen: () => void }) {
  return (
    <section className="module-page">
      <div className="module-hero">
        <div>
          <span className="page-eyebrow">Liquidity</span>
          <h2>Plan the market before funding it.</h2>
          <p>
            Liquidity is optional and external. Blocpod does not promise a
            market, set a price, or custody positions.
          </p>
        </div>
        <button className="button primary small" onClick={onOpen}>
          Start readiness check
        </button>
      </div>
      <div className="risk-banner">
        <Icon name="shield" />
        <div>
          <strong>Liquidity changes the risk profile</strong>
          <p>
            Deposited tokens and paired assets may experience impermanent loss,
            price impact, or smart contract risk. Use only supported audited
            integrations.
          </p>
        </div>
      </div>
      <div className="readiness-grid">
        {[
          [
            "01",
            "Choose a trusted venue",
            "Compare supported Base pools and fee tiers.",
          ],
          [
            "02",
            "Set the initial ratio",
            "Your deposit ratio establishes the opening price.",
          ],
          [
            "03",
            "Review position risk",
            "Understand ranges, slippage, and withdrawal control.",
          ],
          [
            "04",
            "Sign at the venue",
            "Blocpod prepares context; your wallet remains in control.",
          ],
        ].map(([n, title, copy]) => (
          <article key={n}>
            <span>{n}</span>
            <h3>{title}</h3>
            <p>{copy}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function ActivityModule() {
  return (
    <section className="empty-panel">
      <div className="empty-icon">
        <Icon name="spark" />
      </div>
      <h2>Activity index not connected</h2>
      <p>
        Blocpod will show confirmed factory, transfer, vesting, and liquidity
        events here when the activity index is available. Use the explorer for
        the authoritative history now.
      </p>
    </section>
  );
}

function ManagementPanel({
  kind,
  onClose,
  token,
  chainId,
  symbol,
  decimals,
  walletBalance,
}: {
  kind: "distribution" | "vesting" | "liquidity";
  onClose: () => void;
  token: Address;
  chainId: number;
  symbol: string;
  decimals: number;
  walletBalance: bigint | undefined;
}) {
  const { address: managerAddress, chainId: connectedChainId } = useAccount();
  const publicClient = usePublicClient({ chainId });
  const [allocations, setAllocations] = useState([
    { recipient: "", amount: "" },
  ]);
  const [distributionReview, setDistributionReview] = useState(false);
  const [distributionCreator, setDistributionCreator] = useState<Address>();
  const [distributionMainnetConfirmed, setDistributionMainnetConfirmed] =
    useState(false);
  const [beneficiary, setBeneficiary] = useState("");
  const [vestingAmount, setVestingAmount] = useState("");
  const [vestingStart, setVestingStart] = useState("");
  const [vestingDuration, setVestingDuration] = useState("1095");
  const [vestingError, setVestingError] = useState<string>();
  const [vestingMainnetConfirmed, setVestingMainnetConfirmed] = useState(false);
  const [vestingPrepared, setVestingPrepared] = useState<{
    address: Address;
    factory: Address;
    start: bigint;
    duration: bigint;
    salt: `0x${string}`;
    amount: bigint;
    creator: Address;
    chainId: number;
    beneficiary: Address;
    simulatedAt: number;
  }>();
  const [deployedVesting, setDeployedVesting] = useState<Address>();
  const [claimAddress, setClaimAddress] = useState("");
  const [liquidityChecks, setLiquidityChecks] = useState([false, false, false]);
  const parsedAllocations = allocations.flatMap((allocation) => {
    if (!isAddress(allocation.recipient)) return [];
    try {
      const amount = parseUnits(allocation.amount, decimals);
      return amount > 0n
        ? [{ recipient: allocation.recipient as Address, amount }]
        : [];
    } catch {
      return [];
    }
  });
  const distributionTotal = parsedAllocations.reduce(
    (total, allocation) => total + allocation.amount,
    0n,
  );
  const distributionValid =
    parsedAllocations.length === allocations.length &&
    allocations.length > 0 &&
    new Set(
      parsedAllocations.map((allocation) => allocation.recipient.toLowerCase()),
    ).size === parsedAllocations.length &&
    walletBalance !== undefined &&
    distributionTotal <= walletBalance;
  const distributionCalls = async () => {
    if (
      !managerAddress ||
      !distributionCreator ||
      managerAddress.toLowerCase() !== distributionCreator.toLowerCase() ||
      connectedChainId !== chainId ||
      !publicClient
    )
      throw new Error(
        "Wallet or network changed after review. Review the distribution again.",
      );
    if (chainId === 8453 && !distributionMainnetConfirmed)
      throw new Error("Confirm the Base Mainnet distribution before signing.");
    const freshBalance = await publicClient.readContract({
      address: token,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [distributionCreator],
    });
    if (distributionTotal > freshBalance)
      throw new Error(
        "The reviewed wallet balance changed. Review the distribution again.",
      );
    await Promise.all(
      parsedAllocations.map((allocation) =>
        publicClient.simulateContract({
          account: distributionCreator,
          address: token,
          abi: erc20Abi,
          functionName: "transfer",
          args: [allocation.recipient, allocation.amount],
        }),
      ),
    );
    return parsedAllocations.map((allocation) => ({
      address: token,
      abi: erc20Abi,
      functionName: "transfer" as const,
      args: [allocation.recipient, allocation.amount] as const,
    }));
  };
  const prepareVesting = async () => {
    const factory = vestingFactoryAddress(chainId);
    if (!factory || !managerAddress || !publicClient) {
      setVestingError(
        "Connect a wallet and configure the versioned vesting factory for this network.",
      );
      return;
    }
    if (!isAddress(beneficiary) || !vestingStart) {
      setVestingError("Enter a valid beneficiary and start time.");
      return;
    }
    try {
      const amount = parseUnits(vestingAmount, decimals);
      if (
        amount <= 0n ||
        (walletBalance !== undefined && amount > walletBalance)
      )
        throw new Error("Funding amount exceeds the connected wallet balance.");
      const start = BigInt(
        Math.floor(new Date(vestingStart).getTime() / 1_000),
      );
      const duration = BigInt(vestingDuration) * 24n * 60n * 60n;
      const salt = pad(stringToHex(crypto.randomUUID()), { size: 32 });
      const address = await publicClient.readContract({
        address: factory,
        abi: blocpodVestingWalletFactoryV1Abi,
        functionName: "predictVestingWalletAddress",
        args: [managerAddress, beneficiary, start, duration, salt],
      });
      await publicClient.simulateContract({
        account: managerAddress,
        address: factory,
        abi: blocpodVestingWalletFactoryV1Abi,
        functionName: "deployVestingWallet",
        args: [beneficiary, start, duration, salt],
      });
      setVestingPrepared({
        address,
        factory,
        start,
        duration,
        salt,
        amount,
        creator: managerAddress,
        chainId,
        beneficiary,
        simulatedAt: Date.now(),
      });
      setVestingMainnetConfirmed(false);
      setVestingError(undefined);
    } catch (error) {
      setVestingError(
        error instanceof Error ? error.message : "Vesting simulation failed.",
      );
    }
  };
  const assertVestingBinding = () => {
    if (!vestingPrepared || !managerAddress || !publicClient)
      throw new Error("Prepare the vesting schedule again.");
    if (
      vestingPrepared.chainId !== chainId ||
      connectedChainId !== chainId ||
      vestingPrepared.creator.toLowerCase() !== managerAddress.toLowerCase() ||
      vestingPrepared.factory.toLowerCase() !==
        vestingFactoryAddress(chainId)?.toLowerCase() ||
      vestingPrepared.beneficiary.toLowerCase() !== beneficiary.toLowerCase()
    )
      throw new Error(
        "Wallet, network, factory, or beneficiary changed after review. Prepare the schedule again.",
      );
    if (chainId === 8453 && !vestingMainnetConfirmed)
      throw new Error("Confirm the Base Mainnet vesting action before signing.");
    return { prepared: vestingPrepared, client: publicClient };
  };
  const vestingDeploymentCalls = async () => {
    const { prepared, client } = assertVestingBinding();
    await client.simulateContract({
      account: prepared.creator,
      address: prepared.factory,
      abi: blocpodVestingWalletFactoryV1Abi,
      functionName: "deployVestingWallet",
      args: [
        prepared.beneficiary,
        prepared.start,
        prepared.duration,
        prepared.salt,
      ],
    });
    return [
      {
        address: prepared.factory,
        abi: blocpodVestingWalletFactoryV1Abi,
        functionName: "deployVestingWallet" as const,
        args: [
          prepared.beneficiary,
          prepared.start,
          prepared.duration,
          prepared.salt,
        ] as const,
      },
    ];
  };
  const vestingFundingCalls = async () => {
    const { prepared, client } = assertVestingBinding();
    if (!deployedVesting || deployedVesting !== prepared.address)
      throw new Error("The verified vesting wallet is unavailable.");
    await client.simulateContract({
      account: prepared.creator,
      address: token,
      abi: erc20Abi,
      functionName: "transfer",
      args: [deployedVesting, prepared.amount],
    });
    return [
      {
        address: token,
        abi: erc20Abi,
        functionName: "transfer" as const,
        args: [deployedVesting, prepared.amount] as const,
      },
    ];
  };
  const verifyVestingDeployment = (response: TransactionResponseType) => {
    if (!vestingPrepared || !managerAddress) return;
    for (const receipt of response.transactionReceipts)
      for (const log of receipt.logs) {
        if (log.address.toLowerCase() !== vestingPrepared.factory.toLowerCase())
          continue;
        try {
          const event = decodeEventLog({
            abi: blocpodVestingWalletFactoryV1Abi,
            data: log.data,
            topics: log.topics,
          });
          if (
            event.eventName === "VestingWalletDeployed" &&
            event.args.creator.toLowerCase() === managerAddress.toLowerCase() &&
            event.args.vestingWallet.toLowerCase() ===
              vestingPrepared.address.toLowerCase() &&
            event.args.beneficiary.toLowerCase() ===
              beneficiary.toLowerCase() &&
            event.args.startTimestamp === vestingPrepared.start &&
            event.args.durationSeconds === vestingPrepared.duration &&
            event.args.userSalt === vestingPrepared.salt
          ) {
            setDeployedVesting(event.args.vestingWallet);
            return;
          }
        } catch {
          /* Ignore unrelated logs. */
        }
      }
    setVestingError(
      "The vesting deployment receipt did not match the reviewed schedule.",
    );
  };
  const content = {
    distribution: {
      title: "Prepare distribution",
      intro:
        "Add recipients and amounts. Nothing moves until the complete batch is reviewed and signed.",
      action: "Review 2 transfers",
    },
    vesting: {
      title: "Build a linear vesting schedule",
      intro:
        "Define one transparent, non-revocable linear release schedule for an immutable beneficiary.",
      action: "Review schedule",
    },
    liquidity: {
      title: "Liquidity readiness",
      intro:
        "Confirm you understand how a starting ratio creates a market price.",
      action: "Continue to supported venue",
    },
  }[kind];
  return (
    <div className="sheet-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="action-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sheet-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <span className="page-eyebrow">External module</span>
            <h2 id="sheet-title">{content.title}</h2>
            <p>{content.intro}</p>
          </div>
          <button onClick={onClose} aria-label="Close panel">
            ×
          </button>
        </header>
        {kind === "distribution" ? (
          <div className="allocation-list">
            {distributionReview ? (
              <div className="simulation-ok">
                <Icon name="shield" />
                <div>
                  <strong>Review direct wallet transfers</strong>
                  <span>
                    {parsedAllocations.length} transfer
                    {parsedAllocations.length === 1 ? "" : "s"} totaling{" "}
                    {formatTokenAmount(distributionTotal, decimals)} {symbol}.
                    No allowance is granted.
                    Legacy wallets may execute these as separate transactions,
                    so an earlier transfer can confirm if a later one fails.
                  </span>
                </div>
              </div>
            ) : null}
            <div className="allocation-head">
              <span>Recipient</span>
              <span>Amount</span>
            </div>
            {allocations.map((allocation, index) => (
              <label key={index}>
                <input
                  aria-label={`Recipient ${index + 1}`}
                  value={allocation.recipient}
                  onChange={(event) => {
                    setDistributionReview(false);
                    setDistributionCreator(undefined);
                    setDistributionMainnetConfirmed(false);
                    setAllocations((current) =>
                      current.map((item, itemIndex) =>
                        itemIndex === index
                          ? { ...item, recipient: event.target.value }
                          : item,
                      ),
                    );
                  }}
                  placeholder="0x recipient address"
                />
                <span>
                  <input
                    aria-label={`Amount ${index + 1}`}
                    value={allocation.amount}
                    onChange={(event) => {
                      setDistributionReview(false);
                      setDistributionCreator(undefined);
                      setDistributionMainnetConfirmed(false);
                      setAllocations((current) =>
                        current.map((item, itemIndex) =>
                          itemIndex === index
                            ? { ...item, amount: event.target.value }
                            : item,
                        ),
                      );
                    }}
                    placeholder="100000"
                  />
                  <b>{symbol}</b>
                </span>
              </label>
            ))}
            <button
              type="button"
              disabled={allocations.length >= 20}
              onClick={() => {
                setDistributionReview(false);
                setDistributionCreator(undefined);
                setDistributionMainnetConfirmed(false);
                setAllocations((current) => [
                  ...current,
                  { recipient: "", amount: "" },
                ]);
              }}
            >
              <Icon name="plus" /> Add recipient
            </button>
            <div className="data-source">
              Available:{" "}
              {walletBalance === undefined
                ? "Connect wallet"
                : `${formatTokenAmount(walletBalance, decimals)} ${symbol}`}{" "}
              · Maximum 20 direct transfers.
            </div>
            {allocations.length > 0 && !distributionValid ? (
              <div className="error-callout">
                <strong>Distribution is not ready</strong>
                <span>
                  Every recipient must be valid and unique, every amount must
                  be positive, and the total cannot exceed the connected wallet
                  balance.
                </span>
              </div>
            ) : null}
            {distributionReview && chainId === 8453 ? (
              <label className="mainnet-confirm">
                <input
                  type="checkbox"
                  checked={distributionMainnetConfirmed}
                  onChange={(event) =>
                    setDistributionMainnetConfirmed(event.target.checked)
                  }
                />
                <span>
                  I confirm these transfers use real tokens on Base Mainnet
                  from the reviewed wallet.
                </span>
              </label>
            ) : null}
          </div>
        ) : null}
        {kind === "vesting" ? (
          <div className="sheet-fields">
            <label>
              Beneficiary
              <input
                value={beneficiary}
                onChange={(event) => {
                  setBeneficiary(event.target.value);
                  setVestingPrepared(undefined);
                  setVestingMainnetConfirmed(false);
                }}
                placeholder="0x beneficiary address"
              />
            </label>
            <div>
              <label>
                Amount to fund
                <input
                  value={vestingAmount}
                  onChange={(event) => {
                    setVestingAmount(event.target.value);
                    setVestingPrepared(undefined);
                    setDeployedVesting(undefined);
                    setVestingMainnetConfirmed(false);
                  }}
                  placeholder={`250000 ${symbol}`}
                />
              </label>
              <label>
                Release model
                <input value="Continuous linear" readOnly />
              </label>
            </div>
            <div>
              <label>
                Start date
                <input
                  type="datetime-local"
                  value={vestingStart}
                  onChange={(event) => {
                    setVestingStart(event.target.value);
                    setVestingPrepared(undefined);
                    setDeployedVesting(undefined);
                    setVestingMainnetConfirmed(false);
                  }}
                />
              </label>
              <label>
                Duration
                <select
                  value={vestingDuration}
                  onChange={(event) => {
                    setVestingDuration(event.target.value);
                    setVestingPrepared(undefined);
                    setDeployedVesting(undefined);
                    setVestingMainnetConfirmed(false);
                  }}
                >
                  <option value="730">2 years (730 days)</option>
                  <option value="1095">3 years (1,095 days)</option>
                  <option value="1460">4 years (1,460 days)</option>
                </select>
              </label>
            </div>
            <div className="simulation-ok">
              <Icon name="shield" />
              <div>
                <strong>Non-revocable and linear</strong>
                <span>
                  The beneficiary is immutable. There is no cliff and no
                  recovery authority.
                </span>
              </div>
            </div>
            {vestingPrepared ? (
              <div className="simulation-ok">
                <Icon name="check" />
                <div>
                  <strong>Deployment simulation passed</strong>
                  <span>
                    Predicted wallet {shortAddress(vestingPrepared.address, 7)}.
                    Deploy first; funding is a separate reviewed transfer.
                  </span>
                </div>
              </div>
            ) : null}
            {vestingPrepared && chainId === 8453 ? (
              <label className="mainnet-confirm">
                <input
                  type="checkbox"
                  checked={vestingMainnetConfirmed}
                  onChange={(event) =>
                    setVestingMainnetConfirmed(event.target.checked)
                  }
                />
                <span>
                  I confirm this deploys and may fund a non-revocable vesting
                  wallet on Base Mainnet using real funds.
                </span>
              </label>
            ) : null}
            {deployedVesting ? (
              <div className="simulation-ok">
                <Icon name="check" />
                <div>
                  <strong>Vesting wallet deployed and verified</strong>
                  <span>
                    Now fund {shortAddress(deployedVesting, 7)} with{" "}
                    {formatTokenAmount(vestingPrepared?.amount ?? 0n, decimals)}{" "}
                    {symbol}.
                  </span>
                </div>
              </div>
            ) : null}
            {vestingError ? (
              <div className="error-callout">
                <strong>Vesting action unavailable</strong>
                <span>{vestingError}</span>
              </div>
            ) : null}
            <div className="upload-row">
              <span>Beneficiary release</span>
              <input
                className="mono"
                value={claimAddress}
                onChange={(event) => setClaimAddress(event.target.value)}
                placeholder="Existing vesting wallet address"
              />
              <small>
                Anyone may trigger release, but vested tokens always go to the
                immutable beneficiary.
              </small>
              {isAddress(claimAddress) ? (
                <Transaction
                  chainId={chainId}
                  calls={[
                    {
                      address: claimAddress,
                      abi: blocpodVestingWalletV1Abi,
                      functionName: "release",
                      args: [token],
                    },
                  ]}
                >
                  <TransactionButton
                    className="button secondary transaction-button"
                    text={`Release vested ${symbol}`}
                  />
                  <TransactionStatus>
                    <TransactionStatusLabel />
                    <TransactionStatusAction />
                  </TransactionStatus>
                  <TransactionToast position="bottom-right" />
                </Transaction>
              ) : null}
            </div>
          </div>
        ) : null}
        {kind === "liquidity" ? (
          <div className="check-list">
            {[
              "I understand liquidity does not guarantee buyers or price stability.",
              "I understand the deposit ratio establishes an opening price.",
              "I will verify the venue, fee tier, and position permissions before signing.",
            ].map((label, index) => (
              <label key={label}>
                <input
                  type="checkbox"
                  checked={liquidityChecks[index]}
                  onChange={(event) =>
                    setLiquidityChecks((current) =>
                      current.map((value, itemIndex) =>
                        itemIndex === index ? event.target.checked : value,
                      ),
                    )
                  }
                />
                <span>{label}</span>
              </label>
            ))}
            <div className="risk-banner">
              <Icon name="shield" />
              <p>
                Blocpod does not execute liquidity deposits in V1. Continue only
                through a vetted external Base venue and review every approval
                there.
              </p>
            </div>
          </div>
        ) : null}
        <footer>
          <button className="button ghost" onClick={onClose}>
            Cancel
          </button>
          {kind === "distribution" && !distributionReview ? (
            <button
              className="button primary"
              disabled={!distributionValid || !managerAddress}
              onClick={() => {
                setDistributionCreator(managerAddress);
                setDistributionMainnetConfirmed(false);
                setDistributionReview(true);
              }}
            >
              Review {parsedAllocations.length} transfer
              {parsedAllocations.length === 1 ? "" : "s"} <Icon name="arrow" />
            </button>
          ) : null}
          {kind === "distribution" && distributionReview ? (
            <Transaction
              calls={distributionCalls}
              chainId={chainId}
              onSuccess={onClose}
            >
              <TransactionButton
                className="button primary transaction-button"
                text={`Send ${formatTokenAmount(distributionTotal, decimals)} ${symbol}`}
                disabled={chainId === 8453 && !distributionMainnetConfirmed}
              />
              <TransactionStatus>
                <TransactionStatusLabel />
                <TransactionStatusAction />
              </TransactionStatus>
              <TransactionToast position="bottom-right" />
            </Transaction>
          ) : null}
          {kind === "liquidity" ? (
            liquidityChecks.every(Boolean) ? (
              <a
                className="button primary"
                href="https://app.uniswap.org"
                target="_blank"
                rel="noreferrer"
              >
                Open vetted venue <Icon name="external" />
              </a>
            ) : (
              <button className="button primary" disabled>
                Complete all acknowledgements
              </button>
            )
          ) : kind === "vesting" && !vestingPrepared ? (
            <button className="button primary" onClick={prepareVesting}>
              Simulate schedule <Icon name="spark" />
            </button>
          ) : kind === "vesting" && vestingPrepared && !deployedVesting ? (
            <Transaction
              chainId={chainId}
              calls={vestingDeploymentCalls}
              onSuccess={verifyVestingDeployment}
            >
              <TransactionButton
                className="button primary transaction-button"
                text="Deploy vesting wallet"
                disabled={chainId === 8453 && !vestingMainnetConfirmed}
              />
              <TransactionStatus>
                <TransactionStatusLabel />
                <TransactionStatusAction />
              </TransactionStatus>
              <TransactionToast position="bottom-right" />
            </Transaction>
          ) : kind === "vesting" && vestingPrepared && deployedVesting ? (
            <Transaction
              chainId={chainId}
              calls={vestingFundingCalls}
              onSuccess={onClose}
            >
              <TransactionButton
                className="button primary transaction-button"
                text={`Fund ${formatTokenAmount(vestingPrepared.amount, decimals)} ${symbol}`}
              />
              <TransactionStatus>
                <TransactionStatusLabel />
                <TransactionStatusAction />
              </TransactionStatus>
              <TransactionToast position="bottom-right" />
            </Transaction>
          ) : null}
        </footer>
      </section>
    </div>
  );
}
