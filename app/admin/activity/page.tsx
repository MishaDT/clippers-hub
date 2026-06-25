import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { Activity, Eye, Search, UserCheck } from "lucide-react";
import { AdminPageHeader, AdminShell } from "@/components/admin-shell";
import { Card, Tag } from "@/components/ui";
import { prisma } from "@/lib/prisma";
import { clampPage, eventLabel, fullDate, pageHref, providerLabel } from "@/lib/admin-format";

export const dynamic = "force-dynamic";

const pageSize = 60;
const eventTypes = ["ALL", "PAGE_VIEW", "LOGIN_SUCCESS", "REGISTER_SUCCESS", "OAUTH_LOGIN", "OAUTH_REGISTER", "OAUTH_LINK", "LOGOUT"];

function daysAgo(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

export default async function AdminActivityPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const q = String(params.q || "").trim();
  const type = eventTypes.includes(String(params.type)) ? String(params.type) : "ALL";
  const provider = String(params.provider || "all");
  const page = clampPage(params.page);

  const where: Prisma.AnalyticsEventWhereInput = {};
  if (type !== "ALL") where.type = type;
  if (provider !== "all") where.provider = provider === "email" ? null : provider;
  if (q) {
    where.OR = [
      { path: { contains: q, mode: "insensitive" } },
      { user: { email: { contains: q, mode: "insensitive" } } },
      { user: { name: { contains: q, mode: "insensitive" } } },
      { user: { handle: { contains: q, mode: "insensitive" } } }
    ];
  }

  const day = daysAgo(1);
  const [total, events, views24h, users24h] = await Promise.all([
    prisma.analyticsEvent.count({ where }),
    prisma.analyticsEvent.findMany({
      where,
      include: { user: { select: { email: true, name: true, handle: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize
    }),
    prisma.analyticsEvent.count({ where: { type: "PAGE_VIEW", createdAt: { gte: day } } }),
    prisma.analyticsEvent.findMany({
      where: { userId: { not: null }, createdAt: { gte: day } },
      distinct: ["userId"],
      select: { userId: true }
    })
  ]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const baseParams = { q, type: type === "ALL" ? "" : type, provider: provider === "all" ? "" : provider };

  return (
    <AdminShell>
      <div className="admin-screen admin-dense-screen">
        <AdminPageHeader
          eyebrow="Журнал"
          title="События"
          description="Плотный журнал действий. Строки раскрываются по нажатию."
        />

        <div className="admin-grid compact admin-kpi-strip">
          <Card className="admin-metric"><Eye /><span>Просмотры 24ч</span><strong>{views24h}</strong><small>страницы</small></Card>
          <Card className="admin-metric"><UserCheck /><span>Активные 24ч</span><strong>{users24h.length}</strong><small>вошедшие</small></Card>
          <Card className="admin-metric"><Activity /><span>Найдено</span><strong>{total}</strong><small>событий</small></Card>
        </div>

        <Card className="admin-panel admin-filter-panel">
          <form className="admin-filter-bar" action="/admin/activity">
            <label>
              <Search size={18} />
              <input name="q" defaultValue={q} placeholder="Страница, email, имя, ник" />
            </label>
            <select name="type" defaultValue={type}>
              {eventTypes.map((item) => <option value={item} key={item}>{item === "ALL" ? "Все события" : eventLabel(item)}</option>)}
            </select>
            <select name="provider" defaultValue={provider}>
              <option value="all">Любой источник</option>
              <option value="google">Google</option>
              <option value="vk">VK ID</option>
              <option value="yandex">Yandex</option>
              <option value="email">Email/нет</option>
            </select>
            <button className="btn btn-primary" type="submit">Фильтр</button>
          </form>
        </Card>

        <Card className="admin-panel">
          <div className="admin-table activity-table">
            <div className="admin-table-head">
              <span>Событие</span>
              <span>Пользователь</span>
              <span>Страница</span>
              <span>Источник</span>
              <span>Время</span>
            </div>
            {events.map((event) => (
              <div className="admin-table-row" key={event.id}>
                <div><Tag tone={event.type.includes("OAUTH") ? "good" : "soft"}>{eventLabel(event.type)}</Tag></div>
                <div><strong>{event.user?.name || "Гость"}</strong><span>{event.user?.email || event.ipHash || "без данных"}</span></div>
                <div><span>{event.path || "не указана"}</span></div>
                <div><span>{providerLabel(event.provider)}</span></div>
                <div><strong>{fullDate(event.createdAt)}</strong></div>
              </div>
            ))}
          </div>

          <div className="admin-dense-list">
            {events.map((event) => (
              <details className="admin-dense-row" key={event.id}>
                <summary>
                  <span>{eventLabel(event.type)}</span>
                  <b>{event.user?.email || "Гость"}</b>
                  <em>{fullDate(event.createdAt)}</em>
                </summary>
                <div className="admin-dense-details">
                  <p><b>Тип:</b> {event.type}</p>
                  <p><b>Пользователь:</b> {event.user?.name || "Гость"} · {event.user?.email || "нет email"}</p>
                  <p><b>Страница:</b> {event.path || "не указана"}</p>
                  <p><b>Источник:</b> {providerLabel(event.provider)}</p>
                  <p><b>Время:</b> {fullDate(event.createdAt)}</p>
                  <p><b>IP hash:</b> {event.ipHash || "нет"}</p>
                </div>
              </details>
            ))}
          </div>
        </Card>

        <div className="admin-pagination">
          <Link className={page <= 1 ? "disabled" : ""} href={pageHref("/admin/activity", baseParams, Math.max(1, page - 1))}>Назад</Link>
          <span>{page} / {totalPages}</span>
          <Link className={page >= totalPages ? "disabled" : ""} href={pageHref("/admin/activity", baseParams, Math.min(totalPages, page + 1))}>Дальше</Link>
        </div>
      </div>
    </AdminShell>
  );
}
