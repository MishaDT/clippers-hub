import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { Search, ShieldAlert } from "lucide-react";
import { adminResolveModerationAction, adminVerifyResultAction } from "@/app/admin/actions";
import { reviewDraftAction } from "@/app/actions";
import { AdminPageHeader, AdminShell } from "@/components/admin-shell";
import { Card } from "@/components/ui";
import { prisma } from "@/lib/prisma";
import { clampPage, pageHref } from "@/lib/admin-format";

export const dynamic = "force-dynamic";
const pageSize = 40;

export default async function ModerationPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const page = clampPage(params.page);
  const status = ["OPEN", "APPROVED", "DISMISSED", "ACTIONED"].includes(String(params.status)) ? String(params.status) : "OPEN";
  const severity = ["LOW", "MEDIUM", "HIGH", "CRITICAL"].includes(String(params.severity)) ? String(params.severity) : "";
  const q = String(params.q || "").trim().slice(0, 80);
  const where: Prisma.ModerationCaseWhereInput = {
    status,
    ...(severity ? { severity } : {}),
    ...(q ? { OR: [
      { excerpt: { contains: q, mode: "insensitive" } },
      { category: { contains: q, mode: "insensitive" } },
      { author: { email: { contains: q, mode: "insensitive" } } }
    ] } : {})
  };
  const [total, cases] = await Promise.all([
    prisma.moderationCase.count({ where }),
    prisma.moderationCase.findMany({
      where,
      include: {
        author: { select: { id: true, email: true, accountStatus: true } },
        reporter: { select: { email: true } }
      },
      orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize
    })
  ]);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const base = { status, severity, q };

  // TikTok / Instagram have no public metrics API, so their view counts are confirmed here by
  // a moderator from the public post (see adminVerifyResultAction / lib/view-providers.ts).
  const manualQueue = await prisma.submission.findMany({
    where: {
      platform: { in: ["TIKTOK", "INSTAGRAM"] },
      status: { in: ["POSTED", "VERIFIED", "THRESHOLD_MET"] },
      campaign: { status: { in: ["ACTIVE", "LOW_BUDGET", "PAUSED", "COMPLETED"] } }
    },
    select: {
      id: true, platform: true, postUrl: true, currentViews: true,
      worker: { select: { handle: true } },
      campaign: { select: { title: true, viewThreshold: true } }
    },
    orderBy: { updatedAt: "desc" },
    take: 30
  });
  const draftQueue = await prisma.submission.findMany({
    where: {
      draftStatus: "PENDING",
      campaign: { reviewMode: { in: ["FAST", "STANDARD"] } }
    },
    select: {
      id: true,
      draftUrl: true,
      draftRevision: true,
      draftSubmittedAt: true,
      worker: { select: { name: true, handle: true, trustScore: true } },
      campaign: { select: { id: true, title: true, reviewMode: true, maxRevisionRounds: true } }
    },
    orderBy: { draftSubmittedAt: "asc" },
    take: 30
  });

  return <AdminShell><div className="admin-screen admin-dense-screen">
    <AdminPageHeader eyebrow="Безопасность" title="Модерация" description="Жалобы и автоматические срабатывания. Высокий риск отображается первым." />
    {draftQueue.length ? <Card className="admin-panel">
      <div className="section-head compact"><div><span className="eyebrow">До публикации</span><h2>Черновики роликов</h2></div><span>{draftQueue.length}</span></div>
      <p className="muted">Проверяйте соответствие зафиксированному брифу. Новые требования нельзя добавлять через правки.</p>
      <div className="manual-verify-list">
        {draftQueue.map((item) => <form className="manual-verify-row" action={reviewDraftAction} key={item.id}>
          <input type="hidden" name="submissionId" value={item.id} />
          <input type="hidden" name="returnTo" value="/admin/moderation" />
          <div className="manual-verify-info">
            <b>{item.campaign.title}</b>
            <span>{item.campaign.reviewMode} · версия {item.draftRevision + 1} · @{item.worker.handle} · доверие {item.worker.trustScore}</span>
            {item.draftUrl ? <a href={item.draftUrl} target="_blank" rel="noreferrer">Открыть черновик</a> : null}
          </div>
          <input name="note" maxLength={700} placeholder="Причина правок или отклонения" />
          <div className="admin-inline-actions">
            <button className="btn btn-primary" name="decision" value="approve">Принять</button>
            <button className="btn" name="decision" value="changes" disabled={item.draftRevision >= item.campaign.maxRevisionRounds}>На правки</button>
            <button className="btn danger" name="decision" value="reject">Отклонить</button>
          </div>
        </form>)}
      </div>
    </Card> : null}
    {manualQueue.length ? <Card className="admin-panel">
      <div className="section-head compact"><div><span className="eyebrow">Ручная проверка</span><h2>Просмотры TikTok / Instagram</h2></div><span>{manualQueue.length}</span></div>
      <p className="muted">У этих площадок нет метрик-API — подтвердите просмотры из публичного поста. При достижении цели выплата уйдёт через резерв кампании.</p>
      <div className="manual-verify-list">
        {manualQueue.map((item) => <form className="manual-verify-row" action={adminVerifyResultAction} key={item.id}>
          <input type="hidden" name="submissionId" value={item.id} />
          <div className="manual-verify-info">
            <b>{item.campaign.title}</b>
            <span>{item.platform} · @{item.worker.handle} · сейчас {item.currentViews.toLocaleString("ru-RU")} / цель {item.campaign.viewThreshold.toLocaleString("ru-RU")}</span>
            <a href={item.postUrl} target="_blank" rel="noreferrer">Открыть публикацию</a>
          </div>
          <input name="views" type="number" min={0} placeholder="Просмотры" required />
          <button className="btn btn-primary">Подтвердить</button>
        </form>)}
      </div>
    </Card> : null}
    <Card className="admin-panel admin-filter-panel">
      <form className="admin-filter-bar" action="/admin/moderation">
        <label><Search size={17} /><input name="q" defaultValue={q} placeholder="Текст, категория или email" /></label>
        <select name="status" defaultValue={status}><option value="OPEN">Открытые</option><option value="ACTIONED">С мерами</option><option value="APPROVED">Разрешённые</option><option value="DISMISSED">Отклонённые</option></select>
        <select name="severity" defaultValue={severity}><option value="">Любой риск</option><option value="CRITICAL">Критический</option><option value="HIGH">Высокий</option><option value="MEDIUM">Средний</option><option value="LOW">Низкий</option></select>
        <button className="btn btn-primary">Найти</button>
      </form>
    </Card>
    <Card className="admin-panel">
      <div className="moderation-list">
        {cases.map((item) => <details className={`moderation-row risk-${item.severity.toLowerCase()}`} key={item.id}>
          <summary><ShieldAlert size={16} /><b>{item.category}</b><span>{item.contentType}</span><em>{item.author?.email || "Без автора"}</em><time>{item.createdAt.toLocaleDateString("ru-RU")}</time></summary>
          <div className="moderation-details">
            <p>{item.excerpt || "Текст не сохранён"}</p>
            <dl><dt>Источник</dt><dd>{item.source}</dd><dt>Риск</dt><dd>{item.severity}</dd><dt>Статус аккаунта</dt><dd>{item.author?.accountStatus || "—"}</dd></dl>
            {item.author ? <Link href={`/admin/users/${item.author.id}`}>История пользователя</Link> : null}
            {item.status === "OPEN" ? <form action={adminResolveModerationAction}>
              <input type="hidden" name="caseId" value={item.id} />
              <input name="note" maxLength={300} placeholder="Комментарий решения" />
              <div>
                <button name="decision" value="approve">Разрешить</button>
                <button name="decision" value="remove">Удалить</button>
                <button name="decision" value="restrict7">Ограничить 7 дней</button>
                <button name="decision" value="restrict30">30 дней</button>
                <button name="decision" value="freeze">Заморозить</button>
                <button className="danger" name="decision" value="ban">Заблокировать</button>
              </div>
            </form> : <p>Решение: {item.resolution}</p>}
          </div>
        </details>)}
        {!cases.length ? <p className="muted">Дел по выбранному фильтру нет.</p> : null}
      </div>
    </Card>
    <div className="admin-pagination">
      <Link className={page <= 1 ? "disabled" : ""} href={pageHref("/admin/moderation", base, Math.max(1, page - 1))}>Назад</Link>
      <span>{page} / {totalPages}</span>
      <Link className={page >= totalPages ? "disabled" : ""} href={pageHref("/admin/moderation", base, Math.min(totalPages, page + 1))}>Дальше</Link>
    </div>
  </div></AdminShell>;
}
