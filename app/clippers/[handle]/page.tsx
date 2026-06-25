import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, BadgeCheck, Eye, Film, Play, Sparkles } from "lucide-react";
import { AppShell } from "@/components/ui";
import { LeagueBadge } from "@/components/league-badge";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, canManageClient } from "@/lib/auth";
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

export default async function ClipperPortfolioPage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const user = await prisma.user.findUnique({
    where: { handle },
    select: { id: true, name: true, handle: true, avatar: true, lifetimeViews: true, kycStatus: true }
  });
  if (!user) notFound();

  const subs = await prisma.submission.findMany({
    where: { workerId: user.id },
    select: { id: true, currentViews: true, postUrl: true, platform: true },
    orderBy: { currentViews: "desc" },
    take: 9
  });
  const totalViews = subs.reduce((sum, s) => sum + s.currentViews, 0);
  const best = subs[0]?.currentViews ?? 0;
  const viewer = await getCurrentUser();
  const canInvite = viewer ? canManageClient(viewer.role) : false;
  const avatar = user.avatar || `https://api.dicebear.com/9.x/thumbs/svg?seed=${encodeURIComponent(user.handle)}`;

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
          </div>
          <div className="clipper-cta">
            {canInvite ? (
              <button className="btn btn-primary" type="button" disabled title="Коллаб-приглашения скоро">
                <Sparkles size={16} /> Пригласить на коллаб
              </button>
            ) : null}
            <small>Коллаб-приглашения подключаем — скоро.</small>
          </div>
        </header>

        <div className="clipper-stats">
          <div><Eye size={17} /><b>{compactNumber(user.lifetimeViews)}</b><em>всего просмотров</em></div>
          <div><Film size={17} /><b>{subs.length}</b><em>клипов</em></div>
          <div><Sparkles size={17} /><b>{compactNumber(best)}</b><em>лучший клип</em></div>
        </div>

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
