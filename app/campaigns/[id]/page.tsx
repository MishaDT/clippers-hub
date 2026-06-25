import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, Check, Clock3, MessageCircle, ShieldCheck, Sparkles, Target, Users, WalletCards } from "lucide-react";
import { AppShell } from "@/components/ui";
import { CampaignChat } from "@/components/campaign-chat";
import { joinCampaignAction } from "@/app/actions";
import { getCurrentUser } from "@/lib/auth";
import { buildSafePreview } from "@/lib/chat-safety";
import { parseJson } from "@/lib/json";
import { compactNumber, expectedPayout, rub } from "@/lib/money";
import { prisma } from "@/lib/prisma";

const covers = [
  "/assets/gaming-order.png",
  "/assets/podcast-order.png",
  "/assets/marketplace-thumb.png",
  "/assets/hero-studio.png",
  "/assets/creator-nika.png"
];

function coverFor(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return covers[hash % covers.length];
}

function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function taskList(description: string) {
  const tasks = ["Выбрать 3-5 сильных моментов", "Сделать вертикальный ролик 9:16", "Добавить субтитры и цепляющий первый кадр"];
  if (!description.toLowerCase().includes("тег")) tasks.push("Добавить обязательные теги из правил");
  return tasks;
}

function shortDate(value: Date) {
  return value.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

function submissionStatus(status?: string) {
  const labels: Record<string, string> = {
    ACCEPTED: "Заказ взят",
    POSTED: "Работа отправлена",
    VERIFIED: "Идет трекинг",
    THRESHOLD_MET: "Цель достигнута",
    SETTLING: "Проверка выплаты",
    PAID: "Оплачено",
    REJECTED: "Нужна проверка"
  };
  return labels[status || ""] || "Работа еще не начата";
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
      sourcePlatform: true,
      allowedPlatformsJson: true,
      rulesJson: true,
      cpmRateCents: true,
      viewThreshold: true,
      deadline: true,
      niche: true,
      trackingPrefix: true,
      owner: { select: { id: true, name: true, handle: true } },
      _count: { select: { submissions: true } }
    }
  });
  if (!campaign) notFound();

  const isOwner = currentUser?.id === campaign.ownerId;
  const [submission, chatThread] = currentUser
    ? await Promise.all([
        prisma.submission.findFirst({
          where: { campaignId: campaign.id, ...(isOwner ? {} : { workerId: currentUser.id }) },
          include: { worker: { select: { id: true, name: true, handle: true } }, videoChecks: { orderBy: { createdAt: "desc" }, take: 1 } },
          orderBy: { updatedAt: "desc" }
        }),
        prisma.chatThread.findFirst({
          where: { campaignId: campaign.id, OR: [{ clientId: currentUser.id }, { workerId: currentUser.id }] },
          include: {
            client: { select: { id: true, name: true } },
            worker: { select: { id: true, name: true, handle: true } },
            messages: { include: { sender: { select: { id: true, name: true } } }, orderBy: { createdAt: "asc" }, take: 60 }
          },
          orderBy: { updatedAt: "desc" }
        })
      ])
    : [null, null];

  const rules = parseJson<{ requiredTags?: string[]; bans?: string[]; watermarkBonus?: boolean }>(campaign.rulesJson, {});
  const platforms = parseJson<string[]>(campaign.allowedPlatformsJson, []);
  const expected = expectedPayout(campaign.viewThreshold, campaign.cpmRateCents);
  const daysLeft = Math.max(1, Math.ceil((campaign.deadline.getTime() - Date.now()) / 86400000));
  const safeSource = buildSafePreview(campaign.sourceUrl);
  const cover = coverFor(campaign.id);
  const tasks = taskList(campaign.description);
  const progressSteps = [
    { title: "Взят", done: Boolean(submission), active: submission?.status === "ACCEPTED" },
    { title: "Ссылка", done: ["POSTED", "VERIFIED", "THRESHOLD_MET", "SETTLING", "PAID"].includes(submission?.status || ""), active: submission?.status === "POSTED" },
    { title: "Трекинг", done: ["THRESHOLD_MET", "SETTLING", "PAID"].includes(submission?.status || ""), active: ["VERIFIED", "POSTED"].includes(submission?.status || "") },
    { title: "Выплата", done: submission?.status === "PAID", active: ["THRESHOLD_MET", "SETTLING"].includes(submission?.status || "") }
  ];
  const videoCheck = submission?.videoChecks[0];

  return (
    <AppShell>
      <section className="campaign-detail-clean">
        <Link className="detail-back" href="/campaigns"><ArrowLeft size={17} /> К заказам</Link>

        <div className="detail-clean-grid">
          <main className="detail-clean-main">
            <div className="detail-clean-cover" style={{ backgroundImage: `linear-gradient(180deg, rgba(7,7,9,.1), rgba(7,7,9,.82)), url('${cover}')` }}>
              <span className="campaign-pill"><Sparkles size={14} /> {campaign.niche || "Видео"}</span>
              <b>до {rub(expected)}</b>
            </div>

            <div className="detail-clean-title">
              <h1>{campaign.title}</h1>
              <p>{campaign.description}</p>
            </div>

            <section className="campaign-owner clean">
              <span className="owner-avatar">{initials(campaign.owner.name)}</span>
              <div>
                <b>{campaign.owner.name}</b>
                <span>Заказ {campaign.trackingPrefix}</span>
              </div>
              {safeSource ? <a href={safeSource.url} target="_blank" rel="noreferrer">Источник <ArrowUpRight size={15} /></a> : null}
            </section>

            <section className="campaign-panel">
              <h2>Что сделать</h2>
              <div className="task-list">
                {tasks.map((task) => (
                  <div key={task}><Check size={17} /> <span>{task}</span></div>
                ))}
              </div>
            </section>

            <section className="campaign-panel">
              <h2>Правила</h2>
              <div className="rule-grid compact-rules">
                <div><b>Площадки</b><span>{platforms.length ? platforms.join(", ") : "TikTok, Shorts, Reels, VK"}</span></div>
                <div><b>Теги</b><span>{rules.requiredTags?.length ? rules.requiredTags.join(", ") : "#reelpay"}</span></div>
                <div><b>Нельзя</b><span>{rules.bans?.slice(0, 3).join(", ") || "NSFW, оскорбления, политика"}</span></div>
                <div><b>Watermark</b><span>{rules.watermarkBonus ? "Нужен ReelPay watermark" : "Не обязателен"}</span></div>
              </div>
            </section>
          </main>

          <aside className="campaign-action clean">
            <div className="action-card">
              <span className="action-label">Оплата за результат</span>
              <strong>{rub(expected)}</strong>
              <div className="action-metrics">
                <span><b>{compactNumber(campaign.viewThreshold)}</b><em>цель</em></span>
                <span><b>{rub(campaign.cpmRateCents)}</b><em>за 1000</em></span>
                <span><b>{daysLeft} дн.</b><em>срок</em></span>
                <span><b>{campaign._count.submissions}</b><em>откликов</em></span>
              </div>

              {isOwner ? (
                <Link className="btn btn-primary" href="/profile">Смотреть мои заказы</Link>
              ) : submission ? (
                <Link className="btn btn-primary" href="/upload">Выложить работу</Link>
              ) : (
                <form action={joinCampaignAction}>
                  <input type="hidden" name="campaignId" value={campaign.id} />
                  <button className="join-main" type="submit">Откликнуться</button>
                </form>
              )}

              <small><ShieldCheck size={14} /> Выплата после проверки цели и fraud-score.</small>
              <small><Clock3 size={14} /> Просмотры обновляются синхронизацией.</small>
            </div>
          </aside>
        </div>

        {submission ? (
          <section className="workspace-card">
            <div className="workspace-head">
              <div>
                <span>Рабочая зона</span>
                <h2>{submissionStatus(submission.status)}</h2>
              </div>
              <Link className="btn" href="/chats"><MessageCircle size={16} /> Все чаты</Link>
            </div>
            <div className="workspace-progress">
              {progressSteps.map((step) => (
                <span className={step.done ? "done" : step.active ? "active" : ""} key={step.title}>{step.title}</span>
              ))}
            </div>
            <div className="workspace-stats">
              <span><b>{compactNumber(submission.currentViews)}</b><em>просмотры</em></span>
              <span><b>{compactNumber(submission.currentLikes)}</b><em>лайки</em></span>
              <span><b>{submission.fraudScore}%</b><em>риск</em></span>
              <span><b>{videoCheck ? videoCheck.status : "нет"}</b><em>watermark</em></span>
            </div>
          </section>
        ) : null}

        {chatThread && currentUser ? (
          <CampaignChat
            threadId={chatThread.id}
            currentUserId={currentUser.id}
            peerName={currentUser.id === chatThread.clientId ? chatThread.worker.name : chatThread.client.name}
            progress={{
              statusLabel: submissionStatus(submission?.status),
              views: compactNumber(submission?.currentViews || 0),
              target: compactNumber(campaign.viewThreshold),
              fraudScore: submission?.fraudScore || 0,
              steps: progressSteps
            }}
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
