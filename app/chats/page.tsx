import Link from "next/link";
import {
  ArrowLeft,
  BriefcaseBusiness,
  ChevronLeft,
  CircleDashed,
  MessageCircle,
  Search
} from "lucide-react";
import type { Prisma, SubmissionStatus } from "@prisma/client";
import { CampaignChat } from "@/components/campaign-chat";
import { AppShell } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { buildSafePreview } from "@/lib/chat-safety";
import { parseJson } from "@/lib/json";
import { compactNumber } from "@/lib/money";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const activeStatuses: SubmissionStatus[] = ["ACCEPTED", "POSTED", "VERIFIED", "THRESHOLD_MET", "SETTLING"];
const finishedStatuses: SubmissionStatus[] = ["PAID", "REJECTED"];
const threadsPerPage = 30;

function shortDate(date: Date) {
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  return date.toLocaleString("ru-RU", sameDay
    ? { hour: "2-digit", minute: "2-digit" }
    : { day: "2-digit", month: "short" });
}

function messageDate(date: Date) {
  return date.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function statusLabel(status?: string | null) {
  const labels: Record<string, string> = {
    ACCEPTED: "Заказ взят",
    POSTED: "Работа отправлена",
    VERIFIED: "Идет трекинг",
    THRESHOLD_MET: "Цель достигнута",
    SETTLING: "Проверка выплаты",
    PAID: "Оплачено",
    REJECTED: "Нужна проверка"
  };
  return labels[status || ""] || "Обсуждение";
}

function avatarFor(handle: string, avatar: string | null) {
  return avatar || `https://api.dicebear.com/9.x/thumbs/svg?seed=${encodeURIComponent(handle || "user")}`;
}

function hrefWith(params: { thread?: string; q?: string; status?: string; page?: number }) {
  const search = new URLSearchParams();
  if (params.thread) search.set("thread", params.thread);
  if (params.q) search.set("q", params.q);
  if (params.status && params.status !== "all") search.set("status", params.status);
  if (params.page && params.page > 1) search.set("page", String(params.page));
  const value = search.toString();
  return value ? `/chats?${value}` : "/chats";
}

export default async function ChatsPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q.trim().slice(0, 80) : "";
  const status = params.status === "active" || params.status === "done" ? params.status : "all";
  const requestedThreadId = typeof params.thread === "string" ? params.thread : "";
  const requestedPage = Math.max(1, Number.parseInt(typeof params.page === "string" ? params.page : "1", 10) || 1);

  const where: Prisma.ChatThreadWhereInput = {
    AND: [
      { OR: [{ clientId: user.id }, { workerId: user.id }] },
      ...(query ? [{
        OR: [
          { campaign: { title: { contains: query, mode: "insensitive" as const } } },
          { client: { name: { contains: query, mode: "insensitive" as const } } },
          { client: { handle: { contains: query, mode: "insensitive" as const } } },
          { worker: { name: { contains: query, mode: "insensitive" as const } } },
          { worker: { handle: { contains: query, mode: "insensitive" as const } } }
        ]
      }] : []),
      ...(status === "active" ? [{ submission: { status: { in: activeStatuses } } }] : []),
      ...(status === "done" ? [{ submission: { status: { in: finishedStatuses } } }] : [])
    ]
  };
  const totalThreads = await prisma.chatThread.count({ where });
  const totalPages = Math.max(1, Math.ceil(totalThreads / threadsPerPage));
  const currentPage = Math.min(requestedPage, totalPages);
  const threads = await prisma.chatThread.findMany({
    where,
    include: {
      campaign: { select: { id: true, title: true, viewThreshold: true } },
      client: { select: { id: true, name: true, handle: true, avatar: true } },
      worker: { select: { id: true, name: true, handle: true, avatar: true } },
      submission: { select: { status: true, currentViews: true, fraudScore: true } },
      messages: { orderBy: { createdAt: "desc" }, take: 1 }
    },
    orderBy: { updatedAt: "desc" },
    skip: (currentPage - 1) * threadsPerPage,
    take: threadsPerPage
  });

  const selectedThreadId = requestedThreadId || threads[0]?.id || "";
  const selectedThread = selectedThreadId
    ? await prisma.chatThread.findFirst({
        where: {
          id: selectedThreadId,
          OR: [{ clientId: user.id }, { workerId: user.id }]
        },
        include: {
          campaign: { select: { id: true, title: true, viewThreshold: true } },
          client: { select: { id: true, name: true, handle: true, avatar: true } },
          worker: { select: { id: true, name: true, handle: true, avatar: true } },
          submission: { select: { status: true, currentViews: true, fraudScore: true } },
          messages: {
            include: { sender: { select: { id: true, name: true } } },
            orderBy: { createdAt: "asc" },
            take: 100
          }
        }
      })
    : null;

  const selectedPeer = selectedThread
    ? selectedThread.clientId === user.id ? selectedThread.worker : selectedThread.client
    : null;
  const selectedStatus = selectedThread?.submission?.status;
  const progressSteps = [
    { title: "Заказ взят", done: Boolean(selectedThread?.submission), active: selectedStatus === "ACCEPTED" },
    { title: "Работа", done: ["POSTED", "VERIFIED", "THRESHOLD_MET", "SETTLING", "PAID"].includes(selectedStatus || ""), active: selectedStatus === "POSTED" },
    { title: "Просмотры", done: ["THRESHOLD_MET", "SETTLING", "PAID"].includes(selectedStatus || ""), active: ["VERIFIED", "POSTED"].includes(selectedStatus || "") },
    { title: "Выплата", done: selectedStatus === "PAID", active: ["THRESHOLD_MET", "SETTLING"].includes(selectedStatus || "") }
  ];

  return (
    <AppShell immersive>
      <section className={`chats-app ${requestedThreadId ? "has-selection" : ""}`}>
        <aside className="chat-sidebar">
          <div className="chat-sidebar-head">
            <div>
              <span><MessageCircle size={15} /> Сообщения</span>
              <h1>Чаты</h1>
            </div>
            <b>{totalThreads}</b>
          </div>

          <form className="chat-search" action="/chats">
            <Search size={17} />
            <input name="q" defaultValue={query} placeholder="Человек или заказ" aria-label="Поиск чатов" />
            {status !== "all" ? <input type="hidden" name="status" value={status} /> : null}
          </form>

          <nav className="chat-filters" aria-label="Фильтр чатов">
            <Link className={status === "all" ? "active" : ""} href={hrefWith({ q: query })}>Все</Link>
            <Link className={status === "active" ? "active" : ""} href={hrefWith({ q: query, status: "active" })}>В работе</Link>
            <Link className={status === "done" ? "active" : ""} href={hrefWith({ q: query, status: "done" })}>Завершены</Link>
          </nav>

          <div className="chat-thread-list">
            {threads.map((thread) => {
              const peer = thread.clientId === user.id ? thread.worker : thread.client;
              const last = thread.messages[0];
              const current = thread.id === selectedThreadId;
              const isSystem = last?.type === "SYSTEM";
              return (
                <Link
                  className={`chat-thread-row ${current ? "active" : ""}`}
                  href={hrefWith({ thread: thread.id, q: query, status, page: currentPage })}
                  key={thread.id}
                  aria-current={current ? "page" : undefined}
                >
                  <img className="thread-avatar" src={avatarFor(peer.handle, peer.avatar)} alt="" loading="lazy" />
                  <span className="thread-main">
                    <span className="thread-name-line">
                      <b>{peer.name}</b>
                      <time>{shortDate(thread.updatedAt)}</time>
                    </span>
                    <em>{thread.campaign.title}</em>
                    <small>{isSystem ? "Заказ создан. Можно обсудить детали." : last?.body || "Начните обсуждение заказа"}</small>
                  </span>
                  <span className={`thread-status ${thread.submission?.status && activeStatuses.includes(thread.submission.status) ? "active" : ""}`}>
                    {statusLabel(thread.submission?.status)}
                  </span>
                </Link>
              );
            })}
          </div>

          {totalPages > 1 ? (
            <nav className="chat-pagination" aria-label="Страницы чатов">
              {currentPage > 1
                ? <Link href={hrefWith({ q: query, status, page: currentPage - 1 })}>Назад</Link>
                : <span>Назад</span>}
              <b>{currentPage} / {totalPages}</b>
              {currentPage < totalPages
                ? <Link href={hrefWith({ q: query, status, page: currentPage + 1 })}>Дальше</Link>
                : <span>Дальше</span>}
            </nav>
          ) : null}

          {!threads.length ? (
            <div className="chat-empty-list">
              <MessageCircle size={28} />
              <h2>{query ? "Ничего не найдено" : "Чатов пока нет"}</h2>
              <p>{query ? "Попробуйте другое имя или название заказа." : "Чат появится после отклика на заказ."}</p>
              {query ? <Link href="/chats">Сбросить поиск</Link> : <Link href="/campaigns">Найти заказ</Link>}
            </div>
          ) : null}
        </aside>

        <main className="chat-conversation">
          {selectedThread && selectedPeer ? (
            <>
              <div className="chat-mobile-back">
                <Link href={hrefWith({ q: query, status, page: currentPage })}><ChevronLeft size={20} /> Все чаты</Link>
              </div>
              <CampaignChat
                threadId={selectedThread.id}
                currentUserId={user.id}
                peerName={selectedPeer.name}
                peerHandle={`@${selectedPeer.handle}`}
                peerAvatar={avatarFor(selectedPeer.handle, selectedPeer.avatar)}
                campaignTitle={selectedThread.campaign.title}
                campaignHref={`/campaigns/${selectedThread.campaign.id}`}
                progress={{
                  statusLabel: statusLabel(selectedStatus),
                  views: compactNumber(selectedThread.submission?.currentViews || 0),
                  target: compactNumber(selectedThread.campaign.viewThreshold),
                  fraudScore: selectedThread.submission?.fraudScore || 0,
                  steps: progressSteps
                }}
                messages={selectedThread.messages.map((message) => {
                  const meta = parseJson<{ urls?: string[] }>(message.metadataJson, {});
                  return {
                    id: message.id,
                    senderId: message.senderId,
                    senderName: message.sender.name,
                    body: message.body,
                    type: message.type,
                    createdAt: messageDate(message.createdAt),
                    previews: (meta.urls || [])
                      .map(buildSafePreview)
                      .filter(Boolean) as Array<{ url: string; host: string; platform: string; title: string }>
                  };
                })}
              />
            </>
          ) : (
            <div className="chat-empty-conversation">
              {totalThreads ? <CircleDashed size={34} /> : <BriefcaseBusiness size={34} />}
              <h2>{totalThreads ? "Выберите диалог" : "Здесь будут рабочие чаты"}</h2>
              <p>{totalThreads ? "Откройте нужный чат слева." : "Возьмите заказ или дождитесь исполнителя, чтобы начать переписку."}</p>
              <Link className="btn btn-primary" href="/campaigns"><ArrowLeft size={17} /> К заказам</Link>
            </div>
          )}
        </main>
      </section>
    </AppShell>
  );
}
