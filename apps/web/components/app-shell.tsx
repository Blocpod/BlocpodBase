"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Brand } from "./brand";
import { Icon } from "./icons";
import { NetworkSwitch, WalletControl } from "./wallet-control";

const nav = [
  { href: "/studio", label: "Overview", icon: "token" as const },
  { href: "/studio/create", label: "Create token", icon: "plus" as const },
  { href: "/explore", label: "Explore", icon: "spark" as const },
  { href: "/studio/treasury", label: "Treasury", icon: "wallet" as const },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Brand />
        <nav aria-label="Studio navigation">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={pathname === item.href ? "active" : ""}
            >
              <Icon name={item.icon} />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="sidebar-trust">
          <Icon name="shield" />
          <div>
            <strong>Immutable by design</strong>
            <span>No hidden minting or admin keys.</span>
          </div>
        </div>
        <Link className="sidebar-settings" href="/studio/settings">
          Settings
        </Link>
      </aside>
      <section className="studio-frame">
        <header className="studio-header">
          <NetworkSwitch />
          <WalletControl />
        </header>
        <main className="studio-main">{children}</main>
      </section>
      <nav className="mobile-nav" aria-label="Mobile navigation">
        {nav.slice(0, 4).map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={pathname === item.href ? "active" : ""}
          >
            <Icon name={item.icon} />
            <span>{item.label.replace(" token", "")}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
