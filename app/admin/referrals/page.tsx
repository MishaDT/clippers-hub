import { BadgeRussianRuble, MousePointerClick, Network, ShieldAlert, UserCheck, Users } from "lucide-react";
import { AdminPageHeader, AdminShell } from "@/components/admin-shell";
import { Card, Tag } from "@/components/ui";
import { prisma } from "@/lib/prisma";
import { rub } from "@/lib/money";
import { moderateReferralRelationAction, saveReferralProgramAction, saveReferralTierAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminReferralsPage() {
  const [config, tiers, clicks, registrations, active, paid, flagged, leaders] = await Promise.all([
    prisma.referralProgramConfig.findUnique({ where: { id: "default" } }),
    prisma.referralTier.findMany({ orderBy: { minActiveReferrals: "asc" } }),
    prisma.referralClick.count(),
    prisma.referralRelation.count(),
    prisma.referralRelation.count({ where: { status: "ACTIVE" } }),
    prisma.referralCommission.aggregate({ where: { status: "AVAILABLE" }, _sum: { amountCents: true }, _count: true }),
    prisma.referralRelation.findMany({
      where: { status: "FLAGGED" },
      include: { referrer: { select: { name: true, handle: true } }, referredUser: { select: { name: true, handle: true } } },
      orderBy: { createdAt: "desc" },
      take: 30
    }),
    prisma.user.findMany({
      where: { referralsSent: { some: {} } },
      select: {
        id: true, name: true, handle: true,
        _count: { select: { referralsSent: { where: { status: "ACTIVE" } } } },
        referralCommissions: { where: { status: "AVAILABLE" }, select: { amountCents: true } }
      },
      take: 100
    })
  ]);
  const top = leaders
    .map((item) => ({ ...item, earned: item.referralCommissions.reduce((sum, row) => sum + row.amountCents, 0) }))
    .sort((a, b) => b.earned - a.earned)
    .slice(0, 10);
  return (
    <AdminShell>
      <div className="admin-screen">
        <AdminPageHeader eyebrow="Партнёры" title="Реферальная программа" description="Уровни, конверсия, комиссии и проверка подозрительных связей." />
        <div className="admin-grid compact">
          <Card className="admin-metric"><MousePointerClick /><span>Переходы</span><strong>{clicks}</strong><small>по ссылкам</small></Card>
          <Card className="admin-metric"><Users /><span>Регистрации</span><strong>{registrations}</strong><small>с реферером</small></Card>
          <Card className="admin-metric"><UserCheck /><span>Активные</span><strong>{active}</strong><small>с оплатой</small></Card>
          <Card className="admin-metric"><BadgeRussianRuble /><span>Выплачено</span><strong>{rub(paid._sum.amountCents || 0)}</strong><small>{paid._count} начислений</small></Card>
        </div>
        <div className="admin-two">
          <Card className="admin-panel">
            <div className="section-head compact"><h2>Настройки программы</h2></div>
            <form className="admin-row-form" action={saveReferralProgramAction}>
              <label><input type="checkbox" name="enabled" defaultChecked={config?.enabled ?? true} /> Программа включена</label>
              <label>Срок ссылки, дней<input name="attributionDays" type="number" min="1" max="90" defaultValue={config?.attributionDays ?? 30} /></label>
              <label>RP после активации<input name="activationRewardRp" type="number" min="0" max="10000" defaultValue={config?.activationRewardRp ?? 25} /></label>
              <button className="btn btn-primary" type="submit">Сохранить</button>
            </form>
          </Card>
          <Card className="admin-panel">
            <div className="section-head compact"><h2>Уровни</h2><Tag tone="soft">макс. 25%</Tag></div>
            <div className="admin-list">
              {tiers.map((tier) => (
                <form className="admin-event admin-row-form" action={saveReferralTierAction} key={tier.id}>
                  <input type="hidden" name="id" value={tier.id} />
                  <input name="title" defaultValue={tier.title} aria-label="Название уровня" />
                  <input name="minActiveReferrals" type="number" min="1" defaultValue={tier.minActiveReferrals} aria-label="Минимум активных" />
                  <input name="ratePercent" type="number" min="0" max="25" step=".1" defaultValue={tier.rateBps / 100} aria-label="Процент" />
                  <input name="sortOrder" type="number" defaultValue={tier.sortOrder} aria-label="Порядок" />
                  <label><input type="checkbox" name="active" defaultChecked={tier.active} /> Активен</label>
                  <button className="btn btn-small" type="submit">Сохранить</button>
                </form>
              ))}
              <form className="admin-event admin-row-form" action={saveReferralTierAction}>
                <input name="title" placeholder="Новый уровень" required />
                <input name="minActiveReferrals" type="number" min="1" placeholder="От рефералов" required />
                <input name="ratePercent" type="number" min="0" max="25" step=".1" placeholder="%" required />
                <input name="sortOrder" type="number" defaultValue="50" aria-label="Порядок" />
                <label><input type="checkbox" name="active" defaultChecked /> Активен</label>
                <button className="btn btn-small" type="submit">Добавить</button>
              </form>
            </div>
          </Card>
        </div>
        <div className="admin-two">
          <Card className="admin-panel">
            <div className="section-head compact"><h2><Network size={18} /> Лучшие партнёры</h2></div>
            <div className="admin-list">
              {top.map((item) => <div className="admin-event" key={item.id}><div><strong>{item.name}</strong><span>@{item.handle}</span></div><b>{item._count.referralsSent} активных</b><Tag tone="good">{rub(item.earned)}</Tag></div>)}
              {!top.length ? <p className="muted">Данных пока нет.</p> : null}
            </div>
          </Card>
          <Card className="admin-panel">
            <div className="section-head compact"><h2><ShieldAlert size={18} /> На проверке</h2><Tag tone={flagged.length ? "warn" : "good"}>{flagged.length}</Tag></div>
            <div className="admin-list">
              {flagged.map((item) => (
                <div className="admin-event" key={item.id}>
                  <div><strong>{item.referrer.name} → {item.referredUser.name}</strong><span>{item.flagReason || "Подозрительная связь"}</span></div>
                  <form action={moderateReferralRelationAction}><input type="hidden" name="id" value={item.id} /><button name="decision" value="activate">Разрешить</button><button name="decision" value="block">Блок</button></form>
                </div>
              ))}
              {!flagged.length ? <p className="muted">Подозрительных связей нет.</p> : null}
            </div>
          </Card>
        </div>
      </div>
    </AdminShell>
  );
}
