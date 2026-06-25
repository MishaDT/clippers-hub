import Link from "next/link";
import { MessageCircle, Search } from "lucide-react";
import { AppShell, Card } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { compactNumber } from "@/lib/money";

export const dynamic = "force-dynamic";

function shortDate(date: Date) {
  return date.toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export default async function ChatsPage() {
  const user = await requireUser();
  const threads = await prisma.chatThread.findMany({
    where: { OR: [{ clientId: user.id }, { workerId: user.id }] },
    include: {
      campaign: { select: { id: true, title: true, viewThreshold: true } },
      client: { select: { id: true, name: true } },
      worker: { select: { id: true, name: true, handle: true } },
      submission: { select: { status: true, currentViews: true, fraudScore: true } },
      messages: { orderBy: { createdAt: "desc" }, take: 1 }
    },
    orderBy: { updatedAt: "desc" },
    take: 80
  });

  return (
    <AppShell>
      <section className="chats-screen">
        <div className="screen-title">
          <span className="lp-proof"><MessageCircle size={15} /> Чаты</span>
          <h1>Все рабочие диалоги</h1>
          <p className="lead">Здесь только чаты по уже взятым заказам. Нажми строку, чтобы открыть заказ, прогресс и переписку.</p>
        </div>

        <Card className="chat-search-card">
          <Search size={18} />
          <span>Поиск и фильтры подключим поверх этой структуры, когда диалогов станет много.</span>
        </Card>

        <div className="chat-thread-list">
          {threads.map((thread) => {
            const peer = thread.clientId === user.id ? thread.worker : thread.client;
            const last = thread.messages[0];
            return (
              <Link className="chat-thread-row" href={`/campaigns/${thread.campaignId}#chat`} key={thread.id}>
                <span className="thread-avatar">{peer.name.slice(0, 2).toUpperCase()}</span>
                <span className="thread-main">
                  <b>{peer.name}</b>
                  <em>{thread.campaign.title}</em>
                  <small>{last?.body || "Диалог создан, сообщений пока нет"}</small>
                </span>
                <span className="thread-meta">
                  <b>{thread.submission?.status || "NEW"}</b>
                  <em>{compactNumber(thread.submission?.currentViews || 0)} / {compactNumber(thread.campaign.viewThreshold)}</em>
                  <small>{shortDate(thread.updatedAt)}</small>
                </span>
              </Link>
            );
          })}
          {!threads.length ? (
            <Card className="empty-box">
              <h2>Чатов пока нет</h2>
              <p>Откликнись на заказ или дождись исполнителя по своей кампании. После этого чат появится здесь автоматически.</p>
              <Link className="btn btn-primary" href="/campaigns">Найти заказ</Link>
            </Card>
          ) : null}
        </div>
      </section>
    </AppShell>
  );
}
