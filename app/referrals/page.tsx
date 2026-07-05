import Link from "next/link";
import QRCode from "qrcode";
import { ArrowRight, BadgeRussianRuble, MousePointerClick, Network, UserCheck, Users } from "lucide-react";
import { AppShell } from "@/components/ui";
import { UserAvatar } from "@/components/user-avatar";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { rub } from "@/lib/money";
import { selectReferralTier } from "@/lib/referral-rules";
import { ReferralShare } from "./referral-share";
import styles from "./referrals.module.css";

export const dynamic = "force-dynamic";

export default async function ReferralsPage() {
  const user = await requireUser();
  const [config, tiers, relations, clicks, commissions, heldCommissions, recentCommissions] = await Promise.all([
    prisma.referralProgramConfig.findUnique({ where: { id: "default" } }),
    prisma.referralTier.findMany({ where: { active: true }, orderBy: { minActiveReferrals: "asc" } }),
    prisma.referralRelation.findMany({
      where: { referrerId: user.id },
      orderBy: { createdAt: "desc" },
      include: {
        referredUser: {
          select: { id: true, name: true, handle: true, avatar: true, preferredRoleMode: true, collabAvailability: true, createdAt: true }
        },
        commissions: { where: { status: "AVAILABLE" }, select: { amountCents: true } }
      }
    }),
    prisma.referralClick.count({ where: { referrerId: user.id } }),
    prisma.referralCommission.aggregate({
      where: { referrerId: user.id, status: "AVAILABLE" },
      _sum: { amountCents: true },
      _count: true
    }),
    prisma.referralCommission.aggregate({
      where: { referrerId: user.id, status: "HELD" },
      _sum: { amountCents: true },
      _count: true
    }),
    prisma.referralCommission.findMany({
      where: { referrerId: user.id },
      include: { referredUser: { select: { name: true, handle: true } } },
      orderBy: { createdAt: "desc" },
      take: 30
    })
  ]);
  const activeCount = relations.filter((item) => item.status === "ACTIVE").length;
  const currentTier = selectReferralTier(tiers, activeCount);
  const nextTier = tiers.find((tier) => tier.minActiveReferrals > activeCount);
  const origin = process.env.NEXT_PUBLIC_SITE_URL || "https://clippers-hub.vercel.app";
  const link = `${origin.replace(/\/$/, "")}/r/${user.referralCode}`;
  const qrDataUrl = await QRCode.toDataURL(link, { width: 320, margin: 1, color: { dark: "#111708", light: "#d8ff43" } });

  return (
    <AppShell>
      <section className={`section ${styles.page}`}>
        <header className={styles.hero}>
          <span><Network size={16} /> Партнёрская программа</span>
          <h1>Приглашайте — получайте процент</h1>
          <p>Делимся частью комиссии ReelPay после реальной оплаченной сделки. Пустые регистрации доход не создают.</p>
        </header>

        <div className={styles.metrics}>
          <article><MousePointerClick /><span>Переходы</span><b>{clicks}</b></article>
          <article><Users /><span>Регистрации</span><b>{relations.length}</b></article>
          <article><UserCheck /><span>Активные</span><b>{activeCount}</b></article>
          <article><BadgeRussianRuble /><span>Получено</span><b>{rub(commissions._sum.amountCents || 0)}</b></article>
        </div>

        <div className={styles.grid}>
          <section className={styles.tier}>
            <small>Ваш уровень</small>
            <h2>{currentTier?.title || "Старт программы"}</h2>
            <strong>{currentTier ? `${currentTier.rateBps / 100}%` : "0%"}</strong>
            <p>{nextTier ? `Ещё ${nextTier.minActiveReferrals - activeCount} активных до ${nextTier.rateBps / 100}%` : "Достигнут максимальный уровень"}</p>
            <div><i style={{ width: `${nextTier ? Math.min(100, (activeCount / nextTier.minActiveReferrals) * 100) : 100}%` }} /></div>
            <small>Бонус после активации реферала: {config?.activationRewardRp ?? 25} RP</small>
            {heldCommissions._count ? <small>На проверке: {rub(heldCommissions._sum.amountCents || 0)}</small> : null}
          </section>
          <ReferralShare link={link} qrDataUrl={qrDataUrl} />
        </div>

        <section className={styles.people}>
          <header><div><small>Ваша сеть</small><h2>Приглашённые</h2></div><span>{relations.length}</span></header>
          {relations.length ? relations.map((relation) => {
            const earned = relation.commissions.reduce((sum, item) => sum + item.amountCents, 0);
            const role = relation.referredUser.preferredRoleMode === "client" ? "Заказчик" : "Исполнитель";
            return (
              <article key={relation.id}>
                <Link href={`/profiles/${relation.referredUser.handle}?returnTo=%2Freferrals`}>
                  <UserAvatar avatar={relation.referredUser.avatar} name={relation.referredUser.name} handle={relation.referredUser.handle} size={48} />
                  <span><b>{relation.referredUser.name}</b><small>@{relation.referredUser.handle} · {role} · с {relation.createdAt.toLocaleDateString("ru-RU")}</small></span>
                </Link>
                <span data-status={relation.status.toLowerCase()}>
                  {relation.status === "ACTIVE" ? "Активен" : relation.status === "FLAGGED" ? "Проверка" : relation.status === "BLOCKED" ? "Заблокирован" : "Регистрация"}
                </span>
                <div><small>Ваша комиссия</small><b>{rub(earned)}</b></div>
                {relation.referredUser.collabAvailability !== "NONE" ? (
                  <Link className={styles.collab} href={`/profiles/${relation.referredUser.handle}?collab=1&returnTo=%2Freferrals`}>
                    Предложить коллаб <ArrowRight size={15} />
                  </Link>
                ) : <span className={styles.disabled}>Коллабы отключены</span>}
              </article>
            );
          }) : <div className={styles.empty}>Пока никто не зарегистрировался по вашей ссылке.</div>}
        </section>
        <section className={styles.history}>
          <header><small>Начисления</small><h2>История комиссии</h2></header>
          {recentCommissions.length ? recentCommissions.map((item) => (
            <article key={item.id}>
              <span><b>{item.referredUser.name}</b><small>@{item.referredUser.handle} · {item.side === "CLIENT" ? "заказчик" : "исполнитель"}</small></span>
              <span data-status={item.status.toLowerCase()}>{item.status === "AVAILABLE" ? "Доступно" : item.status === "HELD" ? "Проверка" : "Отменено"}</span>
              <b>{rub(item.amountCents)}</b>
              <small>{item.createdAt.toLocaleDateString("ru-RU")}</small>
            </article>
          )) : <div className={styles.empty}>Комиссий пока нет.</div>}
        </section>
      </section>
    </AppShell>
  );
}
