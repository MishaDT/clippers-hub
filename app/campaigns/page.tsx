import Link from "next/link";
import { unstable_cache } from "next/cache";
import {
  ArrowRight,
  ArrowUpRight,
  BriefcaseBusiness,
  Sparkles,
  Trophy
} from "lucide-react";
import { AppShell } from "@/components/ui";
import { boostCampaignWithRpAction } from "@/app/actions";
import { CampaignFilters } from "./campaign-filters";
import { CampaignGuide } from "./campaign-guide";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { getActiveRoleMode } from "@/lib/role-mode";
import { compactNumber, rub } from "@/lib/money";
import styles from "./marketplace.module.css";
import { MarketplaceBrowser, type MarketplaceCard } from "@/components/marketplace-browser";

const ACTIVE_STATUSES = ["ACCEPTED", "POSTED", "VERIFIED", "THRESHOLD_MET", "SETTLING"] as const;

const ACTIVE_META: Record<string, { label: string; cta: string; href: (id: string) => string }> = {
  ACCEPTED: { label: "Заказ взят — выложи ролик", cta: "Выложить ролик", href: () => "/upload" },
  POSTED: { label: "На проверке", cta: "Открыть заказ", href: (id) => `/campaigns/${id}` },
  VERIFIED: { label: "Подтверждён — набираем просмотры", cta: "Открыть заказ", href: (id) => `/campaigns/${id}` },
  THRESHOLD_MET: { label: "Цель достигнута — расчёт", cta: "Открыть заказ", href: (id) => `/campaigns/${id}` },
  SETTLING: { label: "Идёт расчёт выплаты", cta: "Открыть заказ", href: (id) => `/campaigns/${id}` }
};

// The clipper's current in-progress order, pinned at the top of the home screen.
async function loadActiveOrder() {
  const user = await getCurrentUser();
  if (!user) return null;
  const sub = await prisma.submission.findFirst({
    where: { workerId: user.id, status: { in: [...ACTIVE_STATUSES] } },
    orderBy: { updatedAt: "desc" },
    select: {
      status: true,
      currentViews: true,
      campaign: { select: { id: true, title: true, viewThreshold: true, cpmRateCents: true, niche: true } }
    }
  });
  if (!sub) return null;
  const threshold = Math.max(1, sub.campaign.viewThreshold);
  const meta = ACTIVE_META[sub.status] ?? ACTIVE_META.POSTED;
  return {
    status: sub.status,
    statusKey: sub.status.toLowerCase(),
    label: meta.label,
    cta: meta.cta,
    href: meta.href(sub.campaign.id),
    title: sub.campaign.title,
    niche: sub.campaign.niche || "Видео",
    views: sub.currentViews,
    threshold,
    pct: Math.min(100, Math.round((sub.currentViews / threshold) * 100)),
    payout: Math.round((threshold / 1000) * sub.campaign.cpmRateCents * 0.89)
  };
}

export const revalidate = 30;

const getCampaigns = unstable_cache(
  async () =>
    prisma.campaign.findMany({
      select: {
        id: true,
        title: true,
        description: true,
        sourcePlatform: true,
        cpmRateCents: true,
        viewThreshold: true,
        deadline: true,
        niche: true,
        visibility: true,
        featuredUntil: true,
        remainingBudgetCents: true,
        createdAt: true,
        owner: { select: { name: true, handle: true, avatar: true } },
        _count: { select: { submissions: true } }
      },
      where: {
        status: { in: ["ACTIVE", "LOW_BUDGET"] },
        visibility: { in: ["PUBLIC", "FEATURED"] }
      },
      orderBy: { createdAt: "desc" },
      take: 80
    }),
  ["campaigns-marketplace-v3"],
  { revalidate: 30, tags: ["campaigns"] }
);

type CampaignItem = Awaited<ReturnType<typeof getCampaigns>>[number];

function normalize(value: unknown) {
  return String(value || "").trim();
}

function categoryMatch(campaign: CampaignItem, category: string) {
  const text = `${campaign.title} ${campaign.description} ${campaign.niche || ""}`.toLowerCase();
  if (category === "streams") return campaign.sourcePlatform === "TWITCH" || text.includes("стрим");
  if (category === "humor") return text.includes("смеш") || text.includes("юмор") || text.includes("мем");
  if (category === "games") return campaign.niche === "Gaming" || text.includes("game") || text.includes("игр");
  if (category === "business") return ["Business", "Brand", "Finance", "Career", "Design"].includes(campaign.niche || "") || text.includes("бизнес");
  return true;
}

function timeOf(value: Date | string) {
  return value instanceof Date ? value.getTime() : new Date(value).getTime();
}

function expectedPayout(campaign: CampaignItem) {
  return Math.round((campaign.viewThreshold / 1000) * campaign.cpmRateCents * 0.89);
}

function deadlineMatch(daysLeft: number, deadline: string) {
  if (deadline === "3") return daysLeft <= 3;
  if (deadline === "7") return daysLeft <= 7;
  if (deadline === "later") return daysLeft > 7;
  return true;
}

