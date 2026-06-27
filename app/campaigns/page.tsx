import Link from "next/link";
import { unstable_cache } from "next/cache";
import type { ComponentType } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  BriefcaseBusiness,
  CheckCircle2,
  Clock3,
  Eye,
  Flame,
  Gamepad2,
  Laugh,
  Search,
  SlidersHorizontal,
  Sparkles,
  Trophy,
  Tv,
  Users
} from "lucide-react";
import { AppShell } from "@/components/ui";
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

const categories: Array<[string, string, ComponentType<{ size?: number }>]> = [
  ["all", "Все", Sparkles],
  ["streams", "Стримы", Tv],
  ["humor", "Юмор", Laugh],
  ["games", "Игры", Gamepad2],
  ["business", "Бизнес", BriefcaseBusiness]
];

const difficulties = ["Любая", "Лёгкая", "Средняя", "Сложная"] as const;
const sorts: Array<[string, string]> = [
  ["featured", "Новые"],
  ["pay", "Оплата"],
  ["deadline", "Срок"]
];

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

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function shortText(text: string, limit = 128) {
  return text.length > limit ? `${text.slice(0, limit).trim()}…` : text;
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

        <div className="market-head">
          <div>
            <span className="eyebrow">Биржа заказов</span>
            <h1>Найди ролик, который сможешь сделать сегодня</h1>
            <p>Заказчик ставит цель по просмотрам, ты делаешь короткое видео и получаешь оплату после проверки результата.</p>
          </div>
        </div>

        <div className="market-stats" aria-label="Статистика заказов">
          <span><b>{filtered.length}</b> активных</span>
          <span><b>{rub(topPayout)}</b> максимум</span>
          <span><b>{quickCount}</b> срочных</span>
        </div>

        <nav className="market-discovery" aria-label="Рейтинги">
          <Link href="/leaderboard"><Trophy size={16} /> Доска лидеров недели</Link>
        </nav>

        <form className="market-search" action="/campaigns">
          <label>
            <Search size={20} />
            <input name="q" defaultValue={query} placeholder="Поиск по заказам, авторам, нишам" />
          </label>
          <button type="submit"><SlidersHorizontal size={18} /> Найти</button>
          {category !== "all" ? <input type="hidden" name="category" value={category} /> : null}
          {sort !== "featured" ? <input type="hidden" name="sort" value={sort} /> : null}
          {difficulty !== "Любая" ? <input type="hidden" name="difficulty" value={difficulty} /> : null}
        </form>

        <nav className="market-tabs" aria-label="Категории заказов">
          {categories.map(([key, label, Icon]) => (
            <Link className={category === key ? "active" : ""} href={makeHref({ category: key === "all" ? "" : key, page: "" })} key={key}>
              <Icon size={16} /> {label}
            </Link>
          ))}
        </nav>

        <div className="market-tools">
          <div>
            <span>Сложность</span>
            {difficulties.map((item) => (
              <Link className={difficulty === item ? "active" : ""} href={makeHref({ difficulty: item === "Любая" ? "" : item, page: "" })} key={item}>
                {item}
              </Link>
            ))}
          </div>
          <div>
            <span>Сортировка</span>
            {sorts.map(([key, label]) => (
              <Link className={sort === key ? "active" : ""} href={makeHref({ sort: key === "featured" ? "" : key, page: "" })} key={key}>
                {label}
              </Link>
            ))}
          </div>
        </div>

        <div className="market-list">
          {campaigns.map((campaign) => {
            const daysLeft = Math.max(1, Math.ceil((timeOf(campaign.deadline) - Date.now()) / 86400000));
            const difficulty = difficultyOf(campaign);
            const payout = expectedPayout(campaign);
            return (
              <Link className="market-order" href={`/campaigns/${campaign.id}`} key={campaign.id}>
                <div className="order-avatar">{initials(campaign.owner.name)}</div>
                <div className="order-main">
                  <div className="order-title">
                    <h2>{campaign.title}</h2>
                    {campaign.visibility === "FEATURED" ? <span><Flame size={14} /> Топ</span> : null}
                  </div>
                  <p>{shortText(campaign.description)}</p>
                  <div className="order-tags">
                    <span>{campaign.niche || "Видео"}</span>
                    <span>{campaign.owner.name}</span>
                    <span className={difficulty === "Сложная" ? "warn" : difficulty === "Лёгкая" ? "good" : ""}>{difficulty}</span>
                  </div>
                </div>
                <div className="order-side">
                  <strong>{rub(payout)}</strong>
                  <span><Eye size={15} /> {compactNumber(campaign.viewThreshold)}</span>
                  <span><Clock3 size={15} /> {daysLeft} дн.</span>
                  <span><Users size={15} /> {campaign._count.submissions}</span>
                  <em>Открыть</em>
                </div>
              </Link>
            );
          })}
        </div>

        {!campaigns.length ? (
          <div className="market-empty">
            <CheckCircle2 size={28} />
            <h2>Подходящих заказов нет</h2>
            <p>Попробуй убрать фильтр или написать запрос проще.</p>
            <Link className="btn" href="/campaigns">Сбросить</Link>
          </div>
        ) : null}

        <div className="market-pages">
          <Link className={currentPage <= 1 ? "disabled" : ""} href={makeHref({ page: String(Math.max(1, currentPage - 1)) })}>
            Назад
          </Link>
          <span>{currentPage} / {totalPages}</span>
          <Link className={currentPage >= totalPages ? "disabled" : ""} href={makeHref({ page: String(Math.min(totalPages, currentPage + 1)) })}>
            Дальше
          </Link>
        </div>
      </section>
    </AppShell>
  );
}
