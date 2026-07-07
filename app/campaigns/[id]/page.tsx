import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, BadgeCheck, Check, CircleAlert, Clock3, Megaphone, MessageCircle, ShieldCheck, Sparkles, Star, Target, UserRoundSearch, Users, WalletCards } from "lucide-react";
import { AppShell } from "@/components/ui";
import { UserAvatar } from "@/components/user-avatar";
import { CampaignChat } from "@/components/campaign-chat";
import { WorkspaceJourney } from "@/components/workspace-journey";
import { TakeOrderButton } from "@/components/take-order-button";
import { SubmissionDispute } from "@/components/submission-dispute";
import { ClipReport } from "@/components/clip-report";
import { closeCampaignAction, rateCompletedSubmissionAction, reviewDraftAction } from "@/app/actions";
import { getCurrentUser } from "@/lib/auth";
import { canAccessAdmin } from "@/lib/admin";
import { buildSafePreview } from "@/lib/chat-safety";
import { parseJson } from "@/lib/json";
import { compactNumber, expectedPayout, grossPayout, minimumGuaranteedPayout, rub } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { getActiveRoleMode } from "@/lib/role-mode";
import { safeReturnTo } from "@/lib/navigation";
import { workerMatch } from "@/lib/worker-matching";
import { diagnoseCampaign } from "@/lib/campaign-diagnostics";
import styles from "./campaign-detail.module.css";

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
    NEEDS_CHANGES: "Нужны изменения",
    PASS: "Пройдено",
    PASSED: "Пройдено",
    FAIL: "Не пройдено",
    FAILED: "Не пройдено"
  };
  return labels[status || ""] || "Не запускалась";
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const campaign = await prisma.campaign.findUnique({
    where: { id },
    select: { title: true, description: true, cpmRateCents: true, visibility: true, isDemo: true, status: true }
  });
  if (!campaign) return { title: "Заказ не найден" };

  const indexable =
    !campaign.isDemo &&
    (campaign.visibility === "PUBLIC" || campaign.visibility === "FEATURED") &&
    campaign.status !== "DRAFT";
  const cpm = Math.round(campaign.cpmRateCents / 100);
  const title = `${campaign.title} — заказ для клипперов, ${cpm} ₽ за 1000 просмотров`;
  const description = campaign.description.slice(0, 160);

  return {
    title,
    description,
    alternates: { canonical: `/campaigns/${id}` },
    robots: indexable ? undefined : { index: false, follow: false },
    openGraph: { title, description, type: "article", url: `/campaigns/${id}` }
  };
}

