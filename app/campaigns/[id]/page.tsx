import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowUpRight,
  CalendarDays,
  Check,
  Clock3,
  ListChecks,
  ScrollText,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
  WalletCards
} from "lucide-react";
import { AppShell } from "@/components/ui";
import { CampaignChat } from "@/components/campaign-chat";
import { joinCampaignAction } from "@/app/actions";
import { getCurrentUser } from "@/lib/auth";
import { buildSafePreview } from "@/lib/chat-safety";
import { prisma } from "@/lib/prisma";
import { parseJson } from "@/lib/json";
import { compactNumber, expectedPayout, rub } from "@/lib/money";

const COVERS = [
  "/assets/gaming-order.png",
  "/assets/podcast-order.png",
  "/assets/marketplace-thumb.png",
  "/assets/hero-studio.png",
  "/assets/creator-nika.png"
];

function coverFor(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return COVERS[hash % COVERS.length];
}

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
  const tasks = [
    "Выбрать 3-5 сильных моментов",
    "Сделать вертикальный ролик 9:16",
    "Добавить субтитры и цепляющий первый кадр"
  ];

  if (!description.toLowerCase().includes("субтит")) {
    tasks.push("Подобрать короткий заголовок");
  }

  return tasks;
}

function shortDate(value: Date) {
  return value.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

function stepClass(done: boolean, active: boolean) {
  if (done) return "done";
  if (active) return "active";
  return "";
}

export default async function CampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const currentUser = await getCurrentUser();
  const campaign = await prisma.campaign.findUnique({
    where: { id },
    select: {
      id: true,
      ownerId: true,
      title: true,
      description: true,
      sourceUrl: true,
      allowedPlatformsJson: true,
      rulesJson: true,
      cpmRateCents: true,
      viewThreshold: true,
      deadline: true,
      niche: true,
      trackingPrefix: true,
      owner: { select: { id: true, name: true } },
      _count: { select: { submissions: true } }
    }
  });
  if (!campaign) notFound();

  const rules = parseJson<{ requiredTags?: string[]; bans?: string[] }>(campaign.rulesJson, {});
  const platforms = parseJson<string[]>(campaign.allowedPlatformsJson, []);
  const expected = expectedPayout(campaign.viewThreshold, campaign.cpmRateCents);
  const daysLeft = Math.max(1, Math.ceil((timeOf(campaign.deadline) - Date.now()) / 86400000));
  const tasks = fallbackTasks(campaign.description);
  const cover = coverFor(campaign.id);
  const sourcePreview = buildSafePreview(campaign.sourceUrl);
  const isOwner = currentUser?.id === campaign.ownerId;
  const collabSubmission = currentUser
    ? await prisma.submission.findFirst({
        where: { campaignId: campaign.id, ...(isOwner ? {} : { workerId: currentUser.id }) },
        include: { worker: { select: { id: true, name: true, handle: true } } },
        orderBy: { updatedAt: "desc" }
      })
    : null;
  const chatThread = currentUser
    ? await prisma.chatThread.findFirst({
        where: { campaignId: campaign.id, OR: [{ clientId: currentUser.id }, { workerId: currentUser.id }] },
        include: {
          client: { select: { id: true, name: true } },
          worker: { select: { id: true, name: true, handle: true } },
          messages: { include: { sender: { select: { id: true, name: true } } }, orderBy: { createdAt: "asc" }, take: 60 }
        },
        orderBy: { updatedAt: "desc" }
      })
    : null;
  const postPreview = collabSubmission?.postUrl && !collabSubmission.postUrl.includes("example.com") ? buildSafePreview(collabSubmission.postUrl) : null;
  const progressSteps = [
    { key: "ACCEPTED", title: "Заказ взят", done: Boolean(collabSubmission), active: collabSubmission?.status === "ACCEPTED" },
    { key: "POSTED", title: "Ссылка сдана", done: ["POSTED", "VERIFIED", "THRESHOLD_MET", "SETTLING", "PAID"].includes(collabSubmission?.status || ""), active: collabSubmission?.status === "POSTED" },
    { key: "TRACKING", title: "Идет трекинг", done: ["THRESHOLD_MET", "SETTLING", "PAID"].includes(collabSubmission?.status || ""), active: ["VERIFIED", "POSTED"].includes(collabSubmission?.status || "") },
    { key: "PAID", title: "Выплата", done: collabSubmission?.status === "PAID", active: ["THRESHOLD_MET", "SETTLING"].includes(collabSubmission?.status || "") }
  ];

  return (
    <AppShell>
      <section className="cd">
        <header
          className="cd-hero"
          style={{
            backgroundImage: `linear-gradient(180deg, rgba(9,9,11,.04) 0%, rgba(9,9,11,.34) 46%, rgba(9,9,11,.94) 100%), url('${cover}')`
          }}
        >
          <div className="cd-hero-top">
            <Link className="cd-iconbtn" href="/campaigns" aria-label="К заказам">
              <ArrowLeft size={19} />
            </Link>
            <a
              className="cd-iconbtn"
              href={campaign.sourceUrl || "#"}
              target="_blank"
              rel="noreferrer"
              aria-label="Открыть исходник"
            >
              <ArrowUpRight size={19} />
            </a>
          </div>
          <div className="cd-hero-bottom">
            <span className="cd-chip">
              <Sparkles size={14} /> {campaign.niche || "Видео"}
            </span>
            <span className="cd-pay-badge">до {rub(expected)}</span>
          </div>
        </header>

        <div className="cd-head">
          <h1 className="cd-title">{campaign.title}</h1>
          <p className="cd-sub">{campaign.description}</p>

          <div className="cd-owner">
            <span className="cd-owner-ava">{initials(campaign.owner.name)}</span>
            <div className="cd-owner-meta">
              <b>{campaign.owner.name}</b>
              <span>Заказ {campaign.trackingPrefix}</span>
            </div>
            <a className="cd-owner-src" href={campaign.sourceUrl || "#"} target="_blank" rel="noreferrer">
              исходник <ArrowUpRight size={15} />
            </a>
          </div>
        </div>

        <div className="cd-meta">
          <div className="cd-meta-item">
            <Target size={17} />
            <b>{compactNumber(campaign.viewThreshold)}</b>
            <em>цель просмотров</em>
          </div>
          <div className="cd-meta-item">
            <WalletCards size={17} />
            <b>{rub(campaign.cpmRateCents)}</b>
            <em>за 1000</em>
          </div>
          <div className="cd-meta-item">
            <CalendarDays size={17} />
            <b>{daysLeft} дн.</b>
            <em>до дедлайна</em>
          </div>
          <div className="cd-meta-item">
            <Users size={17} />
            <b>{campaign._count.submissions}</b>
            <em>откликов</em>
          </div>
        </div>

        <div className="cd-grid">
          <div className="cd-body">
            <section className="cd-block">
              <h2>
                <ListChecks size={19} /> Что нужно сделать
              </h2>
              <ul className="cd-todo">
                {tasks.map((task) => (
                  <li key={task}>
                    <span className="cd-tick">
                      <Check size={13} strokeWidth={3} />
                    </span>
                    {task}
                  </li>
                ))}
              </ul>
            </section>

            <section className="cd-block">
              <h2>
                <ScrollText size={19} /> Правила
              </h2>
              <div className="cd-rules">
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
                  <span>48 часов после цели</span>
                </div>
              </div>
            </section>
          </div>

          <aside className="cd-action">
            <div className="cd-action-card">
              <span className="cd-action-eyebrow">Оплата за результат</span>
              <strong className="cd-amount">{rub(expected)}</strong>
              <p>если ролик наберёт нужные просмотры.</p>

              <form action={joinCampaignAction}>
                <input type="hidden" name="campaignId" value={campaign.id} />
                <button className="cd-apply" type="submit">
                  <Sparkles size={18} /> Откликнуться
                </button>
              </form>

              <small>
                <ShieldCheck size={14} /> Отклик не обязывает сдавать работу сразу.
              </small>
              <small>
                <Clock3 size={14} /> Выплата после проверки просмотров.
              </small>
            </div>
          </aside>
        </div>

        <section className="collab-grid">
          {sourcePreview ? (
            <div className="collab-card preview-card">
              <div className="collab-head">
                <div>
                  <span>Безопасное превью</span>
                  <h2>Исходный материал</h2>
                </div>
                <a className="chat-refresh" href={sourcePreview.url} target="_blank" rel="noreferrer"><ArrowUpRight size={17} /></a>
              </div>
              <a className="source-preview" href={sourcePreview.url} target="_blank" rel="noreferrer">
                <span>{sourcePreview.platform}</span>
                <b>{campaign.title}</b>
                <small>{sourcePreview.host}</small>
              </a>
            </div>
          ) : null}

          <div className="collab-card progress-card">
            <div className="collab-head">
              <div>
                <span>Карта выполнения</span>
                <h2>{collabSubmission ? `@${collabSubmission.worker.handle}` : "Исполнитель еще не выбран"}</h2>
              </div>
              <b className="live-pill">Live</b>
            </div>
            <div className="progress-map">
              {progressSteps.map((step) => (
                <div className={`progress-node ${stepClass(step.done, step.active)}`} key={step.key}>
                  <i />
                  <span>{step.title}</span>
                </div>
              ))}
            </div>
            <div className="live-stats">
              <span><b>{compactNumber(collabSubmission?.currentViews || 0)}</b><em>просмотры</em></span>
              <span><b>{compactNumber(collabSubmission?.currentLikes || 0)}</b><em>лайки</em></span>
              <span><b>{collabSubmission?.fraudScore ?? 0}%</b><em>fraud</em></span>
            </div>
            {postPreview ? (
              <a className="safe-preview wide" href={postPreview.url} target="_blank" rel="noreferrer">
                <b>{postPreview.title}</b>
                <span>{postPreview.host}</span>
              </a>
            ) : (
              <p className="muted">После сдачи ссылки здесь появится превью ролика и live-статистика просмотров.</p>
            )}
          </div>
        </section>

        {chatThread && currentUser ? (
          <CampaignChat
            threadId={chatThread.id}
            currentUserId={currentUser.id}
            peerName={currentUser.id === chatThread.clientId ? chatThread.worker.name : chatThread.client.name}
            messages={chatThread.messages.map((message) => {
              const meta = parseJson<{ urls?: string[] }>(message.metadataJson, {});
              return {
                id: message.id,
                senderId: message.senderId,
                senderName: message.sender.name,
                body: message.body,
                type: message.type,
                createdAt: shortDate(message.createdAt),
                previews: (meta.urls || []).map(buildSafePreview).filter(Boolean) as Array<{ url: string; host: string; platform: string; title: string }>
              };
            })}
          />
        ) : null}
      </section>
    </AppShell>
  );
}
