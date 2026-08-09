import { factoryAddress, vestingFactoryAddress } from "@/lib/chains";

export default function SettingsPage() {
  const sepoliaFactoryConfigured = Boolean(factoryAddress(84532));
  const mainnetFactoryConfigured = Boolean(factoryAddress(8453));
  const sepoliaVestingConfigured = Boolean(vestingFactoryAddress(84532));
  const mainnetVestingConfigured = Boolean(vestingFactoryAddress(8453));

  return (
    <div className="page-stack settings-page">
      <div className="page-title">
        <div>
          <span className="page-eyebrow">Preferences</span>
          <h1>Settings</h1>
          <p>Control how Blocpod prepares and displays actions.</p>
        </div>
      </div>
      <section className="settings-card">
        <div>
          <h2>Default network</h2>
          <p>New deployment drafts currently begin on this network.</p>
        </div>
        <span className="locked-setting">Base Sepolia · fixed</span>
      </section>
      <section className="settings-card">
        <div>
          <h2>Transaction safeguards</h2>
          <p>
            Mainnet actions always require simulation and an explicit
            irreversible-action review.
          </p>
        </div>
        <span className="locked-setting">Always on</span>
      </section>
      <section className="settings-card">
        <div>
          <h2>Token factories</h2>
          <p>
            Base Sepolia: {sepoliaFactoryConfigured ? "configured" : "missing"}.
            Base Mainnet: {mainnetFactoryConfigured ? "configured" : "missing"}.
          </p>
        </div>
        <span className="locked-setting">Environment managed</span>
      </section>
      <section className="settings-card">
        <div>
          <h2>Linear vesting factories</h2>
          <p>
            Base Sepolia: {sepoliaVestingConfigured ? "configured" : "missing"}.
            Base Mainnet: {mainnetVestingConfigured ? "configured" : "missing"}.
          </p>
        </div>
        <span className="locked-setting">Environment managed</span>
      </section>
      <section className="settings-card">
        <div>
          <h2>Agent actions</h2>
          <p>
            Constrained agent proposals are not enabled in this deployment.
            Wallet signatures and submissions always remain user controlled.
          </p>
        </div>
        <span className="locked-setting">Unavailable</span>
      </section>
    </div>
  );
}
