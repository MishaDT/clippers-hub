import Link from "next/link";
import { unstable_cache } from "next/cache";
import {
  ArrowRight,
  ArrowUpRight,
  BriefcaseBusiness,
  CheckCircle2,
  Clock3,
  Eye,
  Flame,
  Sparkles,
  Trophy,
  Users
} from "lucide-react";
import { AppShell } from "@/components/ui";
import { CampaignFilters } from "./campaign-filters";
import { CampaignGuide } from "./campaign-guide";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { getActiveRoleMode } from "@/lib/role-mode";
import { compactNumber, rub } from "@/lib/money";

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
        createdAt: true,
        owner: { select: { name: true, handle: true, avatar: true } },
        _count: { select: { submissions: true } }
      },
      where: { status: { in: ["ACTIVE", "LOW_BUDGET"] } },
      orderBy: [{ visibility: "asc" }, { createdAt: "desc" }],
      take: 80
    }),
  ["campaigns-marketplace-v3"],
  { revalidate: 30 }
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

function difficultyOf(campaign: CampaignItem) {
  const daysLeft = Math.max(1, Math.ceil((timeOf(campaign.deadline) - Date.now()) / 86400000));
  if (campaign.viewThreshold >= 15000 || daysLeft <= 2) return "Сложная";
  if (campaign.viewThreshold >= 9000) return "Средняя";
  return "Лёгкая";
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

function clientAvatar(handle: string, avatar: string | null) {
  return avatar || `https://api.dicebear.com/9.x/adventurer/svg?seed=${encodeURIComponent(handle || "client")}&backgroundColor=transparent`;
}

async function ClientCampaignsView({ userId }: { userId: string }) {
  const campaigns = await prisma.campaign.findMany({
    where: { ownerId: userId },
    select: {
      id: true,
      title: true,
      status: true,
      remainingBudgetCents: true
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
    <AppShell>
      <section className="section market-screen client-campaigns">
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

        {campaigns.length ? (
          <div className="client-campaign-list">
            {campaigns.map((campaign) => {
              const stats = statsByCampaign.get(campaign.id);
              const views = stats?._sum.currentViews || 0;
              const clips = stats?._count._all || 0;
              return (
                <Link className="client-campaign-row" href={`/campaigns/${campaign.id}`} key={campaign.id}>
                  <div>
                    <strong>{campaign.title}</strong>
                    <span>{campaign.status === "ACTIVE" ? "Активна" : campaign.status === "LOW_BUDGET" ? "Заканчивается бюджет" : "Не активна"}</span>
                  </div>
                  <span><b>{clips}</b> роликов</span>
                  <span><b>{compactNumber(views)}</b> просмотров</span>
                  <span><b>{rub(campaign.remainingBudgetCents)}</b> осталось</span>
                  <ArrowRight size={18} />
                </Link>
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
    return <ClientCampaignsView userId={user.id} />;
  }

  const params = await searchParams;
  const query = normalize(params.q).toLowerCase();
  const category = normalize(params.category) || "all";
  const sort = normalize(params.sort) || "featured";
  const difficulty = normalize(params.difficulty) || "Любая";
  const page = Math.max(1, Number(params.page || 1));
  const pageSize = 10;

  const [baseCampaigns, active] = await Promise.all([getCampaigns(), loadActiveOrder()]);
  const filtered = baseCampaigns
    .filter((campaign) => {
      const text = `${campaign.title} ${campaign.description} ${campaign.niche || ""} ${campaign.owner.name}`.toLowerCase();
      const itemDifficulty = difficultyOf(campaign);
      return (!query || text.includes(query)) && categoryMatch(campaign, category) && (difficulty === "Любая" || itemDifficulty === difficulty);
    })
    .sort((a, b) => {
      if (sort === "pay") return expectedPayout(b) - expectedPayout(a);
      if (sort === "deadline") return timeOf(a.deadline) - timeOf(b.deadline);
      return timeOf(b.createdAt) - timeOf(a.createdAt);
    });

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const campaigns = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const topPayout = Math.max(0, ...filtered.map(expectedPayout));
  const quickCount = filtered.filter((campaign) => Math.ceil((timeOf(campaign.deadline) - Date.now()) / 86400000) <= 3).length;

  const makeHref = (next: Record<string, string>) => {
    const url = new URLSearchParams();
    if (query) url.set("q", query);
    if (category !== "all") url.set("category", category);
    if (sort !== "featured") url.set("sort", sort);
    if (difficulty !== "Любая") url.set("difficulty", difficulty);
    if (currentPage > 1) url.set("page", String(currentPage));
    Object.entries(next).forEach(([key, value]) => (value ? url.set(key, value) : url.delete(key)));
    const qs = url.toString();
    return qs ? `/campaigns?${qs}` : "/campaigns";
  };

  return (
    <AppShell>
      <section className="section market-screen">
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

        <CampaignGuide />

        <header className="mk-head">
          <div>
            <span className="mk-eyebrow"><Flame size={14} /> Биржа заказов</span>
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

        <CampaignFilters
          query={query}
          category={category}
          difficulty={difficulty}
          sort={sort}
          resultCount={filtered.length}
        />

        {campaigns.length ? (
          <div className="mk-grid">
            {campaigns.map((campaign) => {
              const daysLeft = Math.max(1, Math.ceil((timeOf(campaign.deadline) - Date.now()) / 86400000));
              const diff = difficultyOf(campaign);
              const payout = expectedPayout(campaign);
              const cpm = Math.round(campaign.cpmRateCents / 100);
              const urgent = daysLeft <= 2;
              const signal = campaign.visibility === "FEATURED"
                ? { cls: "hot", icon: Flame, text: "Топ заказ" }
                : urgent
                  ? { cls: "urgent", icon: Clock3, text: "Срочно" }
                  : topPayout > 0 && payout >= topPayout * 0.7
                    ? { cls: "pay", icon: Sparkles, text: "Выгодный" }
                    : null;
              const SignalIcon = signal?.icon;
              return (
                <Link className="mk-card" href={`/campaigns/${campaign.id}`} key={campaign.id}>
                  <div className="mk-card-top">
                    <div className="mk-client">
                      <img src={clientAvatar(campaign.owner.handle, campaign.owner.avatar)} alt="" loading="lazy" />
                      <div>
                        <strong>{campaign.owner.name}</strong>
                        <span>{campaign.niche || "Видео"}</span>
                      </div>
                    </div>
                    {signal && SignalIcon ? (
                      <span className={`mk-signal mk-signal--${signal.cls}`}><SignalIcon size={12} /> {signal.text}</span>
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
                    <span className={`mk-diff mk-diff--${diff === "Сложная" ? "hard" : diff === "Лёгкая" ? "easy" : "mid"}`}>{diff}</span>
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
          <div className="mk-pages">
            <Link className={currentPage <= 1 ? "disabled" : ""} href={makeHref({ page: String(Math.max(1, currentPage - 1)) })}>Назад</Link>
            <span>{currentPage} / {totalPages}</span>
            <Link className={currentPage >= totalPages ? "disabled" : ""} href={makeHref({ page: String(Math.min(totalPages, currentPage + 1)) })}>Дальше</Link>
          </div>
        ) : null}
      </section>
    </AppShell>
  );
}
