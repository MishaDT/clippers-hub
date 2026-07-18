import Link from "next/link";
import {
  ArrowLeft,
  BriefcaseBusiness,
  ChevronLeft,
  CircleDashed,
  MessageCircle,
  Headphones,
  Archive,
} from "lucide-react";
import { Prisma, type SubmissionStatus } from "@prisma/client";
import { CampaignChat } from "@/components/campaign-chat";
import { ChatSearchForm } from "@/components/chat-search-form";
import { ChatMobileFilter } from "@/components/chat-mobile-filter";
import { SwipeChatRow } from "@/components/swipe-chat-row";
import { ChatListRefresh } from "@/components/chat-list-refresh";
import { AppShell } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { buildSafePreview } from "@/lib/chat-safety";
import { parseJson } from "@/lib/json";
import { compactNumber } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { getActiveRoleMode } from "@/lib/role-mode";
import { getUnreadSummary } from "@/lib/unread";

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

function hrefWith(params: { thread?: string; q?: string; status?: string; page?: number; role?: string; view?: string; type?: string }) {
  const search = new URLSearchParams();
  if (params.thread) search.set("thread", params.thread);
  if (params.q) search.set("q", params.q);
  if (params.status && params.status !== "all") search.set("status", params.status);
  if (params.role && params.role !== "all") search.set("role", params.role);
  if (params.view && params.view !== "all") search.set("view", params.view);
  if (params.type && params.type !== "all") search.set("type", params.type);
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
  const mode = await getActiveRoleMode(user);
  const params = await searchParams;
  const canSeeBoth = user.role === "BOTH" || user.role === "ADMIN";
  const roleFilter = canSeeBoth && ["client", "worker"].includes(String(params.role))
    ? String(params.role)
    : canSeeBoth ? "all" : mode;
  const query = typeof params.q === "string" ? params.q.trim().slice(0, 80) : "";
  const status = params.status === "active" || params.status === "done" ? params.status : "all";
  const typeFilter = params.type === "orders" || params.type === "collabs" ? params.type : "all";
  const view = params.view === "archived" ? "archived" : "all";
  const archivedView = view === "archived";
  const requestedThreadId = typeof params.thread === "string" ? params.thread : "";
  const requestedPage = Math.max(1, Number.parseInt(typeof params.page === "string" ? params.page : "1", 10) || 1);

  // Each participant has their own archive/clear state on the thread.
  const clientSide: Prisma.ChatThreadWhereInput = archivedView
    ? { clientId: user.id, clientClearedAt: null, clientArchivedAt: { not: null } }
    : { clientId: user.id, clientClearedAt: null, clientArchivedAt: null };
  const workerSide: Prisma.ChatThreadWhereInput = archivedView
    ? { workerId: user.id, workerClearedAt: null, workerArchivedAt: { not: null } }
    : { workerId: user.id, workerClearedAt: null, workerArchivedAt: null };
  const participant: Prisma.ChatThreadWhereInput =
    roleFilter === "all" ? { OR: [clientSide, workerSide] }
      : roleFilter === "client" ? clientSide : workerSide;

  const where: Prisma.ChatThreadWhereInput = {
    AND: [
      participant,
      ...(typeFilter === "orders" ? [{ kind: "CAMPAIGN" }] : []),
      ...(typeFilter === "collabs" ? [{ kind: "COLLAB" }] : []),
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
  const currentPage = requestedPage;
  const threadsQuery = prisma.chatThread.findMany({
    where,
    include: {
      campaign: { select: { id: true, title: true, viewThreshold: true, draftRequired: true, reviewMode: true } },
      client: { select: { id: true, name: true, handle: true, avatar: true } },
      worker: { select: { id: true, name: true, handle: true, avatar: true } },
      submission: { select: { status: true, currentViews: true, fraudScore: true, draftStatus: true } },
      messages: { orderBy: { createdAt: "desc" }, take: 1 }
    },
    orderBy: { updatedAt: "desc" },
    skip: (currentPage - 1) * threadsPerPage,
    take: threadsPerPage
  });

  const selectedThreadQuery = requestedThreadId
    ? prisma.chatThread.findFirst({
        where: {
          id: requestedThreadId,
          OR: [{ clientId: user.id }, { workerId: user.id }]
        },
        include: {
          campaign: { select: { id: true, title: true, viewThreshold: true, draftRequired: true, reviewMode: true } },
          client: { select: { id: true, name: true, handle: true, avatar: true } },
          worker: { select: { id: true, name: true, handle: true, avatar: true } },
          submission: { select: { status: true, currentViews: true, fraudScore: true, draftStatus: true } },
          collabInvite: { select: { id: true, status: true } },
          messages: {
            include: { sender: { select: { id: true, name: true } } },
            orderBy: { createdAt: "asc" },
            take: 60
          }
        }
      })
    : Promise.resolve(null);

  const typeWhere: Prisma.ChatThreadWhereInput = typeFilter === "orders" ? { kind: "CAMPAIGN" } : typeFilter === "collabs" ? { kind: "COLLAB" } : {};
  const [totalThreads, threads, selectedThread, clientCount, workerCount, unreadSummary] = await Promise.all([
    prisma.chatThread.count({ where }),
    threadsQuery,
    selectedThreadQuery,
    prisma.chatThread.count({ where: { AND: [clientSide, typeWhere] } }),
    prisma.chatThread.count({ where: { AND: [workerSide, typeWhere] } }),
    getUnreadSummary(user.id)
  ]);
  const unreadRows = threads.length ? await prisma.$queryRaw<Array<{ threadId: string; count: bigint }>>(Prisma.sql`
    SELECT message."threadId" AS "threadId", COUNT(*)::bigint AS count
    FROM "ChatMessage" message
    LEFT JOIN "ChatReadState" state
      ON state."threadId" = message."threadId" AND state."userId" = ${user.id}
    WHERE message."threadId" IN (${Prisma.join(threads.map((thread) => thread.id))})
      AND message."senderId" <> ${user.id}
      AND message."createdAt" > COALESCE(state."lastReadAt", TIMESTAMP '1970-01-01')
    GROUP BY message."threadId"
  `) : [];
  const unreadByThread = new Map(unreadRows.map((row) => [row.threadId, Number(row.count)]));
  const totalPages = Math.max(1, Math.ceil(totalThreads / threadsPerPage));
  const selectedThreadId = requestedThreadId;

  const selectedAsClient = selectedThread?.clientId === user.id;
  const selectedPeer = selectedThread
    ? selectedAsClient ? selectedThread.worker : selectedThread.client
    : null;
  // History the viewer cleared ("delete for me") stays hidden until new activity.
  const selectedClearedAt = selectedThread
    ? selectedAsClient ? selectedThread.clientClearedAt : selectedThread.workerClearedAt
    : null;
  const selectedStatus = selectedThread?.submission?.status;
  const selectedDraftStatus = selectedThread?.submission?.draftStatus;
  const selectedDraftDone = !selectedThread?.campaign?.draftRequired || selectedDraftStatus === "APPROVED";
  const selectedIsCollab = selectedThread?.kind === "COLLAB";
  const collabInExecution = Boolean(selectedThread?.messages.some(
    (message) => message.type === "SYSTEM" && message.body === "Условия согласованы. Коллаб перешёл к выполнению."
  ));
  const collabCompleted = selectedThread?.collabInvite?.status === "COMPLETED";
  const progressSteps = [
    { title: "Заказ взят", done: Boolean(selectedThread?.submission), active: selectedStatus === "ACCEPTED" },
    ...(selectedThread?.campaign?.draftRequired ? [{
      title: "Черновик",
      done: selectedDraftDone,
      active: selectedStatus === "ACCEPTED" && !selectedDraftDone
    }] : []),
    { title: "Публикация", done: ["POSTED", "VERIFIED", "THRESHOLD_MET", "SETTLING", "PAID"].includes(selectedStatus || ""), active: selectedStatus === "POSTED" || (selectedStatus === "ACCEPTED" && selectedDraftDone) },
    { title: "Просмотры", done: ["THRESHOLD_MET", "SETTLING", "PAID"].includes(selectedStatus || ""), active: ["VERIFIED", "POSTED"].includes(selectedStatus || "") },
    { title: "Выплата", done: selectedStatus === "PAID", active: ["THRESHOLD_MET", "SETTLING"].includes(selectedStatus || "") }
  ];

  return (
    <AppShell immersive hideBottomNav={Boolean(requestedThreadId)}>
      <section className={`chats-app ${requestedThreadId ? "has-selection" : ""}`}>
        <ChatListRefresh />
        <aside className="chat-sidebar">
          <div className="chat-sidebar-head">
            <div>
              <span><MessageCircle size={15} /> Сообщения</span>
              <strong>{unreadSummary.chats ? `${unreadSummary.chats} непрочитано` : "Все прочитано"}</strong>
            </div>
            <div className="chat-sidebar-tools">
              <Link href="/support" aria-label="Открыть поддержку" title="Поддержка"><Headphones size={18} /></Link>
              <Link
                href={hrefWith({ q: query, status, role: roleFilter, type: typeFilter, view: archivedView ? "all" : "archived" })}
                aria-label={archivedView ? "Вернуться к активным чатам" : "Открыть архив чатов"}
                title={archivedView ? "Активные чаты" : "Архив чатов"}
              >
                <Archive size={18} />
              </Link>
            </div>
          </div>

          <ChatSearchForm initialValue={query} status={status} role={roleFilter} view={view} type={typeFilter} />

          <div className="chat-filter-row">
          <nav className="chat-type-tabs" aria-label="Тип чата">
            <Link className={typeFilter === "all" ? "active" : ""} href={hrefWith({ q: query, status, role: roleFilter, view })}>Все</Link>
            <Link className={typeFilter === "orders" ? "active" : ""} href={hrefWith({ q: query, status, role: roleFilter, view, type: "orders" })}>Заказы</Link>
            <Link className={typeFilter === "collabs" ? "active" : ""} href={hrefWith({ q: query, status, role: roleFilter, view, type: "collabs" })}>Коллабы</Link>
          </nav>
            <ChatMobileFilter
              typeItems={[]}
              roleItems={canSeeBoth ? [
                { label: "Все роли", href: hrefWith({ q: query, status, view, type: typeFilter }), active: roleFilter === "all", count: clientCount + workerCount },
                { label: "Я заказчик", href: hrefWith({ q: query, status, role: "client", view, type: typeFilter }), active: roleFilter === "client", count: clientCount },
                { label: "Я исполнитель", href: hrefWith({ q: query, status, role: "worker", view, type: typeFilter }), active: roleFilter === "worker", count: workerCount }
              ] : []}
              statusItems={[
                { label: "Любой статус", href: hrefWith({ q: query, role: roleFilter, view, type: typeFilter }), active: status === "all" },
                { label: "В работе", href: hrefWith({ q: query, status: "active", role: roleFilter, view, type: typeFilter }), active: status === "active" },
                { label: "Завершены", href: hrefWith({ q: query, status: "done", role: roleFilter, view, type: typeFilter }), active: status === "done" }
              ]}
            />
          </div>

          <div className="chat-thread-list">
            {threads.map((thread) => {
              const asClient = thread.clientId === user.id;
              const peer = asClient ? thread.worker : thread.client;
              const last = thread.messages[0];
              const current = thread.id === selectedThreadId;
              const isSystem = last?.type === "SYSTEM";
              const isDeleted = Boolean(last?.deletedAt);
              const archived = asClient ? Boolean(thread.clientArchivedAt) : Boolean(thread.workerArchivedAt);
              const preview = isDeleted
                ? "Сообщение удалено"
                : isSystem
                  ? thread.kind === "COLLAB" ? "Коллаб принят. Можно обсудить идею." : "Заказ создан. Можно обсудить детали."
                  : last?.body || (thread.kind === "COLLAB" ? "Начните обсуждение коллаба" : "Начните обсуждение заказа");
              return <SwipeChatRow
                threadId={thread.id}
                href={hrefWith({ thread: thread.id, q: query, status, page: currentPage, role: roleFilter, view, type: typeFilter })}
                avatar={avatarFor(peer.handle, peer.avatar)}
                name={peer.name}
                time={shortDate(thread.updatedAt)}
                context={thread.campaign?.title || `Совместный проект с ${peer.name}`}
                preview={preview}
                unread={unreadByThread.get(thread.id) || 0}
                kind={thread.kind === "COLLAB" ? "COLLAB" : "CAMPAIGN"}
                current={current}
                archived={archived}
                key={thread.id}
              />;
            })}
          </div>

          {totalPages > 1 ? (
            <nav className="chat-pagination" aria-label="Страницы чатов">
              {currentPage > 1
                ? <Link prefetch href={hrefWith({ q: query, status, page: currentPage - 1, role: roleFilter, view, type: typeFilter })}>Назад</Link>
                : <span>Назад</span>}
              <b>{currentPage} / {totalPages}</b>
              {currentPage < totalPages
                ? <Link prefetch href={hrefWith({ q: query, status, page: currentPage + 1, role: roleFilter, view, type: typeFilter })}>Дальше</Link>
                : <span>Дальше</span>}
            </nav>
          ) : null}

          {!threads.length ? (
            <div className="chat-empty-list">
              <MessageCircle size={28} />
              <h2>{archivedView ? "В архиве пусто" : query ? "Ничего не найдено" : "Чатов пока нет"}</h2>
              <p>{archivedView ? "Архивированные чаты будут появляться здесь." : query ? "Попробуйте другое имя или название заказа." : mode === "client" ? "Чат появится, когда исполнитель возьмёт вашу кампанию." : "Чат появится после отклика на заказ."}</p>
              {archivedView ? <Link href="/chats">К активным чатам</Link> : query ? <Link href="/chats">Сбросить поиск</Link> : <Link href="/campaigns">{mode === "client" ? "Открыть кампании" : "Найти заказ"}</Link>}
            </div>
          ) : null}
        </aside>

        <main className="chat-conversation">
          {selectedThread && selectedPeer ? (
            <>
              <div className="chat-mobile-back">
                <Link href={hrefWith({ q: query, status, page: currentPage, role: roleFilter, view, type: typeFilter })}><ChevronLeft size={20} /> Все чаты</Link>
              </div>
              <CampaignChat
                threadId={selectedThread.id}
                currentUserId={user.id}
                peerName={selectedPeer.name}
                peerRole={selectedAsClient ? "Исполнитель" : "Заказчик"}
                peerHandle={`@${selectedPeer.handle}`}
                peerAvatar={avatarFor(selectedPeer.handle, selectedPeer.avatar)}
                campaignTitle={selectedThread.campaign?.title || (selectedIsCollab ? "Совместный проект" : undefined)}
                campaignHref={selectedThread.campaign ? `/campaigns/${selectedThread.campaign.id}?returnTo=${encodeURIComponent(hrefWith({ thread: selectedThread.id, q: query, status, page: currentPage, role: roleFilter, view, type: typeFilter }))}` : undefined}
                progress={selectedThread.campaign ? {
                  kind: "campaign",
                  statusLabel: statusLabel(selectedStatus),
                  views: compactNumber(selectedThread.submission?.currentViews || 0),
                  target: compactNumber(selectedThread.campaign.viewThreshold),
                  fraudScore: selectedThread.submission?.fraudScore || 0,
                  steps: progressSteps
                } : selectedIsCollab ? {
                  kind: "collab",
                  statusLabel: collabCompleted ? "Коллаб завершён" : collabInExecution ? "Коллаб в работе" : "Коллаб принят",
                  views: "—",
                  target: "—",
                  fraudScore: 0,
                  canAdvance: selectedThread.collabInvite?.status === "ACCEPTED" && !collabInExecution,
                  steps: [
                    { title: "Принято", done: true, active: false },
                    { title: "Обсуждение", done: collabInExecution || collabCompleted, active: !collabInExecution && !collabCompleted },
                    { title: "Выполнение", done: collabCompleted, active: collabInExecution && !collabCompleted },
                    { title: "Готово", done: collabCompleted, active: false }
                  ]
                } : undefined}
                messages={selectedThread.messages
                  .filter((message) => !selectedClearedAt || message.createdAt > selectedClearedAt)
                  .map((message) => {
                  const meta = parseJson<{ urls?: string[] }>(message.metadataJson, {});
                  return {
                    id: message.id,
                    senderId: message.senderId,
                    senderName: message.sender.name,
                    body: message.body,
                    type: message.type,
                    createdAt: messageDate(message.createdAt),
                    deleted: Boolean(message.deletedAt),
                    edited: Boolean(message.editedAt),
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
              <p>{totalThreads ? "Откройте нужный чат слева." : mode === "client" ? "После первого отклика здесь появится диалог с исполнителем." : "Возьмите заказ, чтобы начать переписку с заказчиком."}</p>
              <Link className="btn btn-primary" href="/campaigns"><ArrowLeft size={17} /> К заказам</Link>
            </div>
          )}
        </main>
      </section>
    </AppShell>
  );
}
