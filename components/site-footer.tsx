import Link from "next/link";

export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="site-footer">
      <Link className="site-footer-brand" href="/">
        Reel<span>Pay</span>
      </Link>
      <nav className="site-footer-links" aria-label="Правовая информация">
        <Link href="/legal/privacy">Конфиденциальность</Link>
        <Link href="/legal/terms">Условия</Link>
        <Link href="/legal/cookies">Cookie</Link>
      </nav>
      <span className="site-footer-copy">© {year} ReelPay</span>
    </footer>
  );
}
