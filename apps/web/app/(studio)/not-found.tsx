import Link from "next/link";

export default function NotFound() {
  return (
    <div className="empty-panel standalone">
      <h1>Token not found</h1>
      <p>
        The address or network is invalid, or the deployment has not been
        indexed yet.
      </p>
      <Link className="button primary small" href="/explore">
        Explore deployments
      </Link>
    </div>
  );
}
