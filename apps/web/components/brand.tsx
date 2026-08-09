import Image from "next/image";
import Link from "next/link";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link className="brand" href="/" aria-label="Blocpod home">
      <span className="brand-mark" aria-hidden="true">
        <Image src="/blocpod-mark.svg" alt="" width={130} height={203} priority />
      </span>
      {compact ? null : (
        <span>
          blocpod<span className="brand-dot">.</span>
        </span>
      )}
    </Link>
  );
}
