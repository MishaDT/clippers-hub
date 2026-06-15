import Link from "next/link";
import { CalendarDays, Eye, Gamepad2, Laugh, Search, SlidersHorizontal, TrendingUp, Tv, BriefcaseBusiness } from "lucide-react";
import { AppShell, Card, Tag } from "@/components/ui";
import { prisma } from "@/lib/prisma";
import { parseJson } from "@/lib/json";
import { compactNumber, rub } from "@/lib/money";

const images = [
  "/assets/gaming-order.png",
  "/assets/podcast-order.png",
  "/assets/marketplace-thumb.png",
  "/assets/hero-studio.png",
  "/assets/creator-nika.png",
  "https://picsum.photos/seed/reelpay-stream/520/520",
  "https://picsum.photos/seed/reelpay-business/520/520",
  "https://picsum.photos/seed/reelpay-podcast/520/520",
  "https://picsum.photos/seed/reelpay-sport/520/520",
  "https://picsum.photos/seed/reelpay-food/520/520",
  "https://picsum.photos/seed/reelpay-travel/520/520",
  "https://picsum.photos/seed/reelpay-music/520/520",
  "https://picsum.photos/seed/reelpay-design/520/520",
  "https://picsum.photos/seed/reelpay-edu/520/520",
  "https://picsum.photos/seed/reelpay-vlog/520/520",
  "https://picsum.photos/seed/reelpay-review/520/520",
  "https://picsum.photos/seed/reelpay-tech/520/520",
  "https://picsum.photos/seed/reelpay-city/520/520"
];
const chips: Array<[string, string, typeof Search]> = [
  ["all", "Все", Search],
  ["streams", "Стримы", Tv],
  ["humor", "Юмор", Laugh],
  ["games", "Игры", Gamepad2],
  ["business", "Бизнес", BriefcaseBusiness]
];

function categoryMatch(campaign: { title: string; description: string; niche: string | null; sourcePlatform: string }, category: string) {
  const text = `${campaign.title} ${campaign.description} ${campaign.niche || ""}`.toLowerCase();
  if (category === "streams") return campaign.sourcePlatform === "TWITCH" || text.includes("стрим");
  if (category === "humor") return text.includes("смеш") || text.includes("юмор") || text.includes("мем");
  if (category === "games") return campaign.niche === "Gaming" || text.includes("game") || text.includes("игр");
  if (category === "business") return ["Business", "Brand", "Finance", "Career", "Design"].includes(campaign.niche || "") || text.includes("бизнес");
  return true;
}

function difficultyOf(index: number) {
  return index % 4 === 0 ? "Сложная" : index % 3 === 0 ? "Средняя" : "Лёгкая";
}

