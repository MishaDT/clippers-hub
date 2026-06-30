import type { Metadata } from "next";
import Link from "next/link";
import { Archive, Check, Clock3, Handshake, Inbox, MessageCircle, RotateCcw, Send, Sparkles, Square, X } from "lucide-react";
import { AppShell } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { cancelCollabInviteAction, endCollabAction, respondCollabInviteAction } from "@/app/actions";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Коллабы" };
export const dynamic = "force-dynamic";

const STATUS: Record<string, string> = {
  PENDING: "Ожидает ответа",
  ACCEPTED: "Принято",
  DECLINED: "Отклонено",
  CANCELLED: "Отменено",
  COMPLETED: "Завершено"
};

function avatarFor(handle: string, avatar: string | null) {
  return avatar || `https://api.dicebear.com/9.x/adventurer/svg?seed=${encodeURIComponent(handle || "user")}&backgroundColor=transparent`;
}

function relativeDate(date: Date) {
  const diff = Date.now() - date.getTime();
  if (diff < 60 * 60 * 1000) return `${Math.max(1, Math.floor(diff / 60000))} мин назад`;
  if (diff < 24 * 60 * 60 * 1000) return `${Math.floor(diff / 3600000)} ч назад`;
  return date.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

type CardItem = {
  id: string;
  direction: "incoming" | "outgoing";
  status: string;
  message: string;
  createdAt: Date;
  partner: { name: string; handle: string; avatar: string | null };
  chatThread: { id: string } | null;
};

function CollabCard({ item }: { item: CardItem }) {
  const pending = item.status === "PENDING";
  const accepted = item.status === "ACCEPTED";
  return (
    <article className={`collab-v2-card state-${item.status.toLowerCase()}`}>
      <Link className="collab-v2-person" href={`/clippers/${item.partner.handle}?returnTo=%2Fcollabs`}>
        <img src={avatarFor(item.partner.handle, item.partner.avatar)} alt="" loading="lazy" />
        <span>
          <strong>{item.partner.name}</strong>
          <small>@{item.partner.handle} · {relativeDate(item.createdAt)}</small>
        </span>
      </Link>
      <span className={`collab-v2-status status-${item.status.toLowerCase()}`}>
        {pending ? <Clock3 size={13} /> : accepted ? <Check size={13} /> : item.status === "COMPLETED" ? <Sparkles size={13} /> : <X size={13} />}
        {STATUS[item.status] || item.status}
      </span>
      <p>{item.message}</p>
      <div className="collab-v2-actions">
        {item.direction === "incoming" && pending ? (
          <>
            <form action={respondCollabInviteAction}>
              <input type="hidden" name="inviteId" value={item.id} />
              <input type="hidden" name="decision" value="decline" />
              <button className="collab-v2-ghost" type="submit"><X size={15} /> Отклонить</button>
            </form>
            <form action={respondCollabInviteAction}>
              <input type="hidden" name="inviteId" value={item.id} />
              <input type="hidden" name="decision" value="accept" />
              <button className="collab-v2-primary" type="submit"><MessageCircle size={15} /> Обсудить</button>
            </form>
          </>
        ) : null}
        {item.direction === "outgoing" && pending ? (
          <form action={cancelCollabInviteAction}>
            <input type="hidden" name="inviteId" value={item.id} />
            <button className="collab-v2-ghost" type="submit"><RotateCcw size={14} /> Отозвать</button>
          </form>
        ) : null}
        {accepted && item.chatThread ? (
          <Link className="collab-v2-primary" href={`/chats?thread=${item.chatThread.id}&type=collabs`}>
            <MessageCircle size={15} /> В обсуждение
          </Link>
        ) : null}
        {accepted ? (
          <form action={endCollabAction}>
            <input type="hidden" name="inviteId" value={item.id} />
            <button className="collab-v2-ghost" type="submit"><Square size={13} /> Завершить</button>
          </form>
        ) : null}
      </div>
    </article>
  );
}

export default async function CollabsPage({
  searchParams
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const tab = params.tab === "outgoing" ? "outgoing" : params.tab === "archive" ? "archive" : "incoming";
  const terminal = ["DECLINED", "CANCELLED", "COMPLETED"];
  const [incomingRaw, outgoingRaw, archiveRaw] = await Promise.all([
    prisma.collabInvite.findMany({
      where: { workerId: user.id, status: { in: ["PENDING", "ACCEPTED"] } },
      include: { client: { select: { name: true, handle: true, avatar: true } }, chatThread: { select: { id: true } } },
      orderBy: { createdAt: "desc" },
      take: 50
    }),
    prisma.collabInvite.findMany({
      where: { clientId: user.id, status: { in: ["PENDING", "ACCEPTED"] } },
      include: { worker: { select: { name: true, handle: true, avatar: true } }, chatThread: { select: { id: true } } },
      orderBy: { createdAt: "desc" },
      take: 50
    }),
    prisma.collabInvite.findMany({
      where: {
        status: { in: terminal },
        OR: [{ workerId: user.id }, { clientId: user.id }]
      },
      include: {
        client: { select: { name: true, handle: true, avatar: true } },
        worker: { select: { name: true, handle: true, avatar: true } },
        chatThread: { select: { id: true } }
      },
      orderBy: { createdAt: "desc" },
      take: 80
    })
  ]);

  const incoming: CardItem[] = incomingRaw.map((item) => ({ ...item, direction: "incoming", partner: item.client }));
  const outgoing: CardItem[] = outgoingRaw.map((item) => ({ ...item, direction: "outgoing", partner: item.worker }));
  const archive: CardItem[] = archiveRaw.map((item) => ({
    ...item,
    direction: item.clientId === user.id ? "outgoing" : "incoming",
    partner: item.clientId === user.id ? item.worker : item.client
  }));
  const items = tab === "incoming" ? incoming : tab === "outgoing" ? outgoing : archive;

  return (
    <AppShell>
      <section className="section collabs-v2-page">
        <header className="collabs-v2-hero">
          <span><Handshake size={15} /> Коллабы</span>
          <h1>Создавайте вместе</h1>
          <p>Принимайте приглашения, обсуждайте роли и выпускайте совместные клипы в одном рабочем процессе.</p>
          <Link href="/leaderboard">Найти партнёра <Send size={15} /></Link>
        </header>

        <nav className="collabs-v2-tabs" aria-label="Разделы коллабов">
          <Link className={tab === "incoming" ? "active" : ""} href="/collabs">
            <Inbox size={16} /> Входящие <b>{incoming.length}</b>
          </Link>
          <Link className={tab === "outgoing" ? "active" : ""} href="/collabs?tab=outgoing">
            <Send size={16} /> Исходящие <b>{outgoing.length}</b>
          </Link>
          <Link className={tab === "archive" ? "active" : ""} href="/collabs?tab=archive">
            <Archive size={16} /> Архив <b>{archive.length}</b>
          </Link>
        </nav>

        <section className="collabs-v2-list">
          <header>
            <div><small>{tab === "incoming" ? "Новые предложения" : tab === "outgoing" ? "Ваши приглашения" : "История"}</small><h2>{tab === "incoming" ? "Входящие" : tab === "outgoing" ? "Исходящие" : "Архив"}</h2></div>
            <span>{items.length} коллабов</span>
          </header>
          {items.length ? items.map((item) => <CollabCard item={item} key={item.id} />) : (
            <div className="collabs-v2-empty">
              <Handshake size={28} />
              <strong>Здесь пока пусто</strong>
              <p>{tab === "incoming" ? "Новые приглашения появятся здесь." : tab === "outgoing" ? "Выберите исполнителя на доске лидеров." : "Завершённые коллабы появятся в архиве."}</p>
            </div>
          )}
        </section>

        <section className="collabs-v2-how">
          <span>1<strong>Получи или отправь</strong><small>Выберите партнёра и предложите идею.</small></span>
          <span>2<strong>Обсудите условия</strong><small>Сроки, формат и роли — в чате.</small></span>
          <span>3<strong>Снимайте и публикуйте</strong><small>История останется в одном месте.</small></span>
        </section>
      </section>
    </AppShell>
  );
}
