"use client";

import {
  Transaction,
  TransactionButton,
  TransactionSponsor,
  TransactionStatus,
  TransactionStatusAction,
  TransactionStatusLabel,
  TransactionToast,
} from "@coinbase/onchainkit/transaction";
import type { TransactionResponseType } from "@coinbase/onchainkit/transaction";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  decodeEventLog,
  encodeAbiParameters,
  encodeFunctionData,
  isAddress,
  isHex,
  keccak256,
  stringToHex,
  type Address,
  type Hash,
  type Hex,
} from "viem";
import { useAccount, useSignMessage, useSwitchChain } from "wagmi";
import { base, baseSepolia } from "wagmi/chains";
import {
  baseTokenFactoryAbi,
  shortAddress,
  validateTokenDraft,
  type TokenDraft,
  type ValidTokenDraft,
} from "@/lib/factory";
import { chainForId, explorerAddressUrl, factoryAddress } from "@/lib/chains";
import { formatSupplyPreview } from "@/lib/amounts";
import { Icon } from "./icons";

type PreparedIntent = {
  token: ValidTokenDraft;
  predictedAddress: Address;
  factory: Address;
  estimatedGas: bigint;
  creator: Address;
  id: string;
  calldata: Hex;
  calldataHash: Hash;
  expiresAt: string;
  simulatedAt: string;
};

type PersistedCreationState = {
  version: 1;
  draft: TokenDraft;
  selectedChainId: number;
  step: number;
  intent?: Omit<PreparedIntent, "estimatedGas" | "token"> & {
    estimatedGas: string;
    token: Omit<ValidTokenDraft, "initialSupply"> & { initialSupply: string };
  };
  submittedHash?: Hash;
};

type IntentApiRecord = {
  id: string;
  chainId: number;
  creator: Address;
  factory: Address;
  factoryVersion: "1";
  name: string;
  symbol: string;
  initialSupply: string;
  initialRecipient: Address;
  userSalt: Hash;
  calldata: Hex;
  calldataHash: Hash;
  status:
    | "draft"
    | "simulated"
    | "submitted"
    | "confirmed"
    | "failed"
    | "expired";
  expiresAt: string;
  simulation?: {
    ok: boolean;
    gasEstimate?: string;
    predictedToken?: Address;
    blockNumber: string;
    simulatedAt: string;
    errorMessage?: string;
  };
};

const blankDraft: TokenDraft = {
  name: "",
  symbol: "",
  supply: "",
  recipient: "",
  salt: "",
};
const steps = ["Token details", "Supply recipient", "Review & deploy"];
const RECOVERY_STORAGE_KEY = "blocpod:create-token:v1";

