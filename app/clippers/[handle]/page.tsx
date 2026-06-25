import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Award, BadgeCheck, Check, Eye, Film, Play, Sparkles } from "lucide-react";
import { AppShell } from "@/components/ui";
import { LeagueBadge } from "@/components/league-badge";
import { endorseClipperAction, sendCollabInviteAction } from "@/app/actions";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, canManageClient } from "@/lib/auth";
import { canEndorse } from "@/lib/leagues";
import { compactNumber } from "@/lib/money";

const COVERS = [
  "/assets/gaming-order.png",
  "/assets/podcast-order.png",
  "/assets/marketplace-thumb.png",
  "/assets/hero-studio.png",
  "/assets/creator-nika.png"
];

function coverFor(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return COVERS[hash % COVERS.length];
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
    select: { id: true, name: true, handle: true, avatar: true, lifetimeViews: true, kycStatus: true }
  });
  if (!user) notFound();

  const [subs, endorsements, viewer] = await Promise.all([
    prisma.submission.findMany({
      where: { workerId: user.id },
      select: { id: true, currentViews: true, postUrl: true },
      orderBy: { currentViews: "desc" },
      take: 9
    }),
    prisma.endorsement.findMany({
      where: { workerId: user.id },
      select: { id: true, note: true, client: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 12
    }),
    getCurrentUser()
  ]);

  const best = subs[0]?.currentViews ?? 0;
  const isClient = viewer ? canManageClient(viewer.role) : false;
  const isSelf = viewer?.id === user.id;
  const avatar = user.avatar || `https://api.dicebear.com/9.x/thumbs/svg?seed=${encodeURIComponent(user.handle)}`;

  let pendingInvite = false;
  let alreadyEndorsed = false;
  let viewerCanEndorse = false;
  if (viewer && isClient && !isSelf) {
    const [pi, ae, orders] = await Promise.all([
      prisma.collabInvite.findFirst({ where: { clientId: viewer.id, workerId: user.id, status: "PENDING" }, select: { id: true } }),
      prisma.endorsement.findFirst({ where: { clientId: viewer.id, workerId: user.id }, select: { id: true } }),
      prisma.campaign.count({ where: { ownerId: viewer.id } })
    ]);
    pendingInvite = Boolean(pi);
    alreadyEndorsed = Boolean(ae);
    viewerCanEndorse = canEndorse(orders);
  }

  const showInviteForm = isClient && !isSelf && !pendingInvite && invited !== "1";
  const showEndorseForm = isClient && !isSelf && viewerCanEndorse && !alreadyEndorsed && endorsed !== "1";

  return (
    <AppShell>
      <section className="section clipper-page">
        <Link className="detail-back" href="/leaderboard">
          <ArrowLeft size={17} /> К доске лидеров
        </Link>

        <header className="clipper-hero">
          <div className="clipper-ava">
            <span className="flame" aria-hidden="true" />
            <img src={avatar} alt="" />
          </div>
          <div className="clipper-id">
            <h1>
              {user.name}
              {user.kycStatus === "VERIFIED" ? <BadgeCheck size={20} className="verified" /> : null}
            </h1>
            <span className="clipper-handle">@{user.handle}</span>
            <LeagueBadge views={user.lifetimeViews} />
            {endorsements.length ? (
              <div className="endorse-badges">
                {endorsements.map((e) => (
                  <span className="endorse-badge" key={e.id} title={e.note || undefined}>
                    <Award size={13} /> {e.client.name} рекомендует
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        </header>

        <div className="clipper-stats">
          <div><Eye size={17} /><b>{compactNumber(user.lifetimeViews)}</b><em>всего просмотров</em></div>
          <div><Film size={17} /><b>{subs.length}</b><em>клипов</em></div>
          <div><Sparkles size={17} /><b>{compactNumber(best)}</b><em>лучший клип</em></div>
        </div>

        {invited === "1" ? (
          <div className="collab-note ok"><Check size={15} /> Приглашение отправлено — ждём ответа клиппера.</div>
        ) : null}
        {endorsed === "1" ? (
          <div className="collab-note ok"><Award size={15} /> Рекомендация добавлена. Спасибо!</div>
        ) : null}
        {error === "tier" ? (
          <div className="collab-note warn">Рекомендовать могут только крупные заказчики (от 10 заказов).</div>
        ) : null}
        {error === "invite" ? (
          <div className="collab-note warn">Не удалось отправить приглашение — добавьте текст.</div>
        ) : null}

        {isClient && !isSelf ? (
          <div className="collab-actions">
            {showInviteForm ? (
              <form className="collab-form" action={sendCollabInviteAction}>
                <input type="hidden" name="workerId" value={user.id} />
                <input type="hidden" name="handle" value={user.handle} />
                <label className="collab-label">Приглашение на совместный клип</label>
                <textarea name="message" required maxLength={600} placeholder="Идея коллаба, условия, сроки…" />
                <button className="btn btn-primary" type="submit"><Sparkles size={16} /> Пригласить на коллаб</button>
              </form>
            ) : (
              <div className="collab-sent"><Check size={16} /> Приглашение уже отправлено</div>
            )}

            {showEndorseForm ? (
              <form className="endorse-form" action={endorseClipperAction}>
                <input type="hidden" name="workerId" value={user.id} />
                <input type="hidden" name="handle" value={user.handle} />
                <label className="collab-label">Рекомендация (бейдж «{viewer?.name} рекомендует»)</label>
                <input name="note" maxLength={200} placeholder="За что рекомендуете (необязательно)" />
                <button className="btn btn-gold" type="submit"><Award size={16} /> Рекомендовать</button>
              </form>
            ) : !viewerCanEndorse ? (
              <p className="collab-hint">Рекомендовать клипперов могут заказчики от 10 заказов.</p>
            ) : null}
          </div>
        ) : null}

        <h2 className="clipper-section-title">Лучшие работы</h2>
        {subs.length === 0 ? (
          <p className="muted">Пока нет опубликованных работ.</p>
        ) : (
          <div className="clipper-clips">
            {subs.map((sub) => (
              <a
                className="clipper-clip"
                href={sub.postUrl}
                target="_blank"
                rel="noreferrer"
                style={{ backgroundImage: `linear-gradient(180deg, rgba(0,0,0,.05), rgba(0,0,0,.78)), url('${coverFor(sub.id)}')` }}
                key={sub.id}
              >
                <span className="clipper-clip-play"><Play size={16} fill="#fff" /></span>
                <span className="clipper-clip-views"><Eye size={13} /> {compactNumber(sub.currentViews)}</span>
              </a>
            ))}
          </div>
        )}
      </section>
    </AppShell>
  );
}
