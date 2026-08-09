"use client";

import { Address, Avatar, Name } from "@coinbase/onchainkit/identity";
import {
  ConnectWallet,
  Wallet,
  WalletDropdown,
  WalletDropdownDisconnect,
  WalletDropdownFundLink,
  WalletDropdownLink,
} from "@coinbase/onchainkit/wallet";
import { useAccount, useSwitchChain } from "wagmi";
import { base, baseSepolia } from "wagmi/chains";
import { Icon } from "./icons";

export function WalletControl() {
  return (
    <Wallet>
      <ConnectWallet
        disconnectedLabel="Connect wallet"
        className="wallet-connect"
      >
        <Avatar className="wallet-avatar" />
        <Name className="wallet-name" />
      </ConnectWallet>
      <WalletDropdown>
        <div className="wallet-identity">
          <Avatar />
          <Name />
          <Address />
        </div>
        <WalletDropdownLink href="/studio" icon={<Icon name="token" />}>
          My tokens
        </WalletDropdownLink>
        <WalletDropdownFundLink />
        <WalletDropdownDisconnect />
      </WalletDropdown>
    </Wallet>
  );
}

export function NetworkSwitch({ compact = false }: { compact?: boolean }) {
  const { chainId } = useAccount();
  const { switchChain, isPending } = useSwitchChain();
  const activeId = chainId ?? baseSepolia.id;
  const isMainnet = activeId === base.id;
  return (
    <button
      className={`network-pill ${isMainnet ? "mainnet" : "testnet"}`}
      type="button"
      onClick={() =>
        switchChain({ chainId: isMainnet ? baseSepolia.id : base.id })
      }
      disabled={isPending}
      aria-label={`Connected to ${isMainnet ? "Base Mainnet" : "Base Sepolia"}. Switch network.`}
    >
      <span className="network-dot" />
      {compact
        ? isMainnet
          ? "Base"
          : "Sepolia"
        : isMainnet
          ? "Base Mainnet"
          : "Base Sepolia"}
    </button>
  );
}
