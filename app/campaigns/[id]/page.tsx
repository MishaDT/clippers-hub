import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, Check, CircleAlert, Clock3, Megaphone, MessageCircle, ShieldCheck, Sparkles, Target, Users, WalletCards } from "lucide-react";
import { AppShell } from "@/components/ui";
import { UserAvatar } from "@/components/user-avatar";
import { CampaignChat } from "@/components/campaign-chat";
import { joinCampaignAction } from "@/app/actions";
import { getCurrentUser } from "@/lib/auth";
import { buildSafePreview } from "@/lib/chat-safety";
import { parseJson } from "@/lib/json";
import { compactNumber, expectedPayout, rub } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { getActiveRoleMode } from "@/lib/role-mode";

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

function videoCheckStatus(status?: string) {
  const labels: Record<string, string> = {
    PENDING: "Ожидает",
    NEEDS_REVIEW: "Проверяется",
    PASSED: "Пройдено",
    FAILED: "Не пройдено"
  };
  return labels[status || ""] || "Не запускалась";
}

export default async function CampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const currentUser = await getCurrentUser();
  const mode = currentUser ? await getActiveRoleMode(currentUser) : "worker";
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
      createdAt: true,
      niche: true,
      visibility: true,
      remainingBudgetCents: true,
      trackingPrefix: true,
      owner: { select: { id: true, name: true, handle: true, avatar: true } },
      _count: { select: { submissions: true } }
    }
  });
  if (!campaign) notFound();

  const isOwner = currentUser?.id === campaign.ownerId;
  const [submission, chatThread] = currentUser
    ? await Promise.all([
        prisma.submission.findFirst({
          where: {
            campaignId: campaign.id,
            ...(mode === "client" ? { campaign: { ownerId: currentUser.id } } : { workerId: currentUser.id })
          },
          include: { worker: { select: { id: true, name: true, handle: true } }, videoChecks: { orderBy: { createdAt: "desc" }, take: 1 } },
          orderBy: { updatedAt: "desc" }
        }),
        prisma.chatThread.findFirst({
          where: {
            campaignId: campaign.id,
            ...(mode === "client" ? { clientId: currentUser.id } : { workerId: currentUser.id })
          },
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
  const tasks = taskList(campaign.description);
  const urgent = daysLeft <= 2;
  const signal = campaign.visibility === "FEATURED"
    ? { cls: "hot", Icon: Megaphone, text: "Продвижение" }
    : campaign.remainingBudgetCents < expected
      ? { cls: "urgent", Icon: CircleAlert, text: "Мало бюджета" }
    : urgent
      ? { cls: "urgent", Icon: Clock3, text: `${daysLeft} дн. до дедлайна` }
      : Date.now() - campaign.createdAt.getTime() <= 48 * 60 * 60 * 1000
        ? { cls: "easy", Icon: Sparkles, text: "Новый заказ" }
        : null;
  const progressSteps = [
    { title: "Взят", done: Boolean(submission), active: submission?.status === "ACCEPTED" },
    { title: "Ссылка", done: ["POSTED", "VERIFIED", "THRESHOLD_MET", "SETTLING", "PAID"].includes(submission?.status || ""), active: submission?.status === "POSTED" },
    { title: "Трекинг", done: ["THRESHOLD_MET", "SETTLING", "PAID"].includes(submission?.status || ""), active: ["VERIFIED", "POSTED"].includes(submission?.status || "") },
    { title: "Выплата", done: submission?.status === "PAID", active: ["THRESHOLD_MET", "SETTLING"].includes(submission?.status || "") }
  ];
  const videoCheck = submission?.videoChecks[0];

  return (
    <AppShell>
      <section className="section od">
        <Link className="od-back" href="/campaigns"><ArrowLeft size={16} /> К заказам</Link>

        <div className="od-grid">
          <div className="od-hero">
            <div className="od-brief">
              <span className="od-niche"><Sparkles size={13} /> {campaign.niche || "Видео"}</span>
              <h1>{campaign.title}</h1>
              <p>{campaign.description}</p>
              <div className="od-chips">
                {signal ? <span className={`od-chip od-chip--${signal.cls}`}><signal.Icon size={13} /> {signal.text}</span> : null}
                <span className="od-chip"><Clock3 size={13} /> {daysLeft} дн</span>
                <span className="od-chip"><Target size={13} /> цель {compactNumber(campaign.viewThreshold)}</span>
                <span className="od-chip"><Users size={13} /> {campaign._count.submissions} откликов</span>
              </div>
            </div>
          </div>

          <aside className="od-aside">
            <div className="od-apply">
              <span className="od-apply-label"><WalletCards size={15} /> Оплата за результат</span>
              <strong className="od-apply-sum">{rub(expected)}</strong>
              <div className="od-apply-metrics">
                <div><b>{compactNumber(campaign.viewThreshold)}</b><em>цель просмотров</em></div>
                <div><b>{rub(campaign.cpmRateCents)}</b><em>за 1000</em></div>
                <div><b>{daysLeft} дн</b><em>до дедлайна</em></div>
                <div><b>{campaign._count.submissions}</b><em>откликов</em></div>
              </div>

              {!currentUser ? (
                <Link className="btn btn-primary od-apply-btn" href="/login">Войти, чтобы откликнуться</Link>
              ) : mode === "client" ? (
                isOwner
                  ? <Link className="btn btn-primary od-apply-btn" href="/campaigns">Все мои кампании</Link>
                  : <span className="od-apply-muted">Кампания другого заказчика</span>
              ) : submission ? (
                <Link className="btn btn-primary od-apply-btn" href="/upload">Выложить работу</Link>
              ) : (
                <form action={joinCampaignAction}>
                  <input type="hidden" name="campaignId" value={campaign.id} />
                  <button className="btn btn-primary od-apply-btn" type="submit">Откликнуться</button>
                </form>
              )}

              <ul className="od-apply-notes">
                <li><ShieldCheck size={14} /> {mode === "client" ? "Оплата списывается только после проверки просмотров." : "Выплата начисляется после проверки просмотров."}</li>
                <li><Clock3 size={14} /> Статистика обновляется автоматически.</li>
              </ul>
            </div>
          </aside>

          <div className="od-body">
            <section className="od-block od-client-block">
              <div className="od-client">
                <UserAvatar
                  avatar={campaign.owner.avatar}
                  name={campaign.owner.name}
                  handle={campaign.owner.handle}
                  size={44}
                />
                <div className="od-client-id">
                  <strong>{campaign.owner.name}</strong>
                  <span>Заказ {campaign.trackingPrefix}</span>
                </div>
                {safeSource ? (
                  <a className="od-source" href={safeSource.url} target="_blank" rel="noreferrer">Источник <ArrowUpRight size={15} /></a>
                ) : null}
              </div>
            </section>

            <section className="od-block">
              <h2 className="od-h2">Что сделать</h2>
              <ul className="od-tasks">
                {tasks.map((task) => (
                  <li key={task}><Check size={16} /> <span>{task}</span></li>
                ))}
              </ul>
            </section>

            <section className="od-block">
              <h2 className="od-h2">Правила</h2>
              <div className="od-rules">
                <div><b>Площадки</b><span>{platforms.length ? platforms.join(", ") : "TikTok, Shorts, Reels, VK"}</span></div>
                <div><b>Теги</b><span>{rules.requiredTags?.length ? rules.requiredTags.join(", ") : "#reelpay"}</span></div>
                <div><b>Нельзя</b><span>{rules.bans?.slice(0, 3).join(", ") || "NSFW, оскорбления, политика"}</span></div>
                <div><b>Watermark</b><span>{rules.watermarkBonus ? "Нужен ReelPay watermark" : "Не обязателен"}</span></div>
              </div>
            </section>
          </div>
        </div>

        {submission && (mode === "worker" || isOwner) ? (
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
              <span><b>{submission.fraudScore}%</b><em>риск проверки</em></span>
              <span><b>{videoCheckStatus(videoCheck?.status)}</b><em>watermark</em></span>
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
                deleted: Boolean(message.deletedAt),
                edited: Boolean(message.editedAt),
                previews: (meta.urls || []).map(buildSafePreview).filter(Boolean) as Array<{ url: string; host: string; platform: string; title: string }>
              };
            })}
          />
        ) : null}
      </section>
    </AppShell>
  );
}
