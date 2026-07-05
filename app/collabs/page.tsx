import type { Metadata } from "next";
import Link from "next/link";
import { Archive, Check, Clock3, Handshake, Inbox, MessageCircle, RotateCcw, Send, Sparkles, Square, X } from "lucide-react";
import { AppShell } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { attachCollabCampaignAction, cancelCollabInviteAction, endCollabAction, respondCollabInviteAction } from "@/app/actions";
import { prisma } from "@/lib/prisma";
import styles from "./collabs.module.css";

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
  clientId: string;
  direction: "incoming" | "outgoing";
  status: string;
  message: string;
  createdAt: Date;
  partner: { name: string; handle: string; avatar: string | null };
  campaign: { id: string; title: string } | null;
  role: string;
  deadline: Date | null;
  chatThread: { id: string } | null;
};

function CollabCard({ item, viewerId, campaigns }: { item: CardItem; viewerId: string; campaigns: Array<{ id: string; title: string }> }) {
  const pending = item.status === "PENDING";
  const accepted = item.status === "ACCEPTED";
  return (
    <article className={styles.card}>
      <Link className={styles.person} href={`/clippers/${item.partner.handle}?returnTo=%2Fcollabs`}>
        <img src={avatarFor(item.partner.handle, item.partner.avatar)} alt="" loading="lazy" />
        <span>
          <strong>{item.partner.name}</strong>
          <small>@{item.partner.handle} · {relativeDate(item.createdAt)}</small>
        </span>
      </Link>
      <span className={styles.status}>
        {pending ? <Clock3 size={13} /> : accepted ? <Check size={13} /> : item.status === "COMPLETED" ? <Sparkles size={13} /> : <X size={13} />}
        {STATUS[item.status] || item.status}
      </span>
      <div className={styles.context}>
        <span><small>Кампания</small><strong>{item.campaign?.title || "Старое приглашение"}</strong></span>
        <span><small>Роль</small><strong>{item.role}</strong></span>
        <span><small>Срок</small><strong>{item.deadline ? item.deadline.toLocaleDateString("ru-RU") : "Не указан"}</strong></span>
      </div>
      <p>{item.message}</p>
      {accepted && !item.campaign && item.clientId === viewerId ? (
        <form className={styles.attach} action={attachCollabCampaignAction}>
          <input type="hidden" name="inviteId" value={item.id} />
          <select name="campaignId" required defaultValue="">
            <option value="" disabled>Прикрепить кампанию</option>
            {campaigns.map((campaign) => <option value={campaign.id} key={campaign.id}>{campaign.title}</option>)}
          </select>
          <button className={styles.primary} type="submit">Прикрепить</button>
        </form>
      ) : null}
      <div className={styles.actions}>
        {item.direction === "incoming" && pending ? (
          <>
            <form action={respondCollabInviteAction}>
              <input type="hidden" name="inviteId" value={item.id} />
              <input type="hidden" name="decision" value="decline" />
              <button className={styles.ghost} type="submit"><X size={15} /> Отклонить</button>
            </form>
            <form action={respondCollabInviteAction}>
              <input type="hidden" name="inviteId" value={item.id} />
              <input type="hidden" name="decision" value="accept" />
              <button className={styles.primary} type="submit"><MessageCircle size={15} /> Обсудить</button>
            </form>
          </>
        ) : null}
        {item.direction === "outgoing" && pending ? (
          <form action={cancelCollabInviteAction}>
            <input type="hidden" name="inviteId" value={item.id} />
            <button className={styles.ghost} type="submit"><RotateCcw size={14} /> Отозвать</button>
          </form>
        ) : null}
        {accepted && item.chatThread ? (
          <Link className={styles.primary} href={`/chats?thread=${item.chatThread.id}&type=collabs`}>
            <MessageCircle size={15} /> В обсуждение
          </Link>
        ) : null}
        {accepted ? (
          <form action={endCollabAction}>
            <input type="hidden" name="inviteId" value={item.id} />
            <button className={styles.ghost} type="submit"><Square size={13} /> Завершить</button>
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
  const [incomingRaw, outgoingRaw, archiveRaw, clientCampaigns] = await Promise.all([
    prisma.collabInvite.findMany({
      where: {
        initiatorId: { not: user.id },
        status: { in: ["PENDING", "ACCEPTED"] },
        OR: [{ workerId: user.id }, { clientId: user.id }]
      },
      include: { client: { select: { name: true, handle: true, avatar: true } }, worker: { select: { name: true, handle: true, avatar: true } }, campaign: { select: { id: true, title: true } }, chatThread: { select: { id: true } } },
      orderBy: { createdAt: "desc" },
      take: 50
    }),
    prisma.collabInvite.findMany({
      where: { initiatorId: user.id, status: { in: ["PENDING", "ACCEPTED"] } },
      include: { client: { select: { name: true, handle: true, avatar: true } }, worker: { select: { name: true, handle: true, avatar: true } }, campaign: { select: { id: true, title: true } }, chatThread: { select: { id: true } } },
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
        campaign: { select: { id: true, title: true } },
        chatThread: { select: { id: true } }
      },
      orderBy: { createdAt: "desc" },
      take: 80
    }),
    prisma.campaign.findMany({
      where: { ownerId: user.id, status: { in: ["ACTIVE", "LOW_BUDGET"] }, deadline: { gt: new Date() } },
      select: { id: true, title: true },
      orderBy: { createdAt: "desc" },
      take: 30
    })
  ]);

  const incoming: CardItem[] = incomingRaw.map((item) => ({ ...item, direction: "incoming", partner: item.clientId === user.id ? item.worker : item.client }));
  const outgoing: CardItem[] = outgoingRaw.map((item) => ({ ...item, direction: "outgoing", partner: item.clientId === user.id ? item.worker : item.client }));
  const archive: CardItem[] = archiveRaw.map((item) => ({
    ...item,
    direction: item.initiatorId === user.id ? "outgoing" : "incoming",
    partner: item.clientId === user.id ? item.worker : item.client
  }));
  const items = tab === "incoming" ? incoming : tab === "outgoing" ? outgoing : archive;

  return (
    <AppShell>
      <section className={`section ${styles.page}`}>
        <header className={styles.hero}>
          <span><Handshake size={15} /> Коллабы</span>
          <h1>Создавайте вместе</h1>
          <p>Заказчик приглашает подходящего клиппера, после чего условия и следующий шаг остаются в одном обсуждении.</p>
          <Link href="/leaderboard">Найти клиппера <Send size={15} /></Link>
        </header>

        <nav className={styles.tabs} aria-label="Разделы коллабов">
          <Link data-active={tab === "incoming"} href="/collabs">
            <Inbox size={16} /> <span>Входящие</span> <b>{incoming.length}</b>
          </Link>
          <Link data-active={tab === "outgoing"} href="/collabs?tab=outgoing">
            <Send size={16} /> <span>Исходящие</span> <b>{outgoing.length}</b>
          </Link>
          <Link data-active={tab === "archive"} href="/collabs?tab=archive">
            <Archive size={16} /> <span>Архив</span> <b>{archive.length}</b>
          </Link>
        </nav>

        <section className={styles.list}>
          <header>
            <div><small>{tab === "incoming" ? "Новые предложения" : tab === "outgoing" ? "Ваши приглашения" : "История"}</small><h2>{tab === "incoming" ? "Входящие" : tab === "outgoing" ? "Исходящие" : "Архив"}</h2></div>
            <span>{items.length} коллабов</span>
          </header>
          {items.length ? items.map((item) => <CollabCard item={item} viewerId={user.id} campaigns={clientCampaigns} key={item.id} />) : (
            <div className={styles.empty}>
              <Handshake size={28} />
              <strong>Здесь пока пусто</strong>
              <p>{tab === "incoming" ? "Новые приглашения появятся здесь." : tab === "outgoing" ? "Выберите исполнителя на доске лидеров." : "Завершённые коллабы появятся в архиве."}</p>
            </div>
          )}
        </section>

        <section className={styles.how}>
          <span>1<strong>Заказчик приглашает</strong><small>Выбирает клиппера на доске лидеров.</small></span>
          <span>2<strong>Стороны уточняют условия</strong><small>Кампания, срок и требования остаются в чате.</small></span>
          <span>3<strong>Клиппер выполняет заказ</strong><small>Публикация и проверка проходят через ReelPay.</small></span>
        </section>
      </section>
    </AppShell>
  );
}