function median(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

async function ClientCampaignsView({ user }: { user: { id: string; rpBalance: number; marketGuideSeenAt: Date | null } }) {
  const campaigns = await prisma.campaign.findMany({
    where: { ownerId: user.id },
    select: {
      id: true,
      title: true,
      status: true,
      remainingBudgetCents: true,
      featuredUntil: true
    },
    orderBy: { createdAt: "desc" },
    take: 30
  });
  const submissionStats = campaigns.length ? await prisma.submission.groupBy({
    by: ["campaignId"],
    where: { campaignId: { in: campaigns.map((campaign) => campaign.id) } },
    _sum: { currentViews: true },
    _count: { _all: true }
  }) : [];
  const statsByCampaign = new Map(submissionStats.map((stats) => [stats.campaignId, stats]));
  const totalViews = submissionStats.reduce((sum, stats) => sum + (stats._sum.currentViews || 0), 0);
  const totalClips = submissionStats.reduce((sum, stats) => sum + stats._count._all, 0);
  const activeCount = campaigns.filter((campaign) => ["ACTIVE", "LOW_BUDGET"].includes(campaign.status)).length;

  return (
    <AppShell hideFooter>
      <section className={`section market-screen client-campaigns ${styles.marketplace}`}>
        <CampaignGuide variant="client" initiallyCollapsed={Boolean(user.marketGuideSeenAt)} persistSeen />
        <div className="market-head">
          <div>
            <span className="eyebrow">Работа заказчика</span>
            <h1>Мои кампании</h1>
            <p>Здесь только ваши заказы, полученные ролики и оставшийся бюджет.</p>
          </div>
          <Link className="market-create" href="/campaigns/new">
            Создать кампанию <ArrowUpRight size={18} />
          </Link>
        </div>

        <div className="market-stats">
          <span><b>{activeCount}</b> активных</span>
          <span><b>{compactNumber(totalViews)}</b> просмотров</span>
          <span><b>{totalClips}</b> роликов</span>
        </div>
        <div className="client-rp-balance"><span>Бонусный баланс</span><b>{user.rpBalance.toLocaleString("ru-RU")} RP</b><small>100 RP = сутки продвижения</small></div>

        {campaigns.length ? (
          <div className="client-campaign-list">
            {campaigns.map((campaign) => {
              const stats = statsByCampaign.get(campaign.id);
              const views = stats?._sum.currentViews || 0;
              const clips = stats?._count._all || 0;
              const promoted = Boolean(campaign.featuredUntil && campaign.featuredUntil > new Date());
              const boostable = ["ACTIVE", "LOW_BUDGET"].includes(campaign.status);
              return (
                <article className="client-campaign-row" key={campaign.id}>
                  <Link className="client-campaign-main" href={`/campaigns/${campaign.id}`} aria-label={`Открыть ${campaign.title}`} />
                  <div>
                    <strong>{campaign.title}</strong>
                    <span>{promoted ? `Featured до ${campaign.featuredUntil?.toLocaleString("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}` : campaign.status === "ACTIVE" ? "Активна" : campaign.status === "LOW_BUDGET" ? "Заканчивается бюджет" : "Не активна"}</span>
                  </div>
                  <span><b>{clips}</b> роликов</span>
                  <span><b>{compactNumber(views)}</b> просмотров</span>
                  <span><b>{rub(campaign.remainingBudgetCents)}</b> осталось</span>
                  {boostable ? <form className="client-campaign-boost" action={boostCampaignWithRpAction}>
                    <input type="hidden" name="campaignId" value={campaign.id} />
                    <input type="hidden" name="autoConvert" value="1" />
                    <button type="submit">+24ч · 100 RP{user.rpBalance < 100 ? " (доплата с баланса)" : ""}</button>
                  </form> : null}
                  <ArrowRight size={18} />
                </article>
              );
            })}
          </div>
        ) : (
          <div className="lb-empty">
            <BriefcaseBusiness size={30} />
            <b>Кампаний пока нет</b>
            <p>Создайте первый заказ, добавьте исходное видео и укажите оплату за результат.</p>
            <Link className="btn btn-primary" href="/campaigns/new">Создать кампанию</Link>
          </div>
        )}
      </section>
    </AppShell>
  );
}

export default async function CampaignsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await getCurrentUser();
  if (user && await getActiveRoleMode(user) === "client") {
    return <ClientCampaignsView user={user} />;
  }

  const params = await searchParams;
  const query = normalize(params.q).toLowerCase();
  const category = normalize(params.category) || "all";
  const sort = normalize(params.sort) || "promoted";
  const deadline = normalize(params.deadline) || "any";
  const initialPage = Math.max(1, Number(params.page || 1));
  const pageSize = 12;

  const [baseCampaigns, active] = await Promise.all([getCampaigns(), loadActiveOrder()]);
  const filtered = baseCampaigns
    .filter((campaign) => {
      const text = `${campaign.title} ${campaign.description} ${campaign.niche || ""} ${campaign.owner.name}`.toLowerCase();
      const daysLeft = Math.max(1, Math.ceil((timeOf(campaign.deadline) - Date.now()) / 86400000));
      return (!query || text.includes(query)) && categoryMatch(campaign, category) && deadlineMatch(daysLeft, deadline);
    })
    .sort((a, b) => {
      if (sort === "promoted") {
        const visibilityDelta = Number(b.visibility === "FEATURED" || Boolean(b.featuredUntil && timeOf(b.featuredUntil) > Date.now()))
          - Number(a.visibility === "FEATURED" || Boolean(a.featuredUntil && timeOf(a.featuredUntil) > Date.now()));
        if (visibilityDelta) return visibilityDelta;
        return timeOf(b.createdAt) - timeOf(a.createdAt);
      }
      if (sort === "rate") return b.cpmRateCents - a.cpmRateCents;
      if (sort === "pay") return expectedPayout(b) - expectedPayout(a);
      if (sort === "deadline") return timeOf(a.deadline) - timeOf(b.deadline);
      return timeOf(b.createdAt) - timeOf(a.createdAt);
    });

  const topPayout = Math.max(0, ...filtered.map(expectedPayout));
  const medianRate = median(filtered.map((campaign) => campaign.cpmRateCents));
  const quickCount = filtered.filter((campaign) => Math.ceil((timeOf(campaign.deadline) - Date.now()) / 86400000) <= 3).length;
  const cards: MarketplaceCard[] = filtered.map((campaign) => ({
    id: campaign.id,
    title: campaign.title,
    description: campaign.description,
    niche: campaign.niche,
    cpmRateCents: campaign.cpmRateCents,
    viewThreshold: campaign.viewThreshold,
    remainingBudgetCents: campaign.remainingBudgetCents,
    featured: campaign.visibility === "FEATURED" || Boolean(campaign.featuredUntil && timeOf(campaign.featuredUntil) > Date.now()),
    owner: { name: campaign.owner.name, handle: campaign.owner.handle, avatar: campaign.owner.avatar },
    submissions: campaign._count.submissions,
    deadlineMs: timeOf(campaign.deadline),
    createdAtMs: timeOf(campaign.createdAt)
  }));

  // Shown only on the first page; the client browser toggles it without re-rendering.
  const page1Top = (
    <>
      {active ? (
        <Link className={`active-order ao-${active.statusKey}`} href={active.href}>
          <span className="ao-glow" aria-hidden="true" />
          <span className="ao-flicker" aria-hidden="true" />
          <div className="ao-head">
            <span className="ao-eyebrow"><Sparkles size={14} /> Твой активный заказ</span>
            <span className="ao-status">{active.label}</span>
          </div>
          <h2 className="ao-title">{active.title}</h2>
          <div className="ao-progress">
            <div className="ao-bar"><i style={{ width: `${active.pct}%` }} /></div>
            <span>
              {active.status === "ACCEPTED"
                ? "Выложи ролик, чтобы начать считать просмотры"
                : `${compactNumber(active.views)} / ${compactNumber(active.threshold)} просмотров`}
            </span>
          </div>
          <div className="ao-foot">
            <span className="ao-payout"><b>{rub(active.payout)}</b> к выплате</span>
            <span className="ao-cta">{active.cta} <ArrowRight size={16} /></span>
          </div>
        </Link>
      ) : null}
      <CampaignGuide variant="worker" initiallyCollapsed={Boolean(user?.marketGuideSeenAt)} persistSeen={Boolean(user)} />
    </>
  );

  const alwaysTop = (
    <>
      <header className="mk-head">
        <div>
          <span className="mk-eyebrow"><BriefcaseBusiness size={14} /> Биржа заказов</span>
          <h1>Найди заказ, который сделаешь сегодня</h1>
          <p>Заказчик ставит цель по просмотрам — ты делаешь короткий ролик и получаешь оплату за результат.</p>
        </div>
        <Link className="mk-leaders" href="/leaderboard"><Trophy size={16} /> Доска лидеров</Link>
      </header>

      <div className="mk-stats" aria-label="Статистика заказов">
        <span className="mk-stat"><b>{filtered.length}</b> заказов</span>
        <span className="mk-stat"><b>{rub(topPayout)}</b> макс. оплата</span>
        <span className="mk-stat mk-stat--urgent"><b>{quickCount}</b> срочных</span>
      </div>

      <div id="orders"><CampaignFilters
        query={query}
        category={category}
        deadline={deadline}
        sort={sort}
        resultCount={filtered.length}
      /></div>
    </>
  );

  return (
    <AppShell>
      <section className={`section market-screen ${styles.marketplace}`}>
        <MarketplaceBrowser
          cards={cards}
          medianRate={medianRate}
          pageSize={pageSize}
          basePath="/campaigns"
          initialPage={initialPage}
          page1Top={page1Top}
          alwaysTop={alwaysTop}
        />
      </section>
    </AppShell>
  );
}
