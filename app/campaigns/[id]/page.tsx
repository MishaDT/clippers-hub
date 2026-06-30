import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, Check, CircleAlert, Clock3, Megaphone, MessageCircle, ShieldCheck, Sparkles, Target, Users, WalletCards } from "lucide-react";
import { AppShell } from "@/components/ui";
import { UserAvatar } from "@/components/user-avatar";
import { CampaignChat } from "@/components/campaign-chat";
import { WorkspaceJourney } from "@/components/workspace-journey";
import { joinCampaignAction } from "@/app/actions";
import { getCurrentUser } from "@/lib/auth";
import { canAccessAdmin } from "@/lib/admin";
import { buildSafePreview } from "@/lib/chat-safety";
import { parseJson } from "@/lib/json";
import { compactNumber, expectedPayout, rub } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { getActiveRoleMode } from "@/lib/role-mode";
import { safeReturnTo } from "@/lib/navigation";

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

export default async function CampaignPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ returnTo?: string }> }) {
  const { id } = await params;
  const query = await searchParams;
  const returnTo = safeReturnTo(query.returnTo, "/campaigns");
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
      briefJson: true,
      cpmRateCents: true,
      viewThreshold: true,
      deadline: true,
      createdAt: true,
      niche: true,
      language: true,
      visibility: true,
      status: true,
      remainingBudgetCents: true,
      trackingPrefix: true,
      owner: { select: { id: true, name: true, handle: true, avatar: true } },
      _count: { select: { submissions: true } }
    }
  });
  if (!campaign) notFound();

  const isOwner = currentUser?.id === campaign.ownerId;
  // Draft and invite-only campaigns are private: only the owner (or an admin) may see the
  // brief, source URL and economics. Everyone else gets a 404 — don't even confirm it exists.
  if (!isOwner && !canAccessAdmin(currentUser) && (campaign.status === "DRAFT" || campaign.visibility === "PRIVATE_INVITE")) {
    notFound();
  }
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
  const brief = parseJson<{
    deliverableCount?: number;
    clipDuration?: string;
    aspectRatio?: string;
    style?: string;
    language?: string;
    subtitles?: string;
    cta?: string;
    mustInclude?: string;
    exampleUrls?: string[];
    rightsConfirmed?: boolean;
  }>(campaign.briefJson, {});
  const platforms = parseJson<string[]>(campaign.allowedPlatformsJson, []);
  const expected = expectedPayout(campaign.viewThreshold, campaign.cpmRateCents);
  const daysLeft = Math.max(1, Math.ceil((campaign.deadline.getTime() - Date.now()) / 86400000));
  const safeSource = buildSafePreview(campaign.sourceUrl);
  const briefRows = [
    ["Роликов", brief.deliverableCount ? String(brief.deliverableCount) : null],
    ["Длительность", brief.clipDuration ? `${brief.clipDuration} сек.` : null],
    ["Формат", brief.aspectRatio || null],
    ["Стиль", brief.style || null],
    ["Язык", brief.language?.toUpperCase() || campaign.language.toUpperCase()],
    ["Субтитры", brief.subtitles || null]
  ].filter((row): row is [string, string] => Boolean(row[1]));
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
  const videoCheck = submission?.videoChecks[0];
  const trackingActive = ["VERIFIED", "POSTED"].includes(submission?.status || "");
  const linkDone = ["POSTED", "VERIFIED", "THRESHOLD_MET", "SETTLING", "PAID"].includes(submission?.status || "");
  const progressSteps = [
    { key: "accepted", title: "Заказ взят", done: Boolean(submission), active: false, detail: "Условия доступны" },
    { key: "link", title: "Ссылка", done: linkDone, active: submission?.status === "ACCEPTED", detail: submission?.status === "ACCEPTED" ? "Опубликуйте ролик" : "Ссылка принята", href: "/upload", metric: `Watermark: ${videoCheckStatus(videoCheck?.status)}` },
    { key: "tracking", title: "Трекинг", done: ["THRESHOLD_MET", "SETTLING", "PAID"].includes(submission?.status || ""), active: trackingActive, detail: trackingActive ? "Считаем просмотры" : "После проверки ссылки", metric: linkDone ? `${compactNumber(submission?.currentViews || 0)} просмотров · ${compactNumber(submission?.currentLikes || 0)} лайков` : "Трекинг начнётся после ссылки" },
    { key: "payout", title: "Выплата", done: submission?.status === "PAID", active: ["THRESHOLD_MET", "SETTLING"].includes(submission?.status || ""), detail: submission?.status === "PAID" ? "Деньги зачислены" : "После цели и проверки", metric: submission ? `Риск проверки ${submission.fraudScore}%` : undefined }
  ];

  return (
    <AppShell>
      <section className="section od">
        <Link className="od-back" href={returnTo}><ArrowLeft size={16} /> Назад</Link>

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
              <p className="od-description">{campaign.description}</p>
              {briefRows.length ? (
                <div className="od-rules">
                  {briefRows.map(([label, value]) => <div key={label}><b>{label}</b><span>{value}</span></div>)}
                </div>
              ) : null}
              {brief.mustInclude ? <div className="od-callout"><Check size={16} /><span><b>Обязательно:</b> {brief.mustInclude}</span></div> : null}
              {brief.cta ? <div className="od-callout"><Target size={16} /><span><b>Призыв:</b> {brief.cta}</span></div> : null}
            </section>

            <section className="od-block">
              <h2 className="od-h2">Правила</h2>
              <div className="od-rules">
                <div><b>Площадки</b><span>{platforms.length ? platforms.join(", ") : "TikTok, Shorts, Reels, VK"}</span></div>
                <div><b>Теги</b><span>{rules.requiredTags?.length ? rules.requiredTags.join(", ") : "#reelpay"}</span></div>
                <div><b>Нельзя</b><span>{rules.bans?.slice(0, 3).join(", ") || "NSFW, оскорбления, политика"}</span></div>
                <div><b>Watermark</b><span>{rules.watermarkBonus ? "Нужен ReelPay watermark" : "Не обязателен"}</span></div>
              </div>
              {brief.exampleUrls?.length ? (
                <div className="od-examples">
                  <b>Примеры результата</b>
                  {brief.exampleUrls.map((url, index) => {
                    const preview = buildSafePreview(url);
                    return preview ? <a href={preview.url} target="_blank" rel="noreferrer" key={preview.url}>Пример {index + 1} <ArrowUpRight size={14} /></a> : null;
                  })}
                </div>
              ) : null}
            </section>
          </div>
        </div>

        {submission && (mode === "worker" || isOwner) ? (
          <WorkspaceJourney
            submissionId={submission.id}
            status={submissionStatus(submission.status)}
            steps={progressSteps}
          />
        ) : null}

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
