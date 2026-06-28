import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { MessageSquareText, Pencil, Search, Trash2 } from "lucide-react";
import { AdminPageHeader, AdminShell } from "@/components/admin-shell";
import { Card, Tag } from "@/components/ui";
import { prisma } from "@/lib/prisma";
import { clampPage, fullDate, pageHref } from "@/lib/admin-format";

export const dynamic = "force-dynamic";

const pageSize = 60;
const auditActions = ["ALL", "EDIT", "DELETE"];

export default async function AdminMessagesPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const q = String(params.q || "").trim();
  const action = auditActions.includes(String(params.action)) ? String(params.action) : "ALL";
  const page = clampPage(params.page);

  const where: Prisma.ChatMessageEditWhereInput = {};
  if (action !== "ALL") where.action = action;
  if (q) {
    where.OR = [
      { previousBody: { contains: q, mode: "insensitive" } },
      { newBody: { contains: q, mode: "insensitive" } },
      { editor: { email: { contains: q, mode: "insensitive" } } },
      { editor: { name: { contains: q, mode: "insensitive" } } },
      { editor: { handle: { contains: q, mode: "insensitive" } } }
    ];
  }

  const [total, edits, totalEdits, totalDeletes] = await Promise.all([
    prisma.chatMessageEdit.count({ where }),
    prisma.chatMessageEdit.findMany({
      where,
      include: { editor: { select: { name: true, email: true, handle: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize
    }),
    prisma.chatMessageEdit.count({ where: { action: "EDIT" } }),
    prisma.chatMessageEdit.count({ where: { action: "DELETE" } })
  ]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const baseParams = { q, action: action === "ALL" ? "" : action };

  return (
    <AdminShell>
      <div className="admin-screen admin-dense-screen">
        <AdminPageHeader
          eyebrow="Аудит"
          title="Изменения сообщений"
          description="Полная история правок и удалений в чатах: кто, когда, что было и что стало. Записи неизменяемы."
        />

        <div className="admin-grid compact admin-kpi-strip">
          <Card className="admin-metric"><MessageSquareText /><span>Всего записей</span><strong>{total}</strong><small>по фильтру</small></Card>
          <Card className="admin-metric"><Pencil /><span>Правок</span><strong>{totalEdits}</strong><small>EDIT</small></Card>
          <Card className="admin-metric"><Trash2 /><span>Удалений</span><strong>{totalDeletes}</strong><small>DELETE</small></Card>
        </div>

        <Card className="admin-panel admin-filter-panel">
          <form className="admin-filter-bar" action="/admin/messages">
            <label>
              <Search size={18} />
              <input name="q" defaultValue={q} placeholder="Текст, email, имя, ник" />
            </label>
            <select name="action" defaultValue={action}>
              <option value="ALL">Все действия</option>
              <option value="EDIT">Только правки</option>
              <option value="DELETE">Только удаления</option>
            </select>
            <button className="btn btn-primary" type="submit">Фильтр</button>
          </form>
        </Card>

        <Card className="admin-panel">
          {edits.length === 0 ? (
            <p className="muted">Изменений пока нет — как только пользователи начнут править или удалять сообщения, записи появятся здесь.</p>
          ) : (
            <div className="admin-audit-list">
              {edits.map((edit) => (
                <div className={`admin-audit-row ${edit.action === "DELETE" ? "is-delete" : ""}`} key={edit.id}>
                  <div className="admin-audit-meta">
                    <Tag tone={edit.action === "DELETE" ? "warn" : "soft"}>{edit.action === "DELETE" ? "Удаление" : "Правка"}</Tag>
                    <strong>{edit.editor.name}</strong>
                    <span>{edit.editor.email}</span>
                    <time>{fullDate(edit.createdAt)}</time>
                  </div>
                  <div className="admin-audit-diff">
                    <p className="admin-audit-before"><b>{edit.action === "DELETE" ? "Удалено" : "Было"}:</b> {edit.previousBody}</p>
                    {edit.action === "EDIT" ? <p className="admin-audit-after"><b>Стало:</b> {edit.newBody}</p> : null}
                  </div>
                  <span className="admin-audit-thread">чат · {edit.threadId.slice(-6)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <div className="admin-pagination">
          <Link className={page <= 1 ? "disabled" : ""} href={pageHref("/admin/messages", baseParams, Math.max(1, page - 1))}>Назад</Link>
          <span>{page} / {totalPages}</span>
          <Link className={page >= totalPages ? "disabled" : ""} href={pageHref("/admin/messages", baseParams, Math.min(totalPages, page + 1))}>Дальше</Link>
        </div>
      </div>
    </AdminShell>
  );
}
