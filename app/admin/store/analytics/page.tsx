import Link from "next/link";
import { ArrowLeft, BarChart3, ExternalLink, MousePointerClick, ShieldCheck, UserRound } from "lucide-react";
import { AdminBarChart } from "@/components/admin-charts";
import { AdminPageHeader, AdminShell } from "@/components/admin-shell";
import { Card, Tag } from "@/components/ui";
import { parseJson } from "@/lib/json";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function dayKey(date: Date) {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Moscow" }).format(date);
}

function shortDay(key: string) {
  return new Date(`${key}T12:00:00+03:00`).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" });
}

export default async function StoreAnalyticsPage({
  searchParams
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const params = await searchParams;
  const days = params.days === "7" ? 7 : 30;
  const since = new Date(Date.now() - days * 86400000);
  const [events, totalClicks, offers] = await Promise.all([
    prisma.analyticsEvent.findMany({
      where: { type: "STORE_OFFER_CLICK", createdAt: { gte: since } },
      include: { user: { select: { name: true, email: true, handle: true } } },
      orderBy: { createdAt: "desc" },
      take: 2000
    }),
    prisma.analyticsEvent.count({ where: { type: "STORE_OFFER_CLICK", createdAt: { gte: since } } }),
    prisma.storeOffer.findMany({ where: { kind: "PARTNER_LINK" }, select: { id: true, title: true, provider: true } })
  ]);
  const offerMap = new Map(offers.map((offer) => [offer.id, offer]));
  const visitors = new Set(events.map((event) => event.userId || event.ipHash || event.userAgentHash).filter(Boolean));
  const guests = new Set(events.filter((event) => !event.userId).map((event) => event.ipHash || event.userAgentHash).filter(Boolean));
  const byOffer = new Map<string, number>();
  const byDay = new Map<string, number>();
  events.forEach((event) => {
    const metadata = parseJson<{ offerId?: string; source?: string }>(event.metadata, {});
    if (metadata.offerId) byOffer.set(metadata.offerId, (byOffer.get(metadata.offerId) || 0) + 1);
    const key = dayKey(event.createdAt);
    byDay.set(key, (byDay.get(key) || 0) + 1);
  });
  const dayPoints = Array.from({ length: Math.min(days, 14) }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (Math.min(days, 14) - 1 - index));
    const key = dayKey(date);
    return { label: shortDay(key), value: byDay.get(key) || 0 };
  });
  const popular = [...byOffer.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([id, clicks]) => ({ id, clicks, offer: offerMap.get(id) }));

  return (
    <AdminShell>
      <main className="admin-screen admin-store-analytics">
        <Link className="admin-back-link" href="/admin/store"><ArrowLeft size={16} /> В магазин</Link>
        <AdminPageHeader
          eyebrow="Магазин · аналитика"
          title="Клики по предложениям"
          description="Зарегистрированные пользователи показываются по аккаунту. Для гостей хранится только необратимый хеш — исходный IP увидеть или восстановить нельзя."
          action={<nav className="admin-period-switch"><Link className={days === 7 ? "active" : ""} href="/admin/store/analytics?days=7">7 дней</Link><Link className={days === 30 ? "active" : ""} href="/admin/store/analytics?days=30">30 дней</Link></nav>}
        />

        <section className="admin-store-summary">
          <Card><MousePointerClick size={19} /><span><b>{totalClicks}</b><small>переходов</small></span></Card>
          <Card><UserRound size={19} /><span><b>{visitors.size}</b><small>уникальных посетителей</small></span></Card>
          <Card><ShieldCheck size={19} /><span><b>{guests.size}</b><small>гостей, безопасно</small></span></Card>
        </section>

        <section className="admin-charts-grid one">
          <AdminBarChart title="Переходы по дням" value={`${totalClicks} за период`} points={dayPoints} />
        </section>

        <div className="admin-two">
          <Card className="admin-panel">
            <div className="section-head compact"><h2>Популярные продукты</h2><BarChart3 size={18} /></div>
            <div className="store-click-products">
              {popular.map((item, index) => (
                <div key={item.id}>
                  <span>{index + 1}</span>
                  <div><strong>{item.offer?.title || "Удалённое предложение"}</strong><small>{item.offer?.provider || item.id}</small></div>
                  <b>{item.clicks}</b>
                </div>
              ))}
              {!popular.length ? <p className="muted">Клики появятся после переходов из магазина и лидерборда.</p> : null}
            </div>
          </Card>

          <Card className="admin-panel">
            <div className="section-head compact"><h2>Последние переходы</h2><Tag tone="soft">{events.length}</Tag></div>
            <div className="store-click-events">
              {events.slice(0, 100).map((event) => {
                const metadata = parseJson<{ offerId?: string; source?: string }>(event.metadata, {});
                const offer = metadata.offerId ? offerMap.get(metadata.offerId) : null;
                return (
                  <article key={event.id}>
                    <span className={event.user ? "known" : "guest"}>{event.user ? "U" : "G"}</span>
                    <div>
                      <strong>{event.user?.name || `Гость ${event.ipHash?.slice(0, 7) || event.userAgentHash?.slice(0, 7) || "без ID"}`}</strong>
                      <small>{event.user?.email || "Личные данные не хранятся"}</small>
                      <em>{offer?.title || "Предложение"} · {metadata.source || "card"}</em>
                    </div>
                    <time>{event.createdAt.toLocaleString("ru-RU")}</time>
                  </article>
                );
              })}
            </div>
          </Card>
        </div>
      </main>
    </AdminShell>
  );
}
