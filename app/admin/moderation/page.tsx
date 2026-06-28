import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { Search, ShieldAlert } from "lucide-react";
import { adminResolveModerationAction } from "@/app/admin/actions";
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

  return <AdminShell><div className="admin-screen admin-dense-screen">
    <AdminPageHeader eyebrow="Безопасность" title="Модерация" description="Жалобы и автоматические срабатывания. Высокий риск отображается первым." />
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