export default async function CampaignPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ returnTo?: string; rating?: string }> }) {
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
      minimumGuaranteeCents: true,
      reviewMode: true,
      maxRevisionRounds: true,
      briefVersion: true,
      draftRequired: true,
      deadline: true,
      createdAt: true,
      niche: true,
      language: true,
      visibility: true,
      status: true,
      isDemo: true,
      isAdvertising: true,
      erid: true,
      advertiserName: true,
      totalBudgetCents: true,
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
            ,
            ratings: {
              where: { authorId: currentUser.id },
              select: { score: true, comment: true },
              take: 1
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
          draftUrl: true,
          draftStatus: true,
          draftRevision: true,
          draftReviewNote: true,
          draftSubmittedAt: true,
          createdAt: true,
          updatedAt: true,
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
          },
          ratings: {
            where: { authorId: currentUser?.id || "__none__" },
            select: { score: true, comment: true },
            take: 1
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
          draftUrl: submission.draftUrl,
          draftStatus: submission.draftStatus,
          draftRevision: submission.draftRevision,
          draftReviewNote: submission.draftReviewNote,
          draftSubmittedAt: submission.draftSubmittedAt,
          createdAt: submission.createdAt,
          updatedAt: submission.updatedAt,
          viewVelocityJson: submission.viewVelocityJson,
          lastSyncedAt: submission.lastSyncedAt,
          worker: submission.worker,
          disputes: submission.disputes,
          videoChecks: submission.videoChecks.map((check) => ({
            id: check.id,
            checkType: check.checkType,
            status: check.status,
            createdAt: check.createdAt
          })),
          ratings: submission.ratings
        }]
      : [];
  const recommendedWorkers = isOwner && ["ACTIVE", "LOW_BUDGET"].includes(campaign.status)
    ? (await prisma.user.findMany({
        where: {
          id: { not: campaign.ownerId },
          accountStatus: "ACTIVE",
          role: { in: ["WORKER", "BOTH", "ADMIN"] },
          OR: [
            { collabAvailability: "BOTH" },
            { collabAvailability: "ACTIVE_ROLE", preferredRoleMode: { not: "client" } },
            { collabAvailability: "ACTIVE_ROLE", preferredRoleMode: null }
          ]
        },
        select: {
          id: true,
          name: true,
          handle: true,
          avatar: true,
          specialtiesJson: true,
          trustScore: true,
          kycStatus: true,
          submissions: {
            select: {
              status: true,
              platform: true,
              currentViews: true,
              campaign: { select: { niche: true } }
            },
            orderBy: { updatedAt: "desc" },
            take: 50
          }
        },
        take: 80
      }))
        .map((worker) => {
          const completed = worker.submissions.filter((item) =>
            ["VERIFIED", "THRESHOLD_MET", "SETTLING", "PAID"].includes(item.status)
          );
          const activeOrders = worker.submissions.filter((item) =>
            ["ACCEPTED", "POSTED", "VERIFIED", "THRESHOLD_MET", "SETTLING"].includes(item.status)
          ).length;
          const averageViews = completed.length
            ? Math.round(completed.reduce((sum, item) => sum + item.currentViews, 0) / completed.length)
            : 0;
          const match = workerMatch(campaign, {
            specialties: parseJson<string[]>(worker.specialtiesJson, []),
            completedNiches: completed.map((item) => item.campaign.niche || "").filter(Boolean),
            completedPlatforms: completed.map((item) => item.platform),
            trustScore: worker.trustScore,
            verified: worker.kycStatus === "VERIFIED",
            averageViews,
            activeOrders
          });
          return { ...worker, averageViews, completedCount: completed.length, activeOrders, ...match };
        })
        .filter((worker) => worker.score >= 35)
        .sort((a, b) => b.score - a.score || b.trustScore - a.trustScore)
        .slice(0, 6)
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
  const minimumExpected = mode === "client"
    ? campaign.minimumGuaranteeCents
    : minimumGuaranteedPayout(campaign.minimumGuaranteeCents, currentUser?.rank || "BRONZE");
  const slotsLeft = Math.max(0, campaign.maxPaidResults - campaign._count.submissions);
  const campaignDiagnostics = isOwner
    ? diagnoseCampaign({
        id: campaign.id,
        status: campaign.status,
        createdAt: campaign.createdAt,
        deadline: campaign.deadline,
        remainingBudgetCents: campaign.remainingBudgetCents,
        reservedBudgetCents: campaign.reservedBudgetCents,
        grossPayoutCents: gross,
        slotsLeft,
        submissions: reports.map((report) => ({
          status: report.status,
          draftStatus: report.draftStatus,
          currentViews: report.currentViews,
          fraudScore: report.fraudScore,
          createdAt: report.createdAt,
          updatedAt: report.updatedAt,
          draftSubmittedAt: report.draftSubmittedAt
        }))
      })
    : [];
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
  const draftDone = !campaign.draftRequired || submission?.draftStatus === "APPROVED";
  const progressSteps = [
    { key: "accepted", title: "Заказ взят", done: Boolean(submission), active: false, detail: "Условия доступны" },
    ...(campaign.draftRequired ? [{
      key: "draft",
      title: "Черновик",
      done: draftDone,
      active: Boolean(submission && submission.status === "ACCEPTED" && !draftDone),
      detail: submission?.draftStatus === "PENDING"
        ? "Идёт проверка"
        : submission?.draftStatus === "CHANGES_REQUESTED"
          ? "Нужны изменения"
          : draftDone
            ? "Публикация разрешена"
            : "Отправьте до публикации",
      href: "/upload",
      metric: `Режим: ${campaign.reviewMode === "FAST" ? "быстрый" : campaign.reviewMode === "STRICT" ? "строгий" : "стандартный"}`
    }] : []),
    { key: "link", title: "Ссылка", done: linkDone, active: Boolean(submission?.status === "ACCEPTED" && draftDone), detail: submission?.status === "ACCEPTED" ? draftDone ? "Опубликуйте ролик" : "После принятия черновика" : "Ссылка принята", href: "/upload", metric: `Watermark: ${videoCheckStatus(videoCheck?.status)}` },
    { key: "tracking", title: "Трекинг", done: ["THRESHOLD_MET", "SETTLING", "PAID"].includes(submission?.status || ""), active: trackingActive, detail: trackingActive ? "Считаем просмотры" : "После проверки ссылки", metric: linkDone ? `${compactNumber(submission?.currentViews || 0)} просмотров · ${compactNumber(submission?.currentLikes || 0)} лайков` : "Трекинг начнётся после ссылки" },
    { key: "payout", title: "Выплата", done: submission?.status === "PAID", active: ["THRESHOLD_MET", "SETTLING"].includes(submission?.status || ""), detail: submission?.status === "PAID" ? "Деньги зачислены" : "После цели и проверки", metric: submission ? `Риск проверки ${submission.fraudScore}%` : undefined }
  ];

  const seoIndexable =
    !campaign.isDemo &&
    (campaign.visibility === "PUBLIC" || campaign.visibility === "FEATURED") &&
    campaign.status !== "DRAFT";
  const jobPostingLd = seoIndexable
    ? {
        "@context": "https://schema.org",
        "@type": "JobPosting",
        title: campaign.title,
        description: campaign.description,
        datePosted: campaign.createdAt.toISOString(),
        validThrough: campaign.deadline.toISOString(),
        employmentType: "CONTRACTOR",
        hiringOrganization: { "@type": "Organization", name: "ReelPay" },
        baseSalary: {
          "@type": "MonetaryAmount",
          currency: "RUB",
          value: { "@type": "QuantitativeValue", value: Math.round(campaign.cpmRateCents / 100), unitText: "за 1000 просмотров" }
        }
      }
    : null;

  return (
    <AppShell>
      <section className="section od">
        {jobPostingLd ? (
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jobPostingLd) }} />
        ) : null}
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
              {campaign.isAdvertising ? (
                <p className="od-ad-mark">
                  {campaign.erid
                    ? `Реклама.${campaign.advertiserName ? ` ${campaign.advertiserName}.` : ""} erid: ${campaign.erid}`
                    : "Рекламная кампания — маркировка erid будет добавлена автоматически перед публикацией."}
                </p>
              ) : null}
            </div>
          </div>

          <aside className="od-aside">
            <div className="od-apply">
              <span className="od-apply-label"><WalletCards size={15} /> {mode === "client" ? "Максимальная стоимость" : "Максимальная чистая выплата"}</span>
              <strong className="od-apply-sum">{rub(expected)}</strong>
              <div className="od-apply-metrics">
                <div><b>{compactNumber(campaign.viewThreshold)}</b><em>цель просмотров</em></div>
                <div><b>{rub(campaign.cpmRateCents)}</b><em>за 1000</em></div>
                {campaign.minimumGuaranteeCents > 0 ? <div><b>{rub(minimumExpected)}</b><em>гарантия после проверки</em></div> : null}
                <div><b>{daysLeft} дн</b><em>до дедлайна</em></div>
                <div><b>{slotsLeft}</b><em>свободных мест</em></div>
              </div>

              {campaign.totalBudgetCents > 0 ? (() => {
                const total = campaign.totalBudgetCents;
                const reserved = Math.min(campaign.reservedBudgetCents, total);
                const free = Math.max(0, Math.min(campaign.remainingBudgetCents, total - reserved));
                const paid = Math.max(0, total - reserved - free);
                const pct = (value: number) => Math.round((value / total) * 100);
                return (
                  <div className="od-budget">
                    <div className="od-budget-bar" role="img" aria-label={`Выплачено ${pct(paid)}%, в резерве ${pct(reserved)}%, свободно ${pct(free)}%`}>
                      <span className="od-budget-paid" style={{ width: `${pct(paid)}%` }} />
                      <span className="od-budget-reserved" style={{ width: `${pct(reserved)}%` }} />
                    </div>
                    <div className="od-budget-legend">
                      <span><i className="is-paid" /> Выплачено {pct(paid)}%</span>
                      <span><i className="is-reserved" /> В резерве {pct(reserved)}%</span>
                      <span><i className="is-free" /> Свободно {pct(free)}%</span>
                    </div>
                    <small>Бюджет кампании {rub(total)}</small>
                  </div>
                );
              })() : null}

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
                  guarantee={campaign.minimumGuaranteeCents > 0 ? rub(minimumExpected) : null}
                  deadline={`${daysLeft} дн.`}
                  disabled={slotsLeft <= 0 || campaign.remainingBudgetCents < gross}
                />
              )}

              <ul className="od-apply-notes">
                <li><ShieldCheck size={14} /> {
                  campaign.minimumGuaranteeCents > 0
                    ? mode === "client"
                      ? `Проверенный ролик получит не меньше ${rub(campaign.minimumGuaranteeCents)} к дедлайну.`
                      : submission
                        ? `Под вас зарезервировано ${rub(submission.reservedPayoutCents)}; гарантия — ${rub(minimumExpected)} чистыми.`
                        : `После проверки гарантировано от ${rub(minimumExpected)} чистыми.`
                    : mode === "client"
                      ? "Оплата списывается после достижения цели и проверки просмотров."
                      : submission
                        ? `Под вас зарезервировано ${rub(submission.reservedPayoutCents)}.`
                        : "После взятия заказа максимальная выплата резервируется под вас."
                }</li>
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
                <div><b>Проверка черновика</b><span>{campaign.reviewMode === "FAST" ? "Быстрая" : campaign.reviewMode === "STRICT" ? "Заказчиком" : "Модератором ReelPay"}</span></div>
                <div><b>Правки</b><span>До {campaign.maxRevisionRounds} кругов, только в рамках брифа v{campaign.briefVersion}</span></div>
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

        {isOwner ? (
          <section className={styles.diagnostics} aria-labelledby="campaign-diagnostics-title">
            <div className={styles.diagnosticsHead}>
              <span><Sparkles size={15} /> Диагностика без ИИ</span>
              <h2 id="campaign-diagnostics-title">Что происходит с заказом</h2>
            </div>
            <div className={styles.diagnosticGrid}>
              {campaignDiagnostics.map((item) => (
                <article className={styles.diagnosticCard} data-tone={item.tone} key={`${item.title}-${item.text}`}>
                  <div>
                    <b>{item.title}</b>
                    <p>{item.text}</p>
                  </div>
                  {item.href && item.action ? <Link href={item.href}>{item.action} <ArrowUpRight size={14} /></Link> : null}
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {isOwner ? (
          <section className={styles.workerMatches} aria-labelledby="worker-matches-title">
            <div className={styles.workerMatchesHead}>
              <div>
                <span><UserRoundSearch size={15} /> Автоподбор</span>
                <h2 id="worker-matches-title">Подходящие исполнители</h2>
                <p>Сравнили специализацию, опыт, площадку, охваты и текущую загрузку.</p>
              </div>
              <Link href="/leaderboard">Все исполнители <ArrowUpRight size={15} /></Link>
            </div>
            {recommendedWorkers.length ? (
              <div className={styles.workerMatchGrid}>
                {recommendedWorkers.map((worker) => {
                  const profileHref = `/profiles/${worker.handle}?campaign=${campaign.id}&returnTo=${encodeURIComponent(`/campaigns/${campaign.id}`)}#cp-invite`;
                  return (
                    <article className={styles.workerMatchCard} key={worker.id}>
                      <Link className={styles.workerIdentity} href={profileHref}>
                        <UserAvatar avatar={worker.avatar} name={worker.name} handle={worker.handle} size={48} />
                        <div>
                          <strong>{worker.name}</strong>
                          <span>@{worker.handle}</span>
                        </div>
                      </Link>
                      <b className={styles.workerScore}>{worker.score}%</b>
                      <div className={styles.workerMetrics}>
                        <span><b>{compactNumber(worker.averageViews)}</b> средний охват</span>
                        <span><b>{worker.completedCount}</b> работ</span>
                        <span><b>{worker.activeOrders}</b> в работе</span>
                      </div>
                      <div className={styles.workerReasons}>
                        {worker.reasons.map((reason) => <span key={reason}><BadgeCheck size={13} /> {reason}</span>)}
                      </div>
                      <Link className={styles.workerAction} href={profileHref}>Посмотреть и пригласить <ArrowUpRight size={14} /></Link>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className={styles.workerEmpty}>
                Под точные условия пока нет подходящих исполнителей. Попробуйте расширить срок или проверить требования.
              </div>
            )}
          </section>
        ) : null}

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
                    {campaign.draftRequired ? (
                      <div className={styles.draftReview} data-status={report.draftStatus.toLowerCase()}>
                        <div>
                          <b>Черновик · версия {report.draftRevision + 1}</b>
                          <span>
                            {report.draftStatus === "APPROVED"
                              ? "Принят — публикация разрешена"
                              : report.draftStatus === "PENDING"
                                ? "Ожидает проверки"
                                : report.draftStatus === "CHANGES_REQUESTED"
                                  ? "Отправлен на правки"
                                  : report.draftStatus === "REJECTED"
                                    ? "Отклонён"
                                    : "Ещё не отправлен"}
                          </span>
                        </div>
                        {report.draftUrl ? <a href={report.draftUrl} target="_blank" rel="noreferrer">Открыть черновик <ArrowUpRight size={13} /></a> : null}
                        {report.draftReviewNote ? <p>{report.draftReviewNote}</p> : null}
                        {isOwner && campaign.reviewMode === "STRICT" && report.draftStatus === "PENDING" ? (
                          <form action={reviewDraftAction}>
                            <input type="hidden" name="submissionId" value={report.id} />
                            <input type="hidden" name="returnTo" value={`/campaigns/${campaign.id}`} />
                            <input name="note" maxLength={700} placeholder="Комментарий для правок или отказа" />
                            <div>
                              <button name="decision" value="approve">Принять</button>
                              <button name="decision" value="changes" disabled={report.draftRevision >= campaign.maxRevisionRounds}>На правки</button>
                              <button className={styles.danger} name="decision" value="reject">Отклонить</button>
                            </div>
                          </form>
                        ) : null}
                      </div>
                    ) : null}
                    {report.status === "PAID" && currentUser ? (
                      <form className={styles.ratingForm} action={rateCompletedSubmissionAction}>
                        <input type="hidden" name="submissionId" value={report.id} />
                        <input type="hidden" name="returnTo" value={`/campaigns/${campaign.id}`} />
                        <label htmlFor={`rating-${report.id}`}>
                          <Star size={15} />
                          {isOwner ? "Оцените исполнителя" : "Оцените заказчика"}
                        </label>
                        <div>
                          <select id={`rating-${report.id}`} name="score" defaultValue={report.ratings[0]?.score || 5}>
                            <option value="5">5 — отлично</option>
                            <option value="4">4 — хорошо</option>
                            <option value="3">3 — нормально</option>
                            <option value="2">2 — были проблемы</option>
                            <option value="1">1 — плохо</option>
                          </select>
                          <input
                            name="comment"
                            maxLength={500}
                            defaultValue={report.ratings[0]?.comment || ""}
                            placeholder="Коротко о сотрудничестве"
                          />
                          <button type="submit">{report.ratings.length ? "Обновить" : "Сохранить"}</button>
                        </div>
                      </form>
                    ) : null}
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
