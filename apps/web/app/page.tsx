import Link from "next/link";
import Image from "next/image";
import { Brand } from "@/components/brand";
import { Icon } from "@/components/icons";
import { WalletControl } from "@/components/wallet-control";

const proof = [
  { value: "18", label: "Standard decimals" },
  { value: "0", label: "Admin functions" },
  { value: "100%", label: "Supply minted once" },
];

export default function HomePage() {
  return (
    <div className="landing">
      <header className="landing-nav">
        <Brand />
        <nav>
          <Link href="/explore">Explore</Link>
          <Link href="#how">How it works</Link>
        </nav>
        <WalletControl />
      </header>
      <main>
        <section className="hero">
          <div className="eyebrow">
            <span /> Built for Base
          </div>
          <h1>
            Your token.
            <br />
            <em>Set in stone.</em>
          </h1>
          <p>
            Create a fixed-supply token with no owner, no hidden minting, and no
            platform control—then manage distribution with every action made
            clear before you sign.
          </p>
          <div className="hero-actions">
            <Link className="button primary" href="/studio/create">
              Create your token <Icon name="arrow" />
            </Link>
            <Link className="button secondary" href="/explore">
              View live deployments
            </Link>
          </div>
          <div className="hero-proof">
            {proof.map((item) => (
              <div key={item.label}>
                <strong>{item.value}</strong>
                <span>{item.label}</span>
              </div>
            ))}
          </div>
          <div className="token-orbit" aria-hidden="true">
            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />
            <div className="token-core">
              <Image src="/blocpod-mark.svg" alt="" width={130} height={203} />
            </div>
            <div className="orbit-tag tag-one">FIXED SUPPLY</div>
            <div className="orbit-tag tag-two">BASE NATIVE</div>
            <div className="orbit-tag tag-three">VERIFIED</div>
          </div>
        </section>

        <section className="trust-strip">
          <span>One deployment. One supply. Permanent rules.</span>
          <div>
            <i /> No ownership
          </div>
          <div>
            <i /> Deterministic address
          </div>
          <div>
            <i /> Open-source contracts
          </div>
        </section>

        <section className="how-section" id="how">
          <div className="section-kicker">A safer launch process</div>
          <div className="section-heading">
            <h2>
              Know exactly what
              <br />
              you&apos;re creating.
            </h2>
            <p>
              Blocpod turns contract deployment into a clear, inspectable
              workflow. Nothing is hidden behind a single mystery button.
            </p>
          </div>
          <div className="process-flow">
            <article>
              <div className="process-head">
                <span className="step">01</span>
                <span className="process-icon"><Icon name="token" /></span>
              </div>
              <div className="process-copy">
                <h3>Define the token</h3>
                <p>Set the identity, fixed supply, and first recipient.</p>
              </div>
              <div className="process-meta">
                <span>Name · Symbol · Supply</span>
                <strong>Bound</strong>
              </div>
            </article>
            <article>
              <div className="process-head">
                <span className="step">02</span>
                <span className="process-icon"><Icon name="shield" /></span>
              </div>
              <div className="process-copy">
                <h3>Verify every detail</h3>
                <p>Inspect the network, factory, address, and simulation.</p>
              </div>
              <div className="process-meta">
                <span>Factory · Network · Gas</span>
                <strong><i /> Ready</strong>
              </div>
            </article>
            <article>
              <div className="process-head">
                <span className="step">03</span>
                <span className="process-icon"><Icon name="spark" /></span>
              </div>
              <div className="process-copy">
                <h3>Deploy with proof</h3>
                <p>Sign once, confirm provenance, then manage from truth.</p>
              </div>
              <div className="process-meta">
                <span>Receipt · Provenance · Modules</span>
                <strong>Verified</strong>
              </div>
            </article>
          </div>
        </section>

        <section className="final-cta">
          <div>
            <div className="section-kicker">Start on testnet</div>
            <h2>Launch with conviction.</h2>
            <p>
              Practice on Base Sepolia, then deploy the exact reviewed token to
              Base Mainnet.
            </p>
          </div>
          <Link className="button primary" href="/studio/create">
            Open Token Studio <Icon name="arrow" />
          </Link>
        </section>
      </main>
      <footer>
        <Brand />
        <span>Built on Base. Controlled by no one.</span>
        <div>
          <Link href="/terms">Terms</Link>
          <Link href="/privacy">Privacy</Link>
          <a href="https://base.org" target="_blank" rel="noreferrer">
            Base
          </a>
        </div>
      </footer>
    </div>
  );
}
