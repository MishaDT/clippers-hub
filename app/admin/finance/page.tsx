import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { CreditCard, Search, WalletCards } from "lucide-react";
import { AdminPageHeader, AdminShell } from "@/components/admin-shell";
import { Card, Tag } from "@/components/ui";
import { prisma } from "@/lib/prisma";
import { rub } from "@/lib/money";
import { clampPage, fullDate, pageHref, statusLabel } from "@/lib/admin-format";
import { adminUpdateTransactionAction } from "@/app/admin/actions";

export const dynamic = "force-dynamic";

const pageSize = 60;
const types = ["ALL", "DEPOSIT", "EARNING", "WITHDRAWAL", "ADJUSTMENT"] as const;
const statuses = ["ALL", "PENDING", "COMPLETED", "FAILED", "REVERSED"] as const;

export default async function AdminFinancePage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const q = String(params.q || "").trim();
  const type = types.includes(String(params.type) as (typeof types)[number]) ? String(params.type) : "ALL";
  const status = statuses.includes(String(params.status) as (typeof statuses)[number]) ? String(params.status) : "ALL";
  const page = clampPage(params.page);

  const where: Prisma.TransactionWhereInput = {};
  if (type !== "ALL") where.type = type as Prisma.EnumTransactionTypeFilter["equals"];
  if (status !== "ALL") where.status = status as Prisma.EnumTransactionStatusFilter["equals"];
  if (q) {
    where.OR = [
      { user: { email: { contains: q, mode: "insensitive" } } },
      { user: { name: { contains: q, mode: "insensitive" } } },
      { provider: { contains: q, mode: "insensitive" } }
    ];
  }

  const [total, transactions, pendingWithdrawals, money] = await Promise.all([
    prisma.transaction.count({ where }),
    prisma.transaction.findMany({
      where,
      include: { user: { select: { id: true, email: true, name: true, handle: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize
    }),
    prisma.transaction.count({ where: { type: "WITHDRAWAL", status: "PENDING" } }),
    prisma.transaction.aggregate({ where: { status: "COMPLETED" }, _sum: { netCents: true, feeCents: true } })
  ]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const baseParams = { q, type: type === "ALL" ? "" : type, status: status === "ALL" ? "" : status };

  return (
    <AdminShell>
      <div className="admin-screen admin-dense-screen">
        <AdminPageHeader
          eyebrow="Финансы"
          title="Транзакции"
          description="Плотная таблица платежей, выплат, депозитов и ручных корректировок."
        />

        <div className="admin-grid compact admin-kpi-strip">
          <Card className="admin-metric"><WalletCards /><span>Найдено</span><strong>{total}</strong><small>операций</small></Card>
          <Card className="admin-metric"><CreditCard /><span>Ожидают</span><strong>{pendingWithdrawals}</strong><small>выводы</small></Card>
          <Card className="admin-metric"><WalletCards /><span>Net</span><strong>{rub(money._sum.netCents || 0)}</strong><small>fee {rub(money._sum.feeCents || 0)}</small></Card>
        </div>

        <Card className="admin-panel admin-filter-panel">
          <form className="admin-filter-bar" action="/admin/finance">
            <label><Search size={18} /><input name="q" defaultValue={q} placeholder="Email, имя, провайдер" /></label>
            <select name="type" defaultValue={type}>{types.map((item) => <option value={item} key={item}>{item === "ALL" ? "Все типы" : item}</option>)}</select>
            <select name="status" defaultValue={status}>{statuses.map((item) => <option value={item} key={item}>{item === "ALL" ? "Все статусы" : statusLabel(item)}</option>)}</select>
            <button className="btn btn-primary" type="submit">Найти</button>
          </form>
        </Card>

        <Card className="admin-panel">
          <div className="admin-table finance-table">
            <div className="admin-table-head"><span>Операция</span><span>Пользователь</span><span>Сумма</span><span>Статус</span><span>Действие</span></div>
            {transactions.map((tx) => (
              <div className="admin-table-row" key={tx.id}>
                <div><strong>{tx.type}</strong><span>{fullDate(tx.createdAt)} · {tx.provider || "internal"}</span></div>
                <div><strong><Link href={`/admin/users/${tx.user.id}`}>{tx.user.name}</Link></strong><span>{tx.user.email}</span></div>
                <div><strong>{rub(tx.netCents)}</strong><span>gross {rub(tx.amountCents)} · fee {rub(tx.feeCents)}</span></div>
                <div><Tag tone={tx.status === "COMPLETED" ? "good" : tx.status === "PENDING" ? "warn" : "soft"}>{statusLabel(tx.status)}</Tag></div>
                <div>
                  <form className="admin-row-form" action={adminUpdateTransactionAction}>
                    <input type="hidden" name="transactionId" value={tx.id} />
                    <select name="status" defaultValue={tx.status}><option value="PENDING">Ожидает</option><option value="COMPLETED">Успешно</option><option value="FAILED">Ошибка</option><option value="REVERSED">Возврат</option></select>
                    <button type="submit">OK</button>
                  </form>
                </div>
              </div>
            ))}
          </div>

          <div className="admin-dense-list">
            {transactions.map((tx) => (
              <details className="admin-dense-row" key={tx.id}>
                <summary><span>{tx.type}</span><b>{rub(tx.netCents)}</b><em>{statusLabel(tx.status)}</em></summary>
                <div className="admin-dense-details">
                  <p><b>Пользователь:</b> <Link href={`/admin/users/${tx.user.id}`}>{tx.user.email}</Link></p>
                  <p><b>Дата:</b> {fullDate(tx.createdAt)}</p>
                  <p><b>Провайдер:</b> {tx.provider || "internal"}</p>
                  <form className="admin-row-form" action={adminUpdateTransactionAction}>
                    <input type="hidden" name="transactionId" value={tx.id} />
                    <select name="status" defaultValue={tx.status}><option value="PENDING">Ожидает</option><option value="COMPLETED">Успешно</option><option value="FAILED">Ошибка</option><option value="REVERSED">Возврат</option></select>
                    <button type="submit">Сохранить</button>
                  </form>
                </div>
              </details>
            ))}
          </div>
        </Card>

        <div className="admin-pagination">
          <Link className={page <= 1 ? "disabled" : ""} href={pageHref("/admin/finance", baseParams, Math.max(1, page - 1))}>Назад</Link>
          <span>{page} / {totalPages}</span>
          <Link className={page >= totalPages ? "disabled" : ""} href={pageHref("/admin/finance", baseParams, Math.min(totalPages, page + 1))}>Дальше</Link>
        </div>
      </div>
    </AdminShell>
  );
}
