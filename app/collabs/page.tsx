import type { Metadata } from "next";
import Link from "next/link";
import { Check, Handshake, Inbox, Send, X } from "lucide-react";
import { AppShell } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { respondCollabInviteAction } from "@/app/actions";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Коллабы" };

const STATUS: Record<string, string> = {
  PENDING: "Ожидает",
  ACCEPTED: "Принято",
  DECLINED: "Отклонено",
  CANCELLED: "Отменено"
};

function avatarFor(handle: string, avatar: string | null) {
  return avatar || `https://api.dicebear.com/9.x/thumbs/svg?seed=${encodeURIComponent(handle || "user")}`;
}

export default async function CollabsPage() {
  const user = await requireUser();
  const [incoming, sent] = await Promise.all([
    prisma.collabInvite.findMany({
      where: { workerId: user.id },
      include: { client: { select: { name: true, handle: true, avatar: true } } },
      orderBy: { createdAt: "desc" },
      take: 50
    }),
    prisma.collabInvite.findMany({
      where: { clientId: user.id },
      include: { worker: { select: { name: true, handle: true, avatar: true } } },
      orderBy: { createdAt: "desc" },
      take: 50
    })
  ]);
  const pendingCount = incoming.filter((i) => i.status === "PENDING").length;

  return (
    <AppShell>
      <section className="section collabs-page">
        <header className="collabs-head">
          <span className="eyebrow"><Handshake size={15} /> Коллабы</span>
          <h1>Совместные клипы</h1>
          <p>Заказчики приглашают клипперов на совместные ролики. Принимай интересные — и работайте вместе.</p>
        </header>

        <h2 className="collabs-section">
          <Inbox size={18} /> Входящие {pendingCount ? <span className="collabs-badge">{pendingCount}</span> : null}
        </h2>
        {incoming.length === 0 ? (
          <p className="muted">Пока нет приглашений. Попадай в топ — и заказчики позовут на коллаб.</p>
        ) : (
          <ul className="collab-list">
            {incoming.map((invite) => (
              <li className={`collab-item collab-${invite.status.toLowerCase()}`} key={invite.id}>
                <img src={avatarFor(invite.client.handle, invite.client.avatar)} alt="" loading="lazy" />
                <div className="collab-body">
                  <strong>{invite.client.name}</strong>
                  <p>{invite.message}</p>
                </div>
                {invite.status === "PENDING" ? (
                  <div className="collab-buttons">
                    <form action={respondCollabInviteAction}>
                      <input type="hidden" name="inviteId" value={invite.id} />
                      <input type="hidden" name="decision" value="accept" />
                      <button className="collab-accept" type="submit"><Check size={15} /> Принять</button>
                    </form>
                    <form action={respondCollabInviteAction}>
                      <input type="hidden" name="inviteId" value={invite.id} />
                      <input type="hidden" name="decision" value="decline" />
                      <button className="collab-decline" type="submit"><X size={15} /></button>
                    </form>
                  </div>
                ) : (
                  <span className={`collab-status st-${invite.status.toLowerCase()}`}>{STATUS[invite.status]}</span>
                )}
              </li>
            ))}
          </ul>
        )}

        <h2 className="collabs-section"><Send size={18} /> Отправленные</h2>
        {sent.length === 0 ? (
          <p className="muted">
            Ты ещё никого не приглашал. Найди клипперов на <Link href="/leaderboard">доске лидеров</Link>.
          </p>
        ) : (
          <ul className="collab-list">
            {sent.map((invite) => (
              <li className={`collab-item collab-${invite.status.toLowerCase()}`} key={invite.id}>
                <img src={avatarFor(invite.worker.handle, invite.worker.avatar)} alt="" loading="lazy" />
                <div className="collab-body">
                  <Link href={`/clippers/${invite.worker.handle}`}><strong>{invite.worker.name}</strong></Link>
                  <p>{invite.message}</p>
                </div>
                <span className={`collab-status st-${invite.status.toLowerCase()}`}>{STATUS[invite.status]}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </AppShell>
  );
}
