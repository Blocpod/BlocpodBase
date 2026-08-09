import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isAddress } from "viem";
import { TokenDashboard } from "@/components/token-dashboard";
import { isSupportedChainId } from "@/lib/chains";

export const metadata: Metadata = { title: "Token dashboard" };

export default async function TokenPage({
  params,
}: {
  params: Promise<{ chainId: string; address: string }>;
}) {
  const { chainId: chainText, address } = await params;
  const chainId = Number(chainText);
  if (!isSupportedChainId(chainId) || !isAddress(address)) notFound();
  return <TokenDashboard chainId={chainId} tokenAddress={address} />;
}
