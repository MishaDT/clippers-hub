import Link from "next/link";
import { unstable_cache } from "next/cache";
import {
  ArrowRight,
  ArrowUpRight,
  BriefcaseBusiness,
  CheckCircle2,
  Clock3,
  CircleAlert,
  Eye,
  Megaphone,
  Sparkles,
  TrendingUp,
  Trophy,
  Users
} from "lucide-react";
import { AppShell } from "@/components/ui";
import { boostCampaignWithRpAction } from "@/app/actions";
import { UserAvatar } from "@/components/user-avatar";
import { CampaignFilters } from "./campaign-filters";
import { CampaignGuide } from "./campaign-guide";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { getActiveRoleMode } from "@/lib/role-mode";
import { compactNumber, rub } from "@/lib/money";
import styles from "./marketplace.module.css";
import { MarketplacePagination } from "@/components/marketplace-pagination";

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

function shortText(text: string, limit = 128) {
  return text.length > limit ? `${text.slice(0, limit).trim()}…` : text;
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
  const page = Math.max(1, Number(params.page || 1));
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

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const campaigns = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const topPayout = Math.max(0, ...filtered.map(expectedPayout));
  const medianRate = median(filtered.map((campaign) => campaign.cpmRateCents));
  const quickCount = filtered.filter((campaign) => Math.ceil((timeOf(campaign.deadline) - Date.now()) / 86400000) <= 3).length;

  const makeHref = (next: Record<string, string>) => {
    const url = new URLSearchParams();
    if (query) url.set("q", query);
    if (category !== "all") url.set("category", category);
    if (sort !== "promoted") url.set("sort", sort);
    if (deadline !== "any") url.set("deadline", deadline);
    if (currentPage > 1) url.set("page", String(currentPage));
    Object.entries(next).forEach(([key, value]) => (value ? url.set(key, value) : url.delete(key)));
    const qs = url.toString();
    return qs ? `/campaigns?${qs}` : "/campaigns";
  };

  return (
    <AppShell>
      <section className={`section market-screen ${styles.marketplace}`}>
        {currentPage === 1 && active ? (
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

        {currentPage === 1 ? <CampaignGuide variant="worker" initiallyCollapsed={Boolean(user?.marketGuideSeenAt)} persistSeen={Boolean(user)} /> : null}

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

        {campaigns.length ? (
          <div className="mk-grid">
            {campaigns.map((campaign) => {
              const daysLeft = Math.max(1, Math.ceil((timeOf(campaign.deadline) - Date.now()) / 86400000));
              const payout = expectedPayout(campaign);
              const cpm = Math.round(campaign.cpmRateCents / 100);
              const urgent = daysLeft <= 2;
              const newCampaign = Date.now() - timeOf(campaign.createdAt) <= 48 * 60 * 60 * 1000;
              const rateDelta = medianRate > 0 ? Math.round((campaign.cpmRateCents / medianRate - 1) * 100) : 0;
              const signal = campaign.visibility === "FEATURED" || Boolean(campaign.featuredUntil && timeOf(campaign.featuredUntil) > Date.now())
                ? { cls: "hot", icon: Megaphone, text: "Продвижение", title: "Заказ поднят в выдаче через продвижение" }
                : campaign.remainingBudgetCents < payout
                  ? { cls: "urgent", icon: CircleAlert, text: "Мало бюджета", title: "Остатка бюджета может не хватить на полную выплату" }
                : urgent
                  ? { cls: "urgent", icon: Clock3, text: `${daysLeft} дн.`, title: "Короткий срок до дедлайна" }
                  : rateDelta >= 25
                    ? { cls: "pay", icon: TrendingUp, text: `Ставка +${rateDelta}%`, title: "Сравнение с медианной ставкой текущей выдачи" }
                    : newCampaign
                      ? { cls: "new", icon: Sparkles, text: "Новый", title: "Опубликован меньше 48 часов назад" }
                      : null;
              const SignalIcon = signal?.icon;
              return (
                <Link className="mk-card" href={`/campaigns/${campaign.id}`} key={campaign.id}>
                  <div className="mk-card-top">
                    <div className="mk-client">
                      <UserAvatar
                        avatar={campaign.owner.avatar}
                        name={campaign.owner.name}
                        handle={campaign.owner.handle}
                        size={38}
                      />
                      <div>
                        <strong>{campaign.owner.name}</strong>
                        <span>{campaign.niche || "Видео"}</span>
                      </div>
                    </div>
                    {signal && SignalIcon ? (
                      <span className={`mk-signal mk-signal--${signal.cls}`} title={signal.title}><SignalIcon size={12} /> {signal.text}</span>
                    ) : null}
                  </div>
                  <h2 className="mk-title">{campaign.title}</h2>
                  <p className="mk-desc">{shortText(campaign.description, 120)}</p>
                  <div className="mk-payline">
                    <div className="mk-pay">
                      <b>{rub(payout)}</b>
                      <em>за результат · {cpm} ₽ / 1000</em>
                    </div>
                    <span className="mk-go">Открыть <ArrowRight size={15} /></span>
                  </div>
                  <div className="mk-meta">
                    <span><Eye size={14} /> {compactNumber(campaign.viewThreshold)}</span>
                    <span className={urgent ? "warn" : ""}><Clock3 size={14} /> {daysLeft} дн</span>
                    <span><Users size={14} /> {campaign._count.submissions}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="mk-empty">
            <CheckCircle2 size={28} />
            <b>Подходящих заказов нет</b>
            <p>Попробуй убрать фильтр или написать запрос проще.</p>
            <Link className="btn btn-primary" href="/campaigns">Сбросить фильтры</Link>
          </div>
        )}

        {totalPages > 1 ? (
          <MarketplacePagination
            page={currentPage}
            totalPages={totalPages}
            previousHref={makeHref({ page: String(Math.max(1, currentPage - 1)) })}
            nextHref={makeHref({ page: String(Math.min(totalPages, currentPage + 1)) })}
          />
        ) : null}
      </section>
    </AppShell>
  );
}
