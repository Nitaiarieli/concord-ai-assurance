import Link from "next/link";

export function CommercialHeader({ active }: { active?: "pricing" | "value" | "intelligence" | "workspace" }) {
  return (
    <header className="commercial-header">
      <Link className="commercial-brand" href="/" aria-label="Concord home">
        <span className="brand-glyph" aria-hidden="true"><i/><i/><i/></span><strong>Concord</strong>
      </Link>
      <nav aria-label="Commercial navigation">
        <a className={active === "pricing" ? "active" : ""} href="/pricing">Pricing</a>
        <a className={active === "value" ? "active" : ""} href="/value">Value &amp; FinOps</a>
        <a className={active === "intelligence" ? "active" : ""} href="/intelligence">Market radar</a>
      </nav>
      <div className="commercial-header-actions">
        <button className="commercial-contact-link" type="button" data-contact-trigger>Contact</button>
        <a className={`commercial-workspace-link ${active === "workspace" ? "active" : ""}`} href="/workspace">Open workspace <span>↗</span></a>
      </div>
    </header>
  );
}

export function CommercialFooter() {
  return <footer className="commercial-footer"><span>Concord · AI Assurance</span><p>Transparent coverage. Traceable value. No hidden fees.</p><Link href="/">Product overview ↑</Link></footer>;
}
