import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, Coins, Package, ShoppingBag, Sparkles } from "lucide-react";
import { AppShell } from "@/components/ui";
import { PartnerCatalog } from "@/components/partner-catalog";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseJson } from "@/lib/json";
import { redeemStoreOfferAction } from "@/app/store/actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Магазин ReelPay",
  description: "Награды за RP и предложения партнёров."
};

export default async function StorePage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const tab = params.tab === "partners" ? "partners" : "rp";
  const user = await getCurrentUser();
  const [offers, redemptions, partnerLinks] = await Promise.all([
    prisma.storeOffer.findMany({ where: { active: true, kind: "RP_REWARD" }, orderBy: [{ featured: "desc" }, { sortOrder: "asc" }] }),
    user ? prisma.storeRedemption.findMany({
      where: { userId: user.id },
      include: { offer: { select: { title: true } } },
      orderBy: { createdAt: "desc" },
      take: 8
    }) : Promise.resolve([]),
    prisma.storeOffer.findMany({ where: { active: true, kind: "PARTNER_LINK", url: { not: null } }, orderBy: [{ featured: "desc" }, { sortOrder: "asc" }] })
  ]);
  const partnerCards = partnerLinks.map((offer) => ({
    id: offer.id,
    title: offer.title,
    description: offer.description,
    url: offer.url!,
    imageUrl: offer.imageUrl ? `/api/store/offer-image/${encodeURIComponent(offer.id)}` : null,
    provider: offer.provider,
    category: offer.category,
    features: parseJson<string[]>(offer.featuresJson, []),
    licenseNumber: offer.licenseNumber,
    disclaimer: offer.disclaimer,
    featured: offer.featured
  }));
  const purchase = typeof params.purchase === "string" ? params.purchase : "";
  const message = purchase === "ok"
    ? "Заявка создана. Мы свяжемся с вами по email."
    : purchase === "rp_balance"
      ? "Недостаточно RP для этой награды."
      : purchase === "out_of_stock"
        ? "Эта награда только что закончилась."
        : purchase ? "Не удалось оформить награду. Попробуйте ещё раз." : "";

  return (
    <AppShell>
      <main className="section store-page">
        <header className="store-hero">
          <div>
            <span><ShoppingBag size={16} /> Магазин ReelPay</span>
            <h1>Трать RP на полезное</h1>
            <p>Получай RP за достижения и задания, обменивай их на награды или выбирай предложения партнёров.</p>
          </div>
          <div className="store-balance">
            <small>Ваш баланс</small>
            <strong>{user ? user.rpBalance.toLocaleString("ru-RU") : "—"} RP</strong>
            {user ? <Link href="/profile">Как получить больше</Link> : <Link href="/login?returnTo=%2Fstore">Войти</Link>}
          </div>
        </header>

        <nav className="store-tabs" aria-label="Разделы магазина">
          <Link className={tab === "rp" ? "active" : ""} href="/store"><Coins size={17} /> За RP</Link>
          <Link className={tab === "partners" ? "active" : ""} href="/store?tab=partners"><Sparkles size={17} /> Партнёрские предложения</Link>
        </nav>

        {message ? <p className={`store-notice ${purchase === "ok" ? "good" : "bad"}`} role="status">{message}</p> : null}

        {tab === "partners" ? (
          <PartnerCatalog offers={partnerCards} />
        ) : (
          <>
            <section className="store-offer-grid">
              {offers.map((offer) => {
                const soldOut = offer.stock !== null && offer.stock <= 0;
                const affordable = Boolean(user && user.rpBalance >= offer.priceRp);
                return (
                  <article className={`store-offer ${offer.featured ? "featured" : ""}`} key={offer.id}>
                    <div className="store-offer-art">
                      {offer.imageUrl ? <img src={offer.imageUrl} alt="" loading="lazy" /> : <Package size={36} />}
                      {offer.featured ? <span>Рекомендуем</span> : null}
                    </div>
                    <div className="store-offer-copy">
                      <h2>{offer.title}</h2>
                      <p>{offer.description}</p>
                      <div><strong>{offer.priceRp.toLocaleString("ru-RU")} RP</strong><small>{offer.stock === null ? "Без лимита" : `Осталось: ${offer.stock}`}</small></div>
                    </div>
                    {!user ? (
                      <Link className="store-buy" href="/login?returnTo=%2Fstore">Войти для обмена</Link>
                    ) : (
                      <form action={redeemStoreOfferAction}>
                        <input type="hidden" name="offerId" value={offer.id} />
                        <button className="store-buy" type="submit" disabled={soldOut || !affordable}>
                          {soldOut ? "Закончилась" : affordable ? "Получить за RP" : "Не хватает RP"}
                        </button>
                      </form>
                    )}
                  </article>
                );
              })}
            </section>

            {redemptions.length ? (
              <section className="store-history">
                <header><div><small>Ваши заявки</small><h2>История магазина</h2></div></header>
                <div>
                  {redemptions.map((item) => (
                    <article key={item.id}>
                      <span><CheckCircle2 size={17} /></span>
                      <div><strong>{item.offer.title}</strong><small>{item.createdAt.toLocaleDateString("ru-RU")} · {item.contactEmail}</small></div>
                      <b>{item.costRp} RP</b>
                      <em>{item.status === "NEW" ? "Новая" : item.status === "CONFIRMED" ? "Подтверждена" : item.status === "FULFILLED" ? "Выполнена" : "Отменена"}</em>
                    </article>
                  ))}
                </div>
              </section>
            ) : null}

            <p className="store-terms">Наградные RP нельзя вывести в рубли. Физические награды подтверждаются по email, указанному в аккаунте.</p>
          </>
        )}
      </main>
    </AppShell>
  );
}
