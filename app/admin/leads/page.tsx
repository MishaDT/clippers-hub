import Link from "next/link";
import { BusinessLeadStatus, Prisma } from "@prisma/client";
import { ArrowUpRight, BriefcaseBusiness, CircleDollarSign, Filter, UsersRound } from "lucide-react";
import { AdminPageHeader, AdminShell } from "@/components/admin-shell";
import { Card, Tag } from "@/components/ui";
import { businessLeadStatusLabels, businessLeadStatuses } from "@/lib/business-lead";
import { rub } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { updateBusinessLeadAction } from "./actions";
import styles from "./leads.module.css";

export const dynamic = "force-dynamic";

export default async function AdminLeadsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const selected = businessLeadStatuses.includes(String(params.status) as (typeof businessLeadStatuses)[number])
    ? String(params.status) as BusinessLeadStatus
    : null;
  const where: Prisma.BusinessLeadWhereInput = selected ? { status: selected } : {};
  const [leads, grouped, admins] = await Promise.all([
    prisma.businessLead.findMany({ where, orderBy: { createdAt: "desc" }, take: 100, include: { assignedAdmin: { select: { id: true, name: true } }, user: { select: { handle: true } } } }),
    prisma.businessLead.groupBy({ by: ["status"], _count: true, _sum: { budgetCents: true } }),
    prisma.user.findMany({ where: { role: "ADMIN", isDemo: false }, select: { id: true, name: true }, orderBy: { name: "asc" } })
  ]);
  const counts = new Map(grouped.map((row) => [row.status, row._count]));
  const totalBudget = grouped.reduce((sum, row) => sum + (row._sum.budgetCents || 0), 0);
  const won = counts.get("WON") || 0;

  return (
    <AdminShell>
      <div className={`admin-screen ${styles.page}`}>
        <AdminPageHeader eyebrow="Продажи" title="Заявки на пилот" description="Очередь от первого контакта до оплаченной и запущенной кампании." action={<Link className="btn" href="/#pilot">Открыть форму</Link>} />
        {params.updated ? <p className={styles.success}>Заявка обновлена.</p> : null}
        <div className={styles.metrics}>
          <Card><UsersRound /><span>Всего</span><strong>{grouped.reduce((sum, row) => sum + row._count, 0)}</strong></Card>
          <Card><BriefcaseBusiness /><span>Новых</span><strong>{counts.get("NEW") || 0}</strong></Card>
          <Card><CircleDollarSign /><span>Потенциал</span><strong>{rub(totalBudget)}</strong></Card>
          <Card><ArrowUpRight /><span>Запущено</span><strong>{won}</strong></Card>
        </div>
        <Card className={styles.funnel}>
          {businessLeadStatuses.map((status) => (
            <Link className={selected === status ? styles.active : ""} href={`/admin/leads?status=${status}`} key={status}>
              <span>{businessLeadStatusLabels[status]}</span><b>{counts.get(status) || 0}</b>
            </Link>
          ))}
          <Link className={!selected ? styles.active : ""} href="/admin/leads"><Filter size={15} /> Все</Link>
        </Card>
        <div className={styles.list}>
          {leads.map((lead) => (
            <Card className={styles.lead} key={lead.id}>
              <header><div><Tag tone={lead.status === "WON" ? "good" : lead.status === "LOST" ? "soft" : "warn"}>{businessLeadStatusLabels[lead.status]}</Tag><small>{lead.createdAt.toLocaleString("ru-RU")}</small></div><strong>{rub(lead.budgetCents)}</strong></header>
              <div className={styles.identity}><h2>{lead.name}</h2><a href={lead.contact.includes("@") && !lead.contact.startsWith("@") ? `mailto:${lead.contact}` : lead.contact.startsWith("@") ? `https://t.me/${lead.contact.slice(1)}` : `tel:${lead.contact.replace(/[^\d+]/g, "")}`}>{lead.contact}</a></div>
              <p>{lead.goal}</p>
              <div className={styles.meta}><span>Источник: {lead.utmSource || lead.source}</span>{lead.user?.handle ? <Link href={`/profiles/${lead.user.handle}`}>Профиль @{lead.user.handle}</Link> : null}{lead.contentUrl ? <a href={lead.contentUrl} target="_blank" rel="noopener noreferrer">Исходный контент <ArrowUpRight size={14} /></a> : null}</div>
              <form className={styles.form} action={updateBusinessLeadAction}>
                <input type="hidden" name="leadId" value={lead.id} />
                <label>Этап<select name="status" defaultValue={lead.status}>{businessLeadStatuses.map((status) => <option value={status} key={status}>{businessLeadStatusLabels[status]}</option>)}</select></label>
                <label>Ответственный<select name="assignedAdminId" defaultValue={lead.assignedAdminId || ""}><option value="">Не назначен</option>{admins.map((admin) => <option value={admin.id} key={admin.id}>{admin.name}</option>)}</select></label>
                <label className={styles.notes}>Заметки<textarea name="notes" defaultValue={lead.notes} rows={2} maxLength={2000} /></label>
                <button className="btn btn-primary" type="submit">Сохранить</button>
              </form>
            </Card>
          ))}
          {!leads.length ? <Card className={styles.empty}>Заявок на этом этапе пока нет.</Card> : null}
        </div>
      </div>
    </AdminShell>
  );
}
