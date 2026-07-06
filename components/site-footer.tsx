import Link from "next/link";
import styles from "./site-footer.module.css";

const primaryLinks = [
  ["/business", "Для бизнеса"],
  ["/about", "О сервисе"],
  ["/about#how-it-works", "Как работает"],
  ["/help", "Помощь"],
  ["/safety", "Безопасность"]
] as const;

const secondaryLinks = [
  ["/support", "Поддержка"],
  ["/store", "Магазин"],
  ["/referrals", "Партнёрам"],
  ["/legal/terms", "Условия"],
  ["/legal/privacy", "Конфиденциальность"],
  ["/legal/cookies", "Cookie"]
] as const;

export function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <Link className={styles.brand} href="/">Reel<span>Pay</span></Link>
      <nav className={styles.links} aria-label="Основные ссылки">
        {primaryLinks.map(([href, label]) => <Link href={href} key={href}>{label}</Link>)}
        {secondaryLinks.map(([href, label]) => <Link href={href} key={href}>{label}</Link>)}
        <details className={styles.more}>
          <summary>Ещё</summary>
          <div aria-label="Дополнительные ссылки">
            {secondaryLinks.map(([href, label]) => <Link href={href} key={`more-${href}`}>{label}</Link>)}
          </div>
        </details>
      </nav>
      <span className={styles.copy}>© {new Date().getFullYear()}</span>
    </footer>
  );
}
