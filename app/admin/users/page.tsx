import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { Search, UserRound } from "lucide-react";
import { AdminPageHeader, AdminShell } from "@/components/admin-shell";
import { Card, Tag } from "@/components/ui";
import { adminCreateUserAction } from "@/app/admin/actions";
import { clampPage, fullDate, pageHref, providerLabel, roleLabel } from "@/lib/admin-format";
import { rub } from "@/lib/money";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const pageSize = 60;
const roles = ["ALL", "ADMIN", "CLIENT", "WORKER", "BOTH"] as const;
const providers = ["all", "google", "email"] as const;

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const q = String(params.q || "").trim();
  const role = roles.includes(String(params.role) as (typeof roles)[number]) ? String(params.role) : "ALL";
  const provider = providers.includes(String(params.provider) as (typeof providers)[number]) ? String(params.provider) : "all";
  const page = clampPage(params.page);

  const where: Prisma.UserWhereInput = {};
  if (q) {
    where.OR = [
      { email: { contains: q, mode: "insensitive" } },
      { name: { contains: q, mode: "insensitive" } },
      { handle: { contains: q, mode: "insensitive" } }
    ];
  }
  if (role !== "ALL") where.role = role as Prisma.EnumRoleFilter["equals"];
  if (provider === "google") where.oauthAccounts = { some: { provider: "google" } };
  if (provider === "email") where.oauthAccounts = { none: {} };

  const [total, users, googleUsers] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        name: true,
        handle: true,
        role: true,
        balanceCents: true,
        holdBalanceCents: true,
        trustScore: true,
        createdAt: true,
        oauthAccounts: { select: { provider: true } },
        _count: { select: { ownedCampaigns: true, submissions: true, transactions: true } }
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize
    }),
    prisma.oAuthAccount.count({ where: { provider: "google" } })
  ]);

  const userIds = users.map((user) => user.id);
  const lastEvents = userIds.length
    ? await prisma.analyticsEvent.findMany({
        where: { userId: { in: userIds } },
        orderBy: { createdAt: "desc" },
        select: { userId: true, createdAt: true, type: true },
        take: pageSize * 4
      })
    : [];
  const lastByUser = new Map<string, (typeof lastEvents)[number]>();
  lastEvents.forEach((event) => {
    if (event.userId && !lastByUser.has(event.userId)) lastByUser.set(event.userId, event);
  });

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const baseParams = { q, role: role === "ALL" ? "" : role, provider: provider === "all" ? "" : provider };

  return (
    <AdminShell>
      <div className="admin-screen admin-dense-screen">
        <AdminPageHeader
          eyebrow="Админка"
          title="Пользователи"
          description="Плотный список для масштаба. Нажми строку, чтобы открыть полную историю пользователя."
        />

        <div className="admin-grid compact admin-kpi-strip">
          <Card className="admin-metric"><UserRound /><span>Найдено</span><strong>{total}</strong><small>по фильтрам</small></Card>
          <Card className="admin-metric"><UserRound /><span>Google</span><strong>{googleUsers}</strong><small>соц-входы</small></Card>
        </div>

        <Card className="admin-panel admin-filter-panel">
          <form className="admin-filter-bar" action="/admin/users">
            <label><Search size={18} /><input name="q" defaultValue={q} placeholder="Email, имя или ник" /></label>
            <select name="role" defaultValue={role}>
              <option value="ALL">Все роли</option>
              <option value="ADMIN">Админы</option>
              <option value="CLIENT">Заказчики</option>
              <option value="WORKER">Клипперы</option>
              <option value="BOTH">Обе роли</option>
            </select>
            <select name="provider" defaultValue={provider}>
              <option value="all">Любой вход</option>
              <option value="google">Google</option>
              <option value="email">Email</option>
            </select>
            <button className="btn btn-primary" type="submit">Найти</button>
          </form>
        </Card>

        <Card className="admin-panel">
          <div className="section-head compact"><h2>Создать пользователя</h2></div>
          <form className="admin-inline-form" action={adminCreateUserAction}>
            <input name="email" type="email" placeholder="email@example.com" required />
            <input name="name" placeholder="Имя" required />
            <input name="handle" placeholder="ник" required />
            <select name="role" defaultValue="WORKER">
              <option value="WORKER">Клиппер</option>
              <option value="CLIENT">Заказчик</option>
              <option value="BOTH">Обе роли</option>
              <option value="ADMIN">Админ</option>
            </select>
            <button className="btn btn-primary" type="submit">Создать</button>
          </form>
        </Card>

        <Card className="admin-panel">
          <div className="admin-table user-table">
            <div className="admin-table-head">
              <span>Пользователь</span>
              <span>Роль</span>
              <span>Деньги</span>
              <span>Активность</span>
              <span>Контент</span>
            </div>
            {users.map((user) => {
              const last = lastByUser.get(user.id);
              const auth = user.oauthAccounts.length ? user.oauthAccounts.map((item) => providerLabel(item.provider)).join(", ") : "Email";
              return (
                <Link className="admin-table-row clickable" href={`/admin/users/${user.id}`} key={user.id}>
                  <div className="admin-user-cell">
                    <div className="order-avatar">{user.name.slice(0, 2).toUpperCase()}</div>
                    <div>
                      <strong>{user.name}</strong>
                      <span>{user.email}</span>
                      <small>@{user.handle} · {fullDate(user.createdAt)}</small>
                    </div>
                  </div>
                  <div><Tag tone={user.role === "ADMIN" ? "warn" : "soft"}>{roleLabel(user.role)}</Tag><span>trust {user.trustScore}</span></div>
                  <div><strong>{rub(user.balanceCents)}</strong><span>hold {rub(user.holdBalanceCents)}</span></div>
                  <div><strong>{last ? fullDate(last.createdAt) : "нет"}</strong><span>{auth}</span></div>
                  <div><strong>{user._count.ownedCampaigns} заказов</strong><span>{user._count.submissions} работ · {user._count.transactions} операций</span></div>
                </Link>
              );
            })}
          </div>

          <div className="admin-dense-list mobile-full-list">
            {users.map((user) => {
              const last = lastByUser.get(user.id);
              return (
                <Link className="admin-mobile-row" href={`/admin/users/${user.id}`} key={user.id}>
                  <span>{user.name}<em>{user.email}</em></span>
                  <b>{roleLabel(user.role)}</b>
                  <small>{last ? fullDate(last.createdAt) : "нет входов"}</small>
                </Link>
              );
            })}
          </div>
          {!users.length ? <p className="muted">Ничего не найдено. Попробуй убрать фильтр.</p> : null}
        </Card>

        <div className="admin-pagination">
          <Link className={page <= 1 ? "disabled" : ""} href={pageHref("/admin/users", baseParams, Math.max(1, page - 1))}>Назад</Link>
          <span>{page} / {totalPages}</span>
          <Link className={page >= totalPages ? "disabled" : ""} href={pageHref("/admin/users", baseParams, Math.min(totalPages, page + 1))}>Дальше</Link>
        </div>
      </div>
    </AdminShell>
  );
}