export default async function CampaignsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const query = String(params.q || "").trim().toLowerCase();
  const category = String(params.category || "all");
  const sort = String(params.sort || "featured");
  const difficulty = String(params.difficulty || "any");
  const page = Math.max(1, Number(params.page || 1));
  const pageSize = 8;

  const allCampaigns = await prisma.campaign.findMany({
    include: { owner: true, submissions: true },
    orderBy: [{ visibility: "asc" }, { createdAt: "desc" }]
  });

  const filteredCampaigns = allCampaigns
    .map((campaign, index) => ({ campaign, index, difficulty: difficultyOf(index) }))
    .filter(({ campaign, difficulty: itemDifficulty }) => {
      const text = `${campaign.title} ${campaign.description} ${campaign.niche || ""} ${campaign.owner.name}`.toLowerCase();
      const matchesQuery = !query || text.includes(query);
      const matchesCategory = categoryMatch(campaign, category);
      const matchesDifficulty = difficulty === "any" || itemDifficulty === difficulty;
      return matchesQuery && matchesCategory && matchesDifficulty;
    })
    .sort((a, b) => {
      if (sort === "pay") {
        const payA = Math.round((a.campaign.viewThreshold / 1000) * a.campaign.cpmRateCents * 0.89);
        const payB = Math.round((b.campaign.viewThreshold / 1000) * b.campaign.cpmRateCents * 0.89);
        return payB - payA;
      }
      if (sort === "deadline") return +a.campaign.deadline - +b.campaign.deadline;
      return +b.campaign.createdAt - +a.campaign.createdAt;
    });
  const totalPages = Math.max(1, Math.ceil(filteredCampaigns.length / pageSize));
  const campaigns = filteredCampaigns.slice((page - 1) * pageSize, page * pageSize);

  const makeHref = (next: Record<string, string>) => {
    const url = new URLSearchParams();
    if (query) url.set("q", query);
    if (category !== "all") url.set("category", category);
    if (sort !== "featured") url.set("sort", sort);
    if (difficulty !== "any") url.set("difficulty", difficulty);
    if (page > 1) url.set("page", String(page));
    Object.entries(next).forEach(([key, value]) => value ? url.set(key, value) : url.delete(key));
    const qs = url.toString();
    return qs ? `/campaigns?${qs}` : "/campaigns";
  };

  return (
    <AppShell>
      <section className="section jobs-screen">
        <div className="screen-title">
          <span className="eyebrow">ReelPay</span>
          <h1>Заказы</h1>
        </div>

        <form className="search-row" action="/campaigns">
          <label className="search-box">
            <Search size={21} />
            <input name="q" defaultValue={query} placeholder="Поиск заказов по ключевым словам" />
          </label>
          <button className="filter-button" type="submit" aria-label="Найти"><SlidersHorizontal size={22} /></button>
          {category !== "all" ? <input type="hidden" name="category" value={category} /> : null}
          {sort !== "featured" ? <input type="hidden" name="sort" value={sort} /> : null}
          {difficulty !== "any" ? <input type="hidden" name="difficulty" value={difficulty} /> : null}
        </form>

        <div className="chip-row">
          {chips.map(([key, label, Icon]) => (
            <Link className={category === key ? "active" : ""} href={makeHref({ category: key === "all" ? "" : key, page: "" })} key={key}>
              <Icon size={15} /> {label}
            </Link>
          ))}
        </div>

        <details className="filter-panel">
          <summary><SlidersHorizontal size={17} /> Фильтры и сортировка</summary>
          <div>
            <span>Сложность</span>
            {["any", "Лёгкая", "Средняя", "Сложная"].map((item) => (
              <Link className={difficulty === item ? "active" : ""} href={makeHref({ difficulty: item === "any" ? "" : item, page: "" })} key={item}>{item === "any" ? "Любая" : item}</Link>
            ))}
          </div>
          <div>
            <span>Сортировка</span>
            {[["featured", "Новые"], ["pay", "Оплата"], ["deadline", "Срок"]].map(([key, label]) => (
              <Link className={sort === key ? "active" : ""} href={makeHref({ sort: key === "featured" ? "" : key, page: "" })} key={key}>{label}</Link>
            ))}
          </div>
        </details>

        <div className="jobs-list">
          {campaigns.map(({ campaign, index, difficulty }) => {
            const platforms = parseJson<string[]>(campaign.allowedPlatformsJson, []);
            const expected = Math.round((campaign.viewThreshold / 1000) * campaign.cpmRateCents * 0.89);
            return (
              <Card className="job-list-card" key={campaign.id}>
                <div className="job-thumb" style={{ backgroundImage: `linear-gradient(180deg, rgba(0,0,0,.02), rgba(0,0,0,.42)), url(${images[index % images.length]})` }}>
                  <span>{campaign.niche || platforms[0]}</span>
                </div>
                <div className="job-list-body">
                  <div className="job-list-head">
                    <h2><Link href={`/campaigns/${campaign.id}`}>{campaign.title}</Link></h2>
                    <Tag tone={difficulty === "Сложная" ? "warn" : difficulty === "Лёгкая" ? "good" : "soft"}><TrendingUp size={13} /> {difficulty}</Tag>
                  </div>
                  <p>{campaign.description}</p>
                  <div className="job-meta">
                    <strong>{rub(expected)}</strong>
                    <span><Eye size={15} /> {compactNumber(campaign.viewThreshold)}</span>
                    <span><CalendarDays size={15} /> {Math.max(1, Math.ceil((+campaign.deadline - Date.now()) / 86400000))} дня</span>
                    <Link href={`/campaigns/${campaign.id}`}>Подробнее</Link>
                  </div>
                </div>
              </Card>
            );
          })}
          {!campaigns.length ? (
            <Card className="empty-box">
              <h2>Заказов не найдено</h2>
              <p className="muted">Попробуй убрать фильтр или изменить поисковый запрос.</p>
              <Link className="btn" href="/campaigns">Сбросить фильтры</Link>
            </Card>
          ) : null}
        </div>
        <div className="pagination">
          <Link className={page <= 1 ? "disabled" : ""} href={makeHref({ page: String(Math.max(1, page - 1)) })}>Назад</Link>
          <span>{page} / {totalPages}</span>
          <Link className={page >= totalPages ? "disabled" : ""} href={makeHref({ page: String(Math.min(totalPages, page + 1)) })}>Дальше</Link>
        </div>
      </section>
    </AppShell>
  );
}
