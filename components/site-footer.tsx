import Link from "next/link";

const links = [
  ["/about", "О сервисе"],
  ["/about#how-it-works", "Как работает"],
  ["/help", "Помощь"],
  ["/safety", "Безопасность"],
  ["/support", "Поддержка"],
  ["/legal/terms", "Условия"],
  ["/legal/privacy", "Конфиденциальность"],
  ["/legal/cookies", "Cookie"]
] as const;

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <Link className="site-footer-brand" href="/">Reel<span>Pay</span></Link>
      <nav className="site-footer-links" aria-label="Полезные ссылки">
        {links.map(([href, label]) => <Link href={href} key={href}>{label}</Link>)}
      </nav>
      <span className="site-footer-copy">© {new Date().getFullYear()} ReelPay</span>
    </footer>
  );
}
