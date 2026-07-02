import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, Check, CircleAlert, Clock3, Megaphone, MessageCircle, ShieldCheck, Sparkles, Target, Users, WalletCards } from "lucide-react";
import { AppShell } from "@/components/ui";
import { UserAvatar } from "@/components/user-avatar";
import { CampaignChat } from "@/components/campaign-chat";
import { WorkspaceJourney } from "@/components/workspace-journey";
import { TakeOrderButton } from "@/components/take-order-button";
import { SubmissionDispute } from "@/components/submission-dispute";
import { ClipReport } from "@/components/clip-report";
import { closeCampaignAction } from "@/app/actions";
import { getCurrentUser } from "@/lib/auth";
import { canAccessAdmin } from "@/lib/admin";
import { buildSafePreview } from "@/lib/chat-safety";
import { parseJson } from "@/lib/json";
import { compactNumber, expectedPayout, grossPayout, rub } from "@/lib/money";
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
    PASS: "Пройдено",
    PASSED: "Пройдено",
    FAIL: "Не пройдено",
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
      isDemo: true,
      remainingBudgetCents: true,
      reservedBudgetCents: true,
      maxPaidResults: true,
      trackingPrefix: true,
      owner: { select: { id: true, name: true, handle: true, avatar: true } },
      _count: {
        select: {
          submissions: {
            where: { status: { not: "REJECTED" } }
          }
        }
      }
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
          include: {
            worker: { select: { id: true, name: true, handle: true } },
            videoChecks: { orderBy: { createdAt: "desc" }, take: 3 },
            disputes: {
              orderBy: { createdAt: "desc" },
              select: { id: true, reason: true, status: true, resolution: true, createdAt: true, user: { select: { name: true } } }
            }
          },
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
  const reports = isOwner
    ? await prisma.submission.findMany({
        where: { campaignId: campaign.id },
        select: {
          id: true,
          postUrl: true,
          status: true,
          platform: true,
          currentViews: true,
          currentLikes: true,
          currentComments: true,
          fraudScore: true,
          viewVelocityJson: true,
          lastSyncedAt: true,
          worker: { select: { name: true, handle: true } },
          disputes: {
            orderBy: { createdAt: "desc" },
            select: { id: true, reason: true, status: true, resolution: true, createdAt: true, user: { select: { name: true } } }
          },
          videoChecks: {
            orderBy: { createdAt: "desc" },
            take: 3,
            select: { id: true, checkType: true, status: true, createdAt: true }
          }
        },
        orderBy: { updatedAt: "desc" },
        take: 30
      })
    : submission
      ? [{
          id: submission.id,
          postUrl: submission.postUrl,
          status: submission.status,
          platform: submission.platform,
          currentViews: submission.currentViews,
          currentLikes: submission.currentLikes,
          currentComments: submission.currentComments,
          fraudScore: submission.fraudScore,
          viewVelocityJson: submission.viewVelocityJson,
          lastSyncedAt: submission.lastSyncedAt,
          worker: submission.worker,
          disputes: submission.disputes,
          videoChecks: submission.videoChecks.map((check) => ({
            id: check.id,
            checkType: check.checkType,
            status: check.status,
            createdAt: check.createdAt
          }))
        }]
      : [];

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
  const gross = grossPayout(campaign.viewThreshold, campaign.cpmRateCents);
  const expected = mode === "client"
    ? gross
    : expectedPayout(campaign.viewThreshold, campaign.cpmRateCents, currentUser?.rank || "BRONZE");
  const slotsLeft = Math.max(0, campaign.maxPaidResults - campaign._count.submissions);
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
    : campaign.remainingBudgetCents < gross || slotsLeft <= 0
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
                {campaign.isDemo ? <span className="od-chip od-chip--demo">Демо-кампания</span> : null}
                {signal ? <span className={`od-chip od-chip--${signal.cls}`}><signal.Icon size={13} /> {signal.text}</span> : null}
                <span className="od-chip"><Clock3 size={13} /> {daysLeft} дн</span>
                <span className="od-chip"><Target size={13} /> цель {compactNumber(campaign.viewThreshold)}</span>
                <span className="od-chip"><Users size={13} /> {slotsLeft} мест доступно</span>
              </div>
            </div>
          </div>

          <aside className="od-aside">
            <div className="od-apply">
              <span className="od-apply-label"><WalletCards size={15} /> {mode === "client" ? "Стоимость результата" : "Чистая выплата"}</span>
              <strong className="od-apply-sum">{rub(expected)}</strong>
              <div className="od-apply-metrics">
                <div><b>{compactNumber(campaign.viewThreshold)}</b><em>цель просмотров</em></div>
                <div><b>{rub(campaign.cpmRateCents)}</b><em>за 1000</em></div>
                <div><b>{daysLeft} дн</b><em>до дедлайна</em></div>
                <div><b>{slotsLeft}</b><em>свободных мест</em></div>
              </div>

              {!currentUser ? (
                <Link className="btn btn-primary od-apply-btn" href="/login">Войти, чтобы откликнуться</Link>
              ) : mode === "client" ? (
                isOwner
                  ? (
                      <>
                        <Link className="btn btn-primary od-apply-btn" href="/campaigns">Все мои кампании</Link>
                        {campaign.status !== "COMPLETED" ? (
                          <form action={closeCampaignAction}>
                            <input type="hidden" name="campaignId" value={campaign.id} />
                            <button className="btn od-apply-btn" type="submit">Завершить и вернуть остаток ({rub(campaign.remainingBudgetCents)})</button>
                          </form>
                        ) : null}
                      </>
                    )
                  : <span className="od-apply-muted">Кампания другого заказчика</span>
              ) : submission ? (
                <Link className="btn btn-primary od-apply-btn" href="/upload">Выложить работу</Link>
              ) : (
                <TakeOrderButton
                  campaignId={campaign.id}
                  payout={rub(expected)}
                  deadline={`${daysLeft} дн.`}
                  disabled={slotsLeft <= 0 || campaign.remainingBudgetCents < gross}
                />
              )}

              <ul className="od-apply-notes">
                <li><ShieldCheck size={14} /> {mode === "client" ? "Оплата списывается только после проверки просмотров." : submission ? `Под вас зарезервировано ${rub(submission.reservedPayoutCents)}.` : "После взятия заказа выплата резервируется под вас."}</li>
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

        {reports.length ? (
          <section className="od-report-block" aria-labelledby="campaign-report-title">
            <div className="section-head compact">
              <div><span className="eyebrow">Контроль результата</span><h2 id="campaign-report-title">Отчёт по публикациям</h2></div>
              <span>{reports.length} {reports.length === 1 ? "ролик" : "роликов"}</span>
            </div>
            <div className="od-report-grid">
              {reports.map((report) => {
                const post = buildSafePreview(report.postUrl);
                return (
                  <article className="od-report-card" data-submission-id={report.id} key={report.id}>
                    <header>
                      <div><strong>{report.worker.name}</strong><span>@{report.worker.handle}</span></div>
                      <b>{submissionStatus(report.status)}</b>
                    </header>
                    <div className="od-report-metrics">
                      <span><b>{compactNumber(report.currentViews)}</b><small>просмотров</small></span>
                      <span><b>{compactNumber(report.currentLikes)}</b><small>реакций</small></span>
                      <span><b>{report.currentComments}</b><small>комментариев</small></span>
                      <span data-risk={report.fraudScore >= 60}><b>{report.fraudScore}%</b><small>риск</small></span>
                    </div>
                    <div className="od-report-checks">
                      {report.videoChecks.length ? report.videoChecks.map((check) => (
                        <span key={check.id}>
                          <ShieldCheck size={13} />
                          {check.checkType === "OWNERSHIP" ? "Владение" : check.checkType === "WATERMARK" ? "Watermark" : check.checkType}
                          <b>{videoCheckStatus(check.status)}</b>
                        </span>
                      )) : <span><Clock3 size={13} /> Проверки ещё не запускались</span>}
                    </div>
                    <ClipReport
                      input={{
                        status: report.status,
                        fraudScore: report.fraudScore,
                        currentViews: report.currentViews,
                        viewThreshold: campaign.viewThreshold,
                        platform: report.platform,
                        videoChecks: report.videoChecks.map((check) => ({ checkType: check.checkType, status: check.status })),
                        disputeOpen: report.disputes.some((dispute) => dispute.status === "OPEN")
                      }}
                      velocity={report.viewVelocityJson}
                    />
                    <footer>
                      <small>Обновлено {report.lastSyncedAt.toLocaleString("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</small>
                      {post && !report.postUrl.includes("post-link-waiting") ? <a href={post.url} target="_blank" rel="noreferrer">Открыть ролик <ArrowUpRight size={13} /></a> : null}
                    </footer>
                    <SubmissionDispute
                      submissionId={report.id}
                      campaignId={campaign.id}
                      disputes={report.disputes}
                      canOpen={Boolean(currentUser && report.status !== "PAID")}
                    />
                  </article>
                );
              })}
            </div>
          </section>
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
