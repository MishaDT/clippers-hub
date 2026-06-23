import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Link2,
  Play,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
  WalletCards
} from "lucide-react";
import { AppShell } from "@/components/ui";
import { joinCampaignAction } from "@/app/actions";
import { prisma } from "@/lib/prisma";
import { parseJson } from "@/lib/json";
import { compactNumber, rub } from "@/lib/money";

function timeOf(value: Date | string) {
  return value instanceof Date ? value.getTime() : new Date(value).getTime();
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

function fallbackTasks(description: string) {
  const base = [
    "Выбрать 3-5 самых сильных моментов",
    "Сделать вертикальный формат 9:16",
    "Добавить крупные субтитры и цепляющий первый кадр"
  ];
  if (description.toLowerCase().includes("субтит")) return base;
  return [...base, "Подобрать короткий заголовок под площадку"];
}

export default async function CampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const campaign = await prisma.campaign.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      description: true,
      sourceUrl: true,
      sourcePlatform: true,
      allowedPlatformsJson: true,
      rulesJson: true,
      cpmRateCents: true,
      viewThreshold: true,
      deadline: true,
      niche: true,
      trackingPrefix: true,
      owner: { select: { name: true, handle: true } },
      _count: { select: { submissions: true } },
      submissions: {
        select: { currentViews: true },
        orderBy: { currentViews: "desc" },
        take: 12
      }
    }
  });
  if (!campaign) notFound();

  const rules = parseJson<{ requiredTags?: string[]; bans?: string[] }>(campaign.rulesJson, {});
  const platforms = parseJson<string[]>(campaign.allowedPlatformsJson, []);
  const expected = Math.round((campaign.viewThreshold / 1000) * campaign.cpmRateCents * 0.89);
  const totalViews = campaign.submissions.reduce((sum, item) => sum + item.currentViews, 0);
  const daysLeft = Math.max(1, Math.ceil((timeOf(campaign.deadline) - Date.now()) / 86400000));
  const tasks = fallbackTasks(campaign.description);

  return (
    <AppShell hideBottomNav>
      <section className="section campaign-focus">
        <Link className="detail-back" href="/campaigns">
          <ArrowLeft size={17} /> К заказам
        </Link>

        <div className="campaign-focus-grid">
          <article className="campaign-main">
            <div
              className="campaign-media"
              style={{
                backgroundImage:
                  "linear-gradient(180deg, rgba(0,0,0,.06), rgba(0,0,0,.68)), url(/assets/gaming-order.png)"
              }}
            >
              <span><Play size={22} /></span>
              <b>{compactNumber(totalViews || campaign.viewThreshold * 24)} просмотров в похожих работах</b>
            </div>

            <div className="campaign-title-block">
              <span className="campaign-pill"><Sparkles size={15} /> {campaign.niche || "Видео"}</span>
              <h1>{campaign.title}</h1>
              <p>{campaign.description}</p>
            </div>

            <div className="campaign-owner">
              <div className="owner-avatar">{initials(campaign.owner.name)}</div>
              <div>
                <b>{campaign.owner.name}</b>
                <span>Заказ {campaign.trackingPrefix}</span>
              </div>
              <a href={campaign.sourceUrl || "#"} target="_blank" rel="noreferrer">
                <Link2 size={16} /> Исходник
              </a>
            </div>

            <section className="campaign-panel">
              <h2>Что нужно сделать</h2>
              <div className="task-list">
                {tasks.map((task) => (
                  <div key={task}><CheckCircle2 size={18} /><span>{task}</span></div>
                ))}
              </div>
            </section>

            <section className="campaign-panel">
              <h2>Правила публикации</h2>
              <div className="rule-grid">
                <div>
                  <b>Площадки</b>
                  <span>{platforms.length ? platforms.join(", ") : "TikTok, Shorts, Reels, VK Clips"}</span>
                </div>
                <div>
                  <b>Теги</b>
                  <span>{rules.requiredTags?.length ? rules.requiredTags.join(", ") : "#reelpay, #clips"}</span>
                </div>
                <div>
                  <b>Нельзя</b>
                  <span>{rules.bans?.slice(0, 3).join(", ") || "NSFW, политика, оскорбления"}</span>
                </div>
                <div>
                  <b>Проверка</b>
                  <span>48 часов после достижения цели</span>
                </div>
              </div>
            </section>
          </article>

          <aside className="campaign-action">
            <div className="action-card">
              <span className="action-label">Оплата за результат</span>
              <strong>{rub(expected)}</strong>
              <p>примерно получит клиппер, если ролик доберет цель.</p>

              <div className="action-metrics">
                <span><Target size={17} /><b>{compactNumber(campaign.viewThreshold)}</b><em>цель</em></span>
                <span><WalletCards size={17} /><b>{rub(campaign.cpmRateCents)}</b><em>за 1000</em></span>
                <span><CalendarDays size={17} /><b>{daysLeft} дн.</b><em>осталось</em></span>
                <span><Users size={17} /><b>{campaign._count.submissions}</b><em>откликов</em></span>
              </div>

              <div className="safe-note">
                <ShieldCheck size={18} />
                <div>
                  <b>Отклик не обязывает</b>
                  <span>Сначала возьмешь заказ, потом загрузишь ссылку на готовый ролик.</span>
                </div>
              </div>

              <form action={joinCampaignAction}>
                <input type="hidden" name="campaignId" value={campaign.id} />
                <button className="join-main" type="submit">Откликнуться</button>
              </form>

              <small><Clock3 size={14} /> Выплата после проверки просмотров и антифрода.</small>
            </div>
          </aside>
        </div>
      </section>
    </AppShell>
  );
}