export function CreateTokenFlow() {
  const router = useRouter();
  const { address, chainId, isConnected } = useAccount();
  const { switchChain, isPending: isSwitching } = useSwitchChain();
  const { signMessageAsync } = useSignMessage();
  const [selectedChainId, setSelectedChainId] = useState<number>(
    baseSepolia.id,
  );
  const [draft, setDraft] = useState<TokenDraft>(blankDraft);
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<
    Partial<Record<keyof TokenDraft, string>>
  >({});
  const [prepareError, setPrepareError] = useState<string>();
  const [isPreparing, setIsPreparing] = useState(false);
  const [intent, setIntent] = useState<PreparedIntent>();
  const [confirmedAddress, setConfirmedAddress] = useState<Address>();
  const [mainnetConfirmed, setMainnetConfirmed] = useState(false);
  const [completion, setCompletion] = useState<
    "submitted" | "confirmed" | "indexed"
  >();
  const [submittedHash, setSubmittedHash] = useState<Hash>();
  const [recoveryLoaded, setRecoveryLoaded] = useState(false);

  useEffect(() => {
    if (address)
      setDraft((current) =>
        current.recipient ? current : { ...current, recipient: address },
      );
  }, [address]);

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(RECOVERY_STORAGE_KEY);
      if (!stored) return;
      const recovery = JSON.parse(stored) as PersistedCreationState;
      if (recovery.version !== 1 || !recovery.draft) return;
      const recoveredChainId = recovery.selectedChainId;
      if (recoveredChainId !== base.id && recoveredChainId !== baseSepolia.id)
        return;
      setDraft(recovery.draft);
      setSelectedChainId(recoveredChainId);
      setStep(Math.min(Math.max(recovery.step, 0), 2));
      if (recovery.submittedHash && isHex(recovery.submittedHash, { strict: true })) {
        setSubmittedHash(recovery.submittedHash as Hash);
        setCompletion("submitted");
      }
      const recoveredIntent = restorePreparedIntent(recovery, recoveredChainId);
      if (recoveredIntent) {
        setIntent(recoveredIntent);
        setStep(2);
      }
    } catch {
      sessionStorage.removeItem(RECOVERY_STORAGE_KEY);
    } finally {
      setRecoveryLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!recoveryLoaded) return;
    if (confirmedAddress) {
      sessionStorage.removeItem(RECOVERY_STORAGE_KEY);
      return;
    }
    sessionStorage.setItem(
      RECOVERY_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        draft,
        selectedChainId,
        step,
        ...(intent
          ? {
              intent: {
                ...intent,
                estimatedGas: intent.estimatedGas.toString(),
                token: {
                  ...intent.token,
                  initialSupply: intent.token.initialSupply.toString(),
                },
              },
            }
          : {}),
        ...(submittedHash ? { submittedHash } : {}),
      } satisfies PersistedCreationState),
    );
  }, [
    confirmedAddress,
    draft,
    intent,
    recoveryLoaded,
    selectedChainId,
    step,
    submittedHash,
  ]);

  useEffect(() => {
    if (!recoveryLoaded || !intent || confirmedAddress) return;
    let cancelled = false;
    const reconcile = async () => {
      const indexed = await findIndexedDeployment(intent, selectedChainId);
      if (!cancelled && indexed) {
        setConfirmedAddress(indexed);
        setCompletion("indexed");
      }
    };
    void reconcile();
    const timer = window.setInterval(() => void reconcile(), 5_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [confirmedAddress, intent, recoveryLoaded, selectedChainId]);

  const update = (field: keyof TokenDraft, value: string) => {
    setDraft((current) => ({
      ...current,
      [field]: field === "symbol" ? value.toUpperCase() : value,
    }));
    setErrors((current) => {
      const next = { ...current };
      delete next[field];
      return next;
    });
    setIntent(undefined);
    setPrepareError(undefined);
    setMainnetConfirmed(false);
  };

  const validateStage = () => {
    const result = validateTokenDraft(
      step === 0
        ? {
            ...draft,
            recipient: "0x0000000000000000000000000000000000000001",
            salt: "stage-one-validation",
          }
        : draft,
    );
    if (!result.ok) {
      const visible: Partial<Record<keyof TokenDraft, string>> = {};
      const fields: (keyof TokenDraft)[] =
        step === 0
          ? ["name", "symbol", "supply"]
          : ["name", "symbol", "supply", "recipient", "salt"];
      for (const field of fields) {
        const message = result.errors[field];
        if (message) visible[field] = message;
      }
      setErrors(visible);
      return false;
    }
    return true;
  };

  const next = () => {
    if (!validateStage()) return;
    setStep((current) => Math.min(current + 1, 2));
  };

  const prepare = async () => {
    const result = validateTokenDraft(draft);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    if (!address) {
      setPrepareError("Connect your wallet to prepare this deployment.");
      return;
    }
    const factory = factoryAddress(selectedChainId);
    if (!factory) {
      setPrepareError(
        `The Blocpod factory is not configured on ${chainForId(selectedChainId).name} yet.`,
      );
      return;
    }
    setIsPreparing(true);
    setPrepareError(undefined);
    try {
      const token = result.value;
      const created = await createSignedIntent(token, address, selectedChainId);
      setIntent(
        validateAndMapIntent(created, token, address, selectedChainId, factory),
      );
    } catch (error) {
      setPrepareError(
        error instanceof Error
          ? error.message
          : "Simulation failed. Review the details and try again.",
      );
    } finally {
      setIsPreparing(false);
    }
  };

  const calls = async () => {
    if (!intent || !address) return [];
    const configuredFactory = factoryAddress(selectedChainId);
    if (!configuredFactory)
      throw new Error(
        "Factory configuration changed. Prepare the deployment again.",
      );
    if (
      chainId !== selectedChainId ||
      address.toLowerCase() !== intent.creator.toLowerCase()
    ) {
      throw new Error(
        "Wallet or network changed after review. Prepare the deployment again.",
      );
    }
    const freshnessMs = selectedChainId === base.id ? 60_000 : 5 * 60_000;
    if (Date.now() - Date.parse(intent.simulatedAt) >= freshnessMs) {
      const refreshed = await createSignedIntent(
        intent.token,
        address,
        selectedChainId,
      );
      const nextIntent = validateAndMapIntent(
        refreshed,
        intent.token,
        address,
        selectedChainId,
        configuredFactory,
      );
      setIntent(nextIntent);
      setMainnetConfirmed(false);
      throw new Error(
        "Simulation was refreshed. Review the new intent before signing.",
      );
    }
    const response = await signedRequest(
      `/api/intents/${intent.id}`,
      "",
      "GET",
      address,
    );
    const payload = (await response.json()) as {
      intent?: IntentApiRecord;
      error?: { message?: string };
    };
    if (!response.ok || !payload.intent)
      throw new Error(
        payload.error?.message ?? "Unable to revalidate deployment intent.",
      );
    validateAndMapIntent(
      payload.intent,
      intent.token,
      address,
      selectedChainId,
      configuredFactory,
    );
    return [{ to: intent.factory, data: intent.calldata }];
  };

  const chainMismatch = isConnected && chainId !== selectedChainId;
  const accountMismatch = Boolean(
    intent && address?.toLowerCase() !== intent.creator.toLowerCase(),
  );

  const signedRequest = async (
    path: string,
    rawBody: string,
    method: "GET" | "POST",
    signer: Address,
  ) => {
    const issuedAt = new Date().toISOString();
    const bodyHash = keccak256(stringToHex(rawBody));
    const message = [
      "Blocpod API request",
      method,
      path,
      bodyHash,
      issuedAt,
    ].join("\n");
    const signature = await signMessageAsync({ message, account: signer });
    return fetch(path, {
      method,
      cache: "no-store",
      headers: {
        ...(method === "POST" ? { "content-type": "application/json" } : {}),
        "x-blocpod-issued-at": issuedAt,
        "x-blocpod-signature": signature,
      },
      ...(method === "POST" ? { body: rawBody } : {}),
    });
  };

  const createSignedIntent = async (
    token: ValidTokenDraft,
    creator: Address,
    intentChainId: number,
  ): Promise<IntentApiRecord> => {
    const rawBody = JSON.stringify({
      idempotencyKey: crypto.randomUUID(),
      chainId: intentChainId,
      creator,
      name: token.name,
      symbol: token.symbol,
      initialSupply: token.initialSupply.toString(),
      initialRecipient: token.recipient,
      userSalt: token.userSalt,
    });
    const response = await signedRequest(
      "/api/intents",
      rawBody,
      "POST",
      creator,
    );
    const payload = (await response.json()) as {
      intent?: IntentApiRecord;
      error?: { message?: string };
    };
    if (!response.ok || !payload.intent)
      throw new Error(
        payload.error?.message ?? "The deployment intent could not be created.",
      );
    return payload.intent;
  };

  const submitTransactionHash = async (transactionHash: Hash) => {
    if (!intent) return;
    setCompletion("submitted");
    setSubmittedHash(transactionHash);
    const rawBody = JSON.stringify({ transactionHash });
    const submitted = await signedRequest(
      `/api/intents/${intent.id}/submit`,
      rawBody,
      "POST",
      intent.creator,
    );
    if (!submitted.ok)
      throw new Error("The backend did not accept the transaction hash.");
  };

  const verifyDeploymentReceipt = async (response: TransactionResponseType) => {
    if (!intent) return;
    setCompletion("submitted");
    const transactionHash = response.transactionReceipts[0]?.transactionHash;
    if (transactionHash) {
      try {
        await submitTransactionHash(transactionHash);
      } catch (error) {
        setPrepareError(
          error instanceof Error
            ? `Onchain confirmation succeeded, but activity sync failed: ${error.message}`
            : "Activity sync failed.",
        );
      }
    }
    const expectedDeploymentSalt = keccak256(
      encodeAbiParameters(
        [{ type: "address" }, { type: "bytes32" }],
        [intent.creator, intent.token.userSalt],
      ),
    );
    for (const receipt of response.transactionReceipts) {
      for (const log of receipt.logs) {
        if (log.address.toLowerCase() !== intent.factory.toLowerCase())
          continue;
        try {
          const event = decodeEventLog({
            abi: baseTokenFactoryAbi,
            data: log.data,
            topics: log.topics,
            strict: true,
          });
          if (event.eventName !== "TokenDeployed") continue;
          const args = event.args;
          const matches =
            args.creator.toLowerCase() === intent.creator.toLowerCase() &&
            args.token.toLowerCase() ===
              intent.predictedAddress.toLowerCase() &&
            args.deploymentSalt === expectedDeploymentSalt &&
            args.initialRecipient.toLowerCase() ===
              intent.token.recipient.toLowerCase() &&
            args.name === intent.token.name &&
            args.symbol === intent.token.symbol &&
            args.initialSupply === intent.token.initialSupply &&
            args.userSalt === intent.token.userSalt;
          if (!matches)
            throw new Error(
              "The confirmed deployment event did not match the reviewed intent.",
            );
          setConfirmedAddress(args.token);
          setCompletion("confirmed");
          void waitForIndexedDeployment(intent, selectedChainId).then(
            (indexed) => {
              if (indexed) setCompletion("indexed");
            },
          );
          return;
        } catch (error) {
          if (
            error instanceof Error &&
            error.message.includes("did not match")
          ) {
            setPrepareError(error.message);
            return;
          }
        }
      }
    }
    setPrepareError(
      "The transaction confirmed, but the expected TokenDeployed event was not found. Inspect it on BaseScan before continuing.",
    );
  };

  if (confirmedAddress) {
    return (
      <div className="success-page">
        <div className="success-mark">
          <Icon name="check" />
        </div>
        <span className="page-eyebrow">
          {completion === "indexed"
            ? "Deployment indexed"
            : "Deployment confirmed"}
        </span>
        <h1>{draft.name} is live.</h1>
        <p>
          The fixed supply was minted once to the chosen recipient. Blocpod and
          the factory have no authority over your token.{" "}
          {completion === "confirmed"
            ? "The receipt is verified; indexing is still in progress."
            : null}
        </p>
        <div className="success-address">
          <span>Token contract</span>
          <strong>{confirmedAddress}</strong>
          <a
            href={explorerAddressUrl(selectedChainId, confirmedAddress)}
            target="_blank"
            rel="noreferrer"
          >
            View on explorer <Icon name="external" />
          </a>
        </div>
        <div className="hero-actions">
          <button
            className="button primary"
            onClick={() =>
              router.push(
                `/studio/tokens/${selectedChainId}/${confirmedAddress}`,
              )
            }
          >
            Open token dashboard <Icon name="arrow" />
          </button>
          <Link className="button secondary" href="/studio/create">
            Create another
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="create-page">
      <div className="create-heading">
        <div>
          <span className="page-eyebrow">Token Studio</span>
          <h1>Create an immutable token</h1>
          <p>One fixed supply. No owner. No hidden controls.</p>
        </div>
        <div className="security-note">
          <Icon name="shield" />
          <span>
            <strong>Non-custodial</strong>Only your wallet can approve
            deployment.
          </span>
        </div>
      </div>
      <ol className="stepper">
        {steps.map((label, index) => (
          <li
            key={label}
            className={index === step ? "active" : index < step ? "done" : ""}
          >
            <span>{index < step ? <Icon name="check" /> : index + 1}</span>
            <em>{label}</em>
          </li>
        ))}
      </ol>

      <div className="creation-grid">
        <section className="form-card">
          {step === 0 ? (
            <TokenDetails draft={draft} errors={errors} update={update} />
          ) : null}
          {step === 1 ? (
            <RecipientStep
              address={address}
              draft={draft}
              errors={errors}
              update={update}
              selectedChainId={selectedChainId}
              setSelectedChainId={(id) => {
                setSelectedChainId(id);
                setIntent(undefined);
                setMainnetConfirmed(false);
              }}
            />
          ) : null}
          {step === 2 ? (
            <ReviewStep
              draft={draft}
              selectedChainId={selectedChainId}
              address={address}
              intent={intent}
              prepareError={prepareError}
              isPreparing={isPreparing}
              onPrepare={prepare}
              mainnetConfirmed={mainnetConfirmed}
              setMainnetConfirmed={setMainnetConfirmed}
              accountMismatch={accountMismatch}
            />
          ) : null}
          <div className="form-actions">
            {step > 0 ? (
              <button
                className="button ghost"
                type="button"
                onClick={() => {
                  setStep((current) => current - 1);
                  setIntent(undefined);
                }}
              >
                Back
              </button>
            ) : (
              <Link className="button ghost" href="/studio">
                Cancel
              </Link>
            )}
            {step < 2 ? (
              <button className="button primary" type="button" onClick={next}>
                Continue <Icon name="arrow" />
              </button>
            ) : null}
            {step === 2 && !intent ? (
              <button
                className="button primary"
                type="button"
                onClick={prepare}
                disabled={isPreparing || !isConnected}
              >
                {isPreparing ? "Simulating…" : "Simulate deployment"}{" "}
                <Icon name="spark" />
              </button>
            ) : null}
            {step === 2 && intent && chainMismatch ? (
              <button
                className="button primary"
                type="button"
                onClick={() =>
                  switchChain({ chainId: selectedChainId as 8453 | 84532 })
                }
                disabled={isSwitching}
              >
                Switch to {chainForId(selectedChainId).name}
              </button>
            ) : null}
            {step === 2 && intent && accountMismatch ? (
              <button className="button primary" type="button" disabled>
                Reconnect reviewed wallet
              </button>
            ) : null}
            {step === 2 && intent && !chainMismatch && !accountMismatch ? (
              <Transaction
                calls={calls}
                chainId={selectedChainId}
                onError={(error) => setPrepareError(error.message)}
                onStatus={(status) => {
                  if (status.statusName === "transactionLegacyExecuted") {
                    const hash = status.statusData.transactionHashList[0];
                    if (hash)
                      void submitTransactionHash(hash as Hash).catch((error) =>
                        setPrepareError(
                          error instanceof Error
                            ? `Transaction sent, but activity sync failed: ${error.message}`
                            : "Transaction sent, but activity sync failed.",
                        ),
                      );
                  }
                }}
                onSuccess={verifyDeploymentReceipt}
              >
                <TransactionButton
                  disabled={selectedChainId === base.id && !mainnetConfirmed}
                  className="button primary transaction-button"
                  text={`Deploy ${intent.token.symbol}`}
                />
                <TransactionSponsor />
                <TransactionStatus>
                  <TransactionStatusLabel />
                  <TransactionStatusAction />
                </TransactionStatus>
                <TransactionToast position="bottom-right" />
              </Transaction>
            ) : null}
          </div>
        </section>
        <TokenPreview draft={draft} selectedChainId={selectedChainId} />
      </div>
    </div>
  );
}

function TokenDetails({
  draft,
  errors,
  update,
}: {
  draft: TokenDraft;
  errors: Partial<Record<keyof TokenDraft, string>>;
  update: (field: keyof TokenDraft, value: string) => void;
}) {
  const nameBytes = new TextEncoder().encode(draft.name.trim()).length;
  return (
    <div className="form-section">
      <span className="form-kicker">Step 1 of 3</span>
      <h2>Define your token</h2>
      <p>These details become permanent once deployed.</p>
      <div className="field">
        <label htmlFor="token-name">
          Token name <small>{nameBytes}/64 bytes</small>
        </label>
        <input
          id="token-name"
          value={draft.name}
          onChange={(event) => update("name", event.target.value)}
          placeholder="e.g. Blocpod Network"
        />
        {errors.name ? (
          <em>{errors.name}</em>
        ) : (
          <span>The full display name shown in wallets and explorers.</span>
        )}
      </div>
      <div className="field-row">
        <div className="field">
          <label htmlFor="token-symbol">Symbol</label>
          <input
            id="token-symbol"
            value={draft.symbol}
            onChange={(event) => update("symbol", event.target.value)}
            placeholder="BLOC"
            maxLength={12}
          />
          {errors.symbol ? (
            <em>{errors.symbol}</em>
          ) : (
            <span>2–12 letters or numbers.</span>
          )}
        </div>
        <div className="field">
          <label htmlFor="token-supply">Fixed supply</label>
          <div className="input-suffix">
            <input
              id="token-supply"
              inputMode="decimal"
              value={draft.supply}
              onChange={(event) => update("supply", event.target.value)}
              placeholder="1000000"
            />
            <span>{draft.symbol || "TOKEN"}</span>
          </div>
          {errors.supply ? (
            <em>{errors.supply}</em>
          ) : (
            <span>18 decimals. This can never increase.</span>
          )}
        </div>
      </div>
      <div className="immutability-callout">
        <Icon name="shield" />
        <div>
          <strong>Supply is immutable</strong>
          <span>
            The complete supply is created once. There is no mint function,
            owner, pause, blacklist, or upgrade path.
          </span>
        </div>
      </div>
    </div>
  );
}

function RecipientStep({
  address,
  draft,
  errors,
  update,
  selectedChainId,
  setSelectedChainId,
}: {
  address: Address | undefined;
  draft: TokenDraft;
  errors: Partial<Record<keyof TokenDraft, string>>;
  update: (field: keyof TokenDraft, value: string) => void;
  selectedChainId: number;
  setSelectedChainId: (id: number) => void;
}) {
  return (
    <div className="form-section">
      <span className="form-kicker">Step 2 of 3</span>
      <h2>Choose the first holder</h2>
      <p>The entire fixed supply is minted directly to this address.</p>
      <div className="field">
        <label htmlFor="recipient">Initial recipient</label>
        <input
          className="mono"
          id="recipient"
          value={draft.recipient}
          onChange={(event) => update("recipient", event.target.value)}
          placeholder="0x…"
        />
        {address ? (
          <button
            type="button"
            className="field-link"
            onClick={() => update("recipient", address)}
          >
            Use connected wallet
          </button>
        ) : null}
        {errors.recipient ? (
          <em>{errors.recipient}</em>
        ) : (
          <span>
            Double-check this address. Tokens cannot be recovered by Blocpod.
          </span>
        )}
      </div>
      <div className="field">
        <label htmlFor="deployment-salt">Deployment salt</label>
        <div className="input-button">
          <input
            id="deployment-salt"
            value={draft.salt}
            onChange={(event) => update("salt", event.target.value)}
            placeholder="e.g. genesis-launch"
            maxLength={32}
          />
          <button
            type="button"
            onClick={() => update("salt", crypto.randomUUID().slice(0, 18))}
          >
            Generate
          </button>
        </div>
        {errors.salt ? (
          <em>{errors.salt}</em>
        ) : (
          <span>
            A unique value used to predict your token address before deployment.
          </span>
        )}
      </div>
      <fieldset className="network-choice">
        <legend>Deployment network</legend>
        <button
          type="button"
          className={selectedChainId === baseSepolia.id ? "selected" : ""}
          onClick={() => setSelectedChainId(baseSepolia.id)}
        >
          <i className="testnet-dot" />
          <span>
            <strong>Base Sepolia</strong>
            <small>Test network · No real value</small>
          </span>
          <b>
            {selectedChainId === baseSepolia.id ? <Icon name="check" /> : null}
          </b>
        </button>
        <button
          type="button"
          className={
            selectedChainId === base.id
              ? "selected mainnet-option"
              : "mainnet-option"
          }
          onClick={() => setSelectedChainId(base.id)}
        >
          <i className="base-dot" />
          <span>
            <strong>Base Mainnet</strong>
            <small>Production · Real funds</small>
          </span>
          <b>{selectedChainId === base.id ? <Icon name="check" /> : null}</b>
        </button>
      </fieldset>
    </div>
  );
}

function ReviewStep({
  draft,
  selectedChainId,
  address,
  intent,
  prepareError,
  isPreparing,
  onPrepare,
  mainnetConfirmed,
  setMainnetConfirmed,
  accountMismatch,
}: {
  draft: TokenDraft;
  selectedChainId: number;
  address: Address | undefined;
  intent: PreparedIntent | undefined;
  prepareError: string | undefined;
  isPreparing: boolean;
  onPrepare: () => void;
  mainnetConfirmed: boolean;
  setMainnetConfirmed: (value: boolean) => void;
  accountMismatch: boolean;
}) {
  const network = chainForId(selectedChainId);
  return (
    <div className="form-section review-section">
      <span className="form-kicker">Step 3 of 3</span>
      <h2>Review deployment intent</h2>
      <p>Confirm every detail. Token rules and supply cannot change later.</p>
      <div className="review-network">
        <div>
          <i
            className={selectedChainId === base.id ? "base-dot" : "testnet-dot"}
          />
          <span>
            <strong>{network.name}</strong>
            <small>
              {selectedChainId === base.id
                ? "Production network · Real funds"
                : "Test network · No real value"}
            </small>
          </span>
        </div>
        {selectedChainId === base.id ? (
          <b>MAINNET</b>
        ) : (
          <b className="test-label">TESTNET</b>
        )}
      </div>
      <dl className="review-list">
        <div>
          <dt>Token</dt>
          <dd>
            {draft.name} <span>{draft.symbol}</span>
          </dd>
        </div>
        <div>
          <dt>Fixed supply</dt>
          <dd>
            {draft.supply} {draft.symbol}
          </dd>
        </div>
        <div>
          <dt>Initial recipient</dt>
          <dd className="mono">{shortAddress(draft.recipient, 7)}</dd>
        </div>
        <div>
          <dt>Acting wallet</dt>
          <dd className="mono">
            {address ? shortAddress(address, 7) : "Not connected"}
          </dd>
        </div>
        <div>
          <dt>Factory version</dt>
          <dd>
            BaseTokenFactory V1{" "}
            <span className="verified">
              <Icon name="check" /> verified
            </span>
          </dd>
        </div>
        {intent ? (
          <>
            <div>
              <dt>Predicted address</dt>
              <dd className="mono">
                <a
                  href={explorerAddressUrl(
                    selectedChainId,
                    intent.predictedAddress,
                  )}
                  target="_blank"
                  rel="noreferrer"
                >
                  {shortAddress(intent.predictedAddress, 7)}{" "}
                  <Icon name="external" />
                </a>
              </dd>
            </div>
            <div>
              <dt>Estimated gas</dt>
              <dd>~{intent.estimatedGas.toLocaleString()} units</dd>
            </div>
          </>
        ) : null}
      </dl>
      {intent ? (
        <div className="simulation-ok">
          <Icon name="check" />
          <div>
            <strong>Simulation passed</strong>
            <span>
              The exact factory call completed successfully in a dry run.
            </span>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="simulation-pending"
          onClick={onPrepare}
          disabled={isPreparing}
        >
          <Icon name="spark" />
          <span>
            <strong>
              {isPreparing ? "Simulation running" : "Simulation required"}
            </strong>
            <small>
              We will verify the factory call and predicted address before
              signing.
            </small>
          </span>
          <Icon name="arrow" />
        </button>
      )}
      {prepareError ? (
        <div className="error-callout" role="alert">
          <strong>Unable to prepare deployment</strong>
          <span>{prepareError}</span>
        </div>
      ) : null}
      {accountMismatch ? (
        <div className="error-callout" role="alert">
          <strong>Wallet changed after review</strong>
          <span>
            Reconnect{" "}
            {intent ? shortAddress(intent.creator, 7) : "the reviewed wallet"}{" "}
            or prepare this intent again.
          </span>
        </div>
      ) : null}
      <div className="irreversible">
        <strong>By deploying, you understand:</strong>
        <ul>
          <li>
            <Icon name="check" />
            The total supply can never increase.
          </li>
          <li>
            <Icon name="check" />
            The token has no owner or administrator.
          </li>
          <li>
            <Icon name="check" />
            The recipient immediately controls the full supply.
          </li>
          <li>
            <Icon name="check" />
            Blocpod cannot pause, seize, upgrade, or recover it.
          </li>
        </ul>
      </div>
      {selectedChainId === base.id && intent ? (
        <label className="mainnet-confirm">
          <input
            type="checkbox"
            checked={mainnetConfirmed}
            onChange={(event) => setMainnetConfirmed(event.target.checked)}
          />
          <span>
            I confirm this is Base Mainnet, uses real funds, and the deployment
            cannot be reversed.
          </span>
        </label>
      ) : null}
    </div>
  );
}

function TokenPreview({
  draft,
  selectedChainId,
}: {
  draft: TokenDraft;
  selectedChainId: number;
}) {
  const supplyLabel = formatSupplyPreview(draft.supply);
  return (
    <aside className="preview-card">
      <div className="preview-label">
        <span>Live preview</span>
        <b>
          <i /> {selectedChainId === base.id ? "Base" : "Sepolia"}
        </b>
      </div>
      <div className="preview-token">
        <div>{draft.symbol.slice(0, 1) || "T"}</div>
        <span>
          <strong>{draft.name || "Your Token"}</strong>
          <small>{draft.symbol || "TOKEN"}</small>
        </span>
      </div>
      <dl>
        <div>
          <dt>Total supply</dt>
          <dd>
            {supplyLabel} {draft.symbol}
          </dd>
        </div>
        <div>
          <dt>Decimals</dt>
          <dd>18</dd>
        </div>
        <div>
          <dt>Supply model</dt>
          <dd>
            <span className="locked">
              <Icon name="shield" /> Fixed forever
            </span>
          </dd>
        </div>
        <div>
          <dt>Token authority</dt>
          <dd>None</dd>
        </div>
      </dl>
      <div className="preview-code">
        <span>CONTRACT PROPERTIES</span>
        {[
          "ERC-20 compatible",
          "No owner or admin",
          "No post-deploy minting",
          "No fees or blacklist",
          "Deterministic CREATE2",
        ].map((item) => (
          <div key={item}>
            <Icon name="check" />
            {item}
          </div>
        ))}
      </div>
      <p>
        <Icon name="shield" /> Built from the audited OpenZeppelin ERC-20
        foundation.
      </p>
    </aside>
  );
}

function validateAndMapIntent(
  record: IntentApiRecord,
  token: ValidTokenDraft,
  creator: Address,
  chainId: number,
  factory: Address,
): PreparedIntent {
  const expectedCalldata = encodeFunctionData({
    abi: baseTokenFactoryAbi,
    functionName: "deployToken",
    args: [
      token.name,
      token.symbol,
      token.initialSupply,
      token.recipient,
      token.userSalt,
    ],
  });
  const simulation = record.simulation;
  if (!simulation?.ok || !simulation.predictedToken) {
    throw new Error(
      simulation?.errorMessage ?? "The server simulation did not pass.",
    );
  }
  const invalid =
    record.status !== "simulated" ||
    record.chainId !== chainId ||
    record.creator.toLowerCase() !== creator.toLowerCase() ||
    record.factory.toLowerCase() !== factory.toLowerCase() ||
    record.factoryVersion !== "1" ||
    record.name !== token.name ||
    record.symbol !== token.symbol ||
    record.initialSupply !== token.initialSupply.toString() ||
    record.initialRecipient.toLowerCase() !== token.recipient.toLowerCase() ||
    record.userSalt !== token.userSalt ||
    record.calldata !== expectedCalldata ||
    record.calldataHash !== keccak256(expectedCalldata) ||
    Date.parse(record.expiresAt) <= Date.now();
  if (invalid)
    throw new Error(
      simulation.errorMessage ??
        "The signed server intent did not match the reviewed deployment.",
    );
  return {
    token,
    predictedAddress: simulation.predictedToken,
    factory,
    estimatedGas: BigInt(simulation.gasEstimate ?? "0"),
    creator,
    id: record.id,
    calldata: record.calldata,
    calldataHash: record.calldataHash,
    expiresAt: record.expiresAt,
    simulatedAt: simulation.simulatedAt,
  };
}

function restorePreparedIntent(
  recovery: PersistedCreationState,
  chainId: number,
): PreparedIntent | undefined {
  const persisted = recovery.intent;
  if (!persisted || Date.parse(persisted.expiresAt) <= Date.now()) return;
  const validated = validateTokenDraft(recovery.draft);
  const configuredFactory = factoryAddress(chainId);
  if (
    !validated.ok ||
    !configuredFactory ||
    !isAddress(persisted.creator) ||
    !isAddress(persisted.factory) ||
    !isAddress(persisted.predictedAddress) ||
    !isHex(persisted.calldata, { strict: true }) ||
    !isHex(persisted.calldataHash, { strict: true })
  )
    return;
  const token = validated.value;
  const expectedCalldata = encodeFunctionData({
    abi: baseTokenFactoryAbi,
    functionName: "deployToken",
    args: [
      token.name,
      token.symbol,
      token.initialSupply,
      token.recipient,
      token.userSalt,
    ],
  });
  if (
    persisted.factory.toLowerCase() !== configuredFactory.toLowerCase() ||
    persisted.token.name !== token.name ||
    persisted.token.symbol !== token.symbol ||
    persisted.token.initialSupply !== token.initialSupply.toString() ||
    persisted.token.recipient.toLowerCase() !== token.recipient.toLowerCase() ||
    persisted.token.userSalt !== token.userSalt ||
    persisted.calldata !== expectedCalldata ||
    persisted.calldataHash !== keccak256(expectedCalldata)
  )
    return;
  try {
    return {
      ...persisted,
      estimatedGas: BigInt(persisted.estimatedGas),
      token,
    };
  } catch {
    return;
  }
}

async function findIndexedDeployment(
  intent: PreparedIntent,
  chainId: number,
): Promise<Address | undefined> {
  const response = await fetch(
    `/api/deployments?chainId=${chainId}&limit=100`,
    { cache: "no-store" },
  );
  if (!response.ok) return;
  const payload = (await response.json()) as {
    deployments?: Array<{
      token: Address;
      creator: Address;
      initialRecipient: Address;
      name: string;
      symbol: string;
      initialSupply: string;
    }>;
  };
  const deployment = payload.deployments?.find(
    (candidate) =>
      candidate.token.toLowerCase() === intent.predictedAddress.toLowerCase() &&
      candidate.creator.toLowerCase() === intent.creator.toLowerCase() &&
      candidate.initialRecipient.toLowerCase() ===
        intent.token.recipient.toLowerCase() &&
      candidate.name === intent.token.name &&
      candidate.symbol === intent.token.symbol &&
      candidate.initialSupply === intent.token.initialSupply.toString(),
  );
  return deployment?.token;
}

async function waitForIndexedDeployment(intent: PreparedIntent, chainId: number) {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    if (await findIndexedDeployment(intent, chainId)) return true;
    await new Promise((resolve) => setTimeout(resolve, 3_000));
  }
  return false;
}
