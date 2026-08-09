import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AmbientBackground } from "@/components/ambient-background";
import { Web3Provider } from "@/components/web3-provider";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  ),
  title: {
    default: "Blocpod — Launch immutable tokens on Base",
    template: "%s — Blocpod",
  },
  description:
    "Create, distribute, vest, and manage immutable fixed-supply tokens on Base with transparent deployment intent and verified provenance.",
  applicationName: "Blocpod",
  robots: { index: true, follow: true },
  openGraph: {
    title: "Blocpod",
    description: "Production-grade token issuance and management on Base.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <AmbientBackground />
        <div className="site-content">
          <Web3Provider>{children}</Web3Provider>
        </div>
      </body>
    </html>
  );
}
