import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Award,
  BadgeCheck,
  CalendarDays,
  Check,
  Eye,
  Film,
  Gauge,
  Play,
  Sparkles,
  TrendingUp
} from "lucide-react";
import { AppShell } from "@/components/ui";
import { ReportDialog } from "@/components/report-dialog";
import { LeagueBadge } from "@/components/league-badge";
import { cancelCollabInviteAction, endorseClipperAction, sendCollabInviteAction } from "@/app/actions";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, canManageClient } from "@/lib/auth";
import { canEndorse } from "@/lib/leagues";
import { compactNumber } from "@/lib/money";
import { getActiveRoleMode } from "@/lib/role-mode";

const PLATFORM_LABEL: Record<string, string> = {
  TIKTOK: "TikTok",
  YOUTUBE: "YouTube",
  INSTAGRAM: "Instagram",
  VK: "VK",
  TWITCH: "Twitch"
};

function youtubeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) return u.pathname.split("/").filter(Boolean)[0] || null;
    if (u.searchParams.get("v")) return u.searchParams.get("v");
    const shorts = u.pathname.match(/\/shorts\/([^/?#]+)/);
    return shorts?.[1] || null;
  } catch {
    return null;
  }
}

// Real preview where it's free + instant (YouTube CDN thumbnail), styled cover
// otherwise — TikTok/IG/VK have no public thumbnail without a per-video API call.
function thumbFor(platform: string, postUrl: string) {
  if (platform === "YOUTUBE") {
    const id = youtubeId(postUrl);
    if (id) return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
  }
  return null;
}

function dicebear(handle: string, avatar: string | null) {
  return avatar || `https://api.dicebear.com/9.x/adventurer/svg?seed=${encodeURIComponent(handle || "clipper")}&backgroundColor=transparent`;
}

export async function generateMetadata({ params }: { params: Promise<{ handle: string }> }): Promise<Metadata> {
  const { handle } = await params;
  return { title: `@${handle} — клиппер` };
}

export default async function ClipperPortfolioPage({
  params,
  searchParams
}: {
  params: Promise<{ handle: string }>;
  searchParams: Promise<{ invited?: string; endorsed?: string; error?: string }>;
}) {
  const { handle } = await params;
  const { invited, endorsed, error } = await searchParams;

  const user = await prisma.user.findUnique({
    where: { handle },
    select: {
      id: true, name: true, handle: true, avatar: true, bio: true,
      specialtiesJson: true, socialLinksJson: true, lifetimeViews: true,
      kycStatus: true, createdAt: true
    }
  });
  if (!user) {
    const alias = await prisma.userHandleAlias.findUnique({
      where: { handle },
      select: { user: { select: { handle: true } } }
    });
    if (alias) permanentRedirect(`/clippers/${alias.user.handle}`);
    notFound();
  }

  const [pins, automaticSubs, stats, platformGroups, endorsements, viewer] = await Promise.all([
    prisma.portfolioPin.findMany({
      where: { userId: user.id },
      orderBy: { position: "asc" },
      select: { submission: { select: { id: true, currentViews: true, postUrl: true, platform: true } } }
    }),
    prisma.submission.findMany({
      where: {
        workerId: user.id,
        verifiedAt: { not: null },
        status: { in: ["VERIFIED", "THRESHOLD_MET", "SETTLING", "PAID"] }
      },
      select: { id: true, currentViews: true, postUrl: true, platform: true },
      orderBy: { currentViews: "desc" },
      take: 12
    }),
    prisma.submission.aggregate({
      where: { workerId: user.id },
      _count: { _all: true },
      _sum: { currentViews: true },
      _max: { currentViews: true }
    }),
    prisma.submission.groupBy({
      by: ["platform"],
      where: { workerId: user.id },
      _count: { _all: true }
    }),
    prisma.endorsement.findMany({
      where: { workerId: user.id },
      select: { id: true, note: true, client: { select: { name: true, handle: true, avatar: true } } },
      orderBy: { createdAt: "desc" },
      take: 8
    }),
    getCurrentUser()
  ]);
  const pinned = pins.map((item) => item.submission);
  const pinnedIds = new Set(pinned.map((item) => item.id));
  const topSubs = [...pinned, ...automaticSubs.filter((item) => !pinnedIds.has(item.id))].slice(0, 6);
  const specialties = JSON.parse(user.specialtiesJson) as string[];
  const socialLinks = JSON.parse(user.socialLinksJson) as string[];

  const clips = stats._count._all;
  const totalViews = stats._sum.currentViews ?? user.lifetimeViews ?? 0;
  const best = stats._max.currentViews ?? 0;
  const avg = clips > 0 ? Math.round(totalViews / clips) : 0;
  const verified = user.kycStatus === "VERIFIED";
  const joined = user.createdAt.toLocaleDateString("ru-RU", { month: "long", year: "numeric" });
  const platforms = platformGroups
    .map((group) => ({ key: group.platform, label: PLATFORM_LABEL[group.platform] || group.platform, count: group._count._all }))
    .sort((a, b) => b.count - a.count);
  const avatar = dicebear(user.handle, user.avatar);

  const isClient = viewer ? canManageClient(viewer.role) && (await getActiveRoleMode(viewer)) === "client" : false;
  const isSelf = viewer?.id === user.id;

  let pendingInviteId: string | null = null;
  let alreadyEndorsed = false;
  let viewerCanEndorse = false;
  if (viewer && isClient && !isSelf) {
    const [pi, ae, orders] = await Promise.all([
      prisma.collabInvite.findFirst({ where: { clientId: viewer.id, workerId: user.id, status: "PENDING" }, select: { id: true } }),
      prisma.endorsement.findFirst({ where: { clientId: viewer.id, workerId: user.id }, select: { id: true } }),
      prisma.campaign.count({ where: { ownerId: viewer.id } })
    ]);
    pendingInviteId = pi?.id || null;
    alreadyEndorsed = Boolean(ae);
    viewerCanEndorse = canEndorse(orders);
  }

  const showInviteForm = isClient && !isSelf && !pendingInviteId && invited !== "1";
  const showEndorseForm = isClient && !isSelf && viewerCanEndorse && !alreadyEndorsed && endorsed !== "1";

  // A single, honest read for a client deciding whether to work with this clipper.
  const verdict =
    avg >= 100_000
      ? { tone: "strong" as const, text: "Стабильно вирусит — высокая отдача с каждого клипа" }
      : avg >= 25_000
        ? { tone: "good" as const, text: "Уверенный исполнитель с хорошим средним охватом" }
        : clips > 0
          ? { tone: "neutral" as const, text: "Набирает обороты — растущий клиппер" }
          : { tone: "neutral" as const, text: "Новый клиппер — работ пока нет" };

  return (
    <AppShell>
      <section className="section cp">
        <Link className="cp-back" href="/leaderboard">
          <ArrowLeft size={16} /> К доске лидеров
        </Link>

        {/* HERO */}
        <header className="cp-hero">
          <div className="cp-hero-id">
            <div className="cp-ava fire-orb">
              <span className="fire-ring" aria-hidden="true" />
              <span className="flame" aria-hidden="true" />
              <img src={avatar} alt="" />
            </div>
            <div className="cp-id">
              <h1>
                {isSelf ? "Я" : user.name}
                {verified ? <BadgeCheck size={22} className="verified" aria-label="Проверенный клиппер" /> : null}
              </h1>
              <span className="cp-handle">@{user.handle}</span>
              <div className="cp-chips">
                <LeagueBadge views={user.lifetimeViews} size="sm" />
                {verified ? <span className="cp-chip cp-chip--ok"><BadgeCheck size={13} /> Проверен</span> : null}
                {endorsements.length ? (
                  <span className="cp-chip cp-chip--gold"><Award size={13} /> {endorsements.length} рекоменд.</span>
                ) : null}
                <span className="cp-chip cp-chip--muted"><CalendarDays size={13} /> с {joined}</span>
              </div>
            </div>
          </div>

          <div className="cp-hero-cta">
            <div className={`cp-verdict cp-verdict--${verdict.tone}`}>
              <Gauge size={15} /> {verdict.text}
            </div>
            {isSelf ? (
              <span className="cp-cta-note">Ваш публичный профиль</span>
            ) : isClient ? (
              showInviteForm ? (
                <a className="btn btn-primary cp-cta-btn" href="#cp-invite"><Sparkles size={16} /> Пригласить на коллаб</a>
              ) : (
                <div className="cp-invite-pending">
                  <span className="cp-cta-sent"><Check size={15} /> Приглашение отправлено</span>
                  {pendingInviteId ? (
                    <form action={cancelCollabInviteAction}>
                      <input type="hidden" name="inviteId" value={pendingInviteId} />
                      <input type="hidden" name="returnTo" value={`/clippers/${user.handle}`} />
                      <button className="cp-cancel-invite" type="submit">Отменить</button>
                    </form>
                  ) : null}
                </div>
              )
            ) : !viewer ? (
              <Link className="btn btn-primary cp-cta-btn" href="/login">Войти, чтобы пригласить</Link>
            ) : null}
          </div>
        </header>

        {user.bio || specialties.length || socialLinks.length ? (
          <div className="cp-about">
            {user.bio ? <p>{user.bio}</p> : null}
            {specialties.length ? <div>{specialties.map((item) => <span key={item}>{item}</span>)}</div> : null}
            {socialLinks.length ? <nav>{socialLinks.map((url) => (
              <a href={url} target="_blank" rel="noreferrer" key={url}>{new URL(url).hostname.replace(/^www\./, "")}</a>
            ))}</nav> : null}
          </div>
        ) : null}

        {!isSelf && viewer ? (
          <div className="cp-report">
            <ReportDialog
              contentType="USER"
              entityId={user.id}
              authorId={user.id}
              returnTo={`/clippers/${user.handle}`}
              label="Пожаловаться на профиль"
            />
          </div>
        ) : null}

        {/* SNAPSHOT */}
        <div className="cp-metrics">
          <div className="cp-metric">
            <span className="cp-metric-ico"><Eye size={16} /></span>
            <b>{compactNumber(totalViews)}</b>
            <em>всего просмотров</em>
          </div>
          <div className="cp-metric">
            <span className="cp-metric-ico"><Film size={16} /></span>
            <b>{clips}</b>
            <em>клипов</em>
          </div>
          <div className="cp-metric cp-metric--hl">
            <span className="cp-metric-ico"><TrendingUp size={16} /></span>
            <b>{compactNumber(avg)}</b>
            <em>в среднем на клип</em>
          </div>
          <div className="cp-metric">
            <span className="cp-metric-ico"><Sparkles size={16} /></span>
            <b>{compactNumber(best)}</b>
            <em>лучший клип</em>
          </div>
        </div>

        {platforms.length ? (
          <div className="cp-platforms">
            <span className="cp-platforms-label">Площадки</span>
            {platforms.map((p) => (
              <span className="cp-plat" key={p.key}>{p.label}<i>{p.count}</i></span>
            ))}
          </div>
        ) : null}

        {/* NOTES */}
        {invited === "1" ? <div className="cp-note ok"><Check size={15} /> Приглашение отправлено — ждём ответа клиппера.</div> : null}
        {endorsed === "1" ? <div className="cp-note ok"><Award size={15} /> Рекомендация добавлена. Спасибо!</div> : null}
        {error === "tier" ? <div className="cp-note warn">Рекомендовать могут только крупные заказчики (от 10 заказов).</div> : null}
        {error === "invite" ? <div className="cp-note warn">Не удалось отправить приглашение — добавьте текст.</div> : null}

        {/* PORTFOLIO */}
        <section className="cp-block">
          <h2 className="cp-h2">Лучшие работы</h2>
          {topSubs.length === 0 ? (
            <p className="cp-empty">Пока нет опубликованных работ.</p>
          ) : (
            <div className="cp-grid">
              {topSubs.map((sub) => {
                const thumb = thumbFor(sub.platform, sub.postUrl);
                return (
                <a className="cp-clip" href={sub.postUrl} target="_blank" rel="noreferrer" key={sub.id}>
                  {thumb
                    ? <img className="cp-clip-thumb" src={thumb} alt="" loading="lazy" />
                    : <span className="cp-clip-neutral">{PLATFORM_LABEL[sub.platform] || sub.platform}</span>}
                  <span className="cp-clip-plat">{PLATFORM_LABEL[sub.platform] || sub.platform}</span>
                  <span className="cp-clip-play"><Play size={16} fill="#fff" /></span>
                  <span className="cp-clip-views"><Eye size={13} /> {compactNumber(sub.currentViews)}</span>
                </a>
              )})}
            </div>
          )}
        </section>

        {/* SOCIAL PROOF */}
        {endorsements.length ? (
          <section className="cp-block">
            <h2 className="cp-h2">Рекомендуют заказчики</h2>
            <div className="cp-endorse-grid">
              {endorsements.map((e) => (
                <div className="cp-endorse" key={e.id}>
                  <div className="cp-endorse-by">
                    <img src={dicebear(e.client.handle, e.client.avatar)} alt="" loading="lazy" />
                    <div>
                      <strong>{e.client.name}</strong>
                      <span><Award size={12} /> рекомендует</span>
                    </div>
                  </div>
                  {e.note ? <p>«{e.note}»</p> : null}
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {/* CLIENT ACTIONS */}
        {isClient && !isSelf ? (
          <section className="cp-block cp-actions" id="cp-invite">
            <h2 className="cp-h2">Работа с клиппером</h2>
            <div className="cp-actions-grid">
              {showInviteForm ? (
                <form className="cp-form" action={sendCollabInviteAction}>
                  <input type="hidden" name="workerId" value={user.id} />
                  <input type="hidden" name="handle" value={user.handle} />
                  <label className="cp-form-label">Приглашение на совместный клип</label>
                  <textarea name="message" required maxLength={600} placeholder="Идея коллаба, условия, сроки…" />
                  <button className="btn btn-primary" type="submit"><Sparkles size={16} /> Пригласить на коллаб</button>
                </form>
              ) : (
                <div className="cp-form cp-form--done">
                  <span><Check size={18} /> Приглашение уже отправлено — ждём ответа.</span>
                  {pendingInviteId ? (
                    <form action={cancelCollabInviteAction}>
                      <input type="hidden" name="inviteId" value={pendingInviteId} />
                      <input type="hidden" name="returnTo" value={`/clippers/${user.handle}`} />
                      <button className="btn btn-ghost btn-small" type="submit">Отменить приглашение</button>
                    </form>
                  ) : null}
                </div>
              )}

              {showEndorseForm ? (
                <form className="cp-form" action={endorseClipperAction}>
                  <input type="hidden" name="workerId" value={user.id} />
                  <input type="hidden" name="handle" value={user.handle} />
                  <label className="cp-form-label">Рекомендация (бейдж «{viewer?.name} рекомендует»)</label>
                  <input name="note" maxLength={200} placeholder="За что рекомендуете (необязательно)" />
                  <button className="btn btn-gold" type="submit"><Award size={16} /> Рекомендовать</button>
                </form>
              ) : !viewerCanEndorse ? (
                <p className="cp-actions-hint"><Award size={14} /> Рекомендовать клипперов могут заказчики от 10 заказов.</p>
              ) : null}
            </div>
          </section>
        ) : null}
      </section>
    </AppShell>
  );
}
