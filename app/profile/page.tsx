import Link from "next/link";
import { BriefcaseBusiness, CheckCircle2, Eye, Plus, Star, Upload, WalletCards, Zap } from "lucide-react";
import { depositAction, switchRoleAction, withdrawAction } from "@/app/actions";
import { AppShell, Card, Tag } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { compactNumber, rub } from "@/lib/money";

async function loadWorker(userId: string) {
  const [submissions, earnings, transactions] = await Promise.all([
    prisma.submission.findMany({ where: { workerId: userId }, include: { campaign: true }, orderBy: { currentViews: "desc" }, take: 6 }),
    prisma.transaction.aggregate({ where: { userId, type: "EARNING" }, _sum: { netCents: true } }),
    prisma.transaction.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 5 })
  ]);
  const active = submissions.filter((s) => ["ACCEPTED", "POSTED", "VERIFIED", "THRESHOLD_MET", "SETTLING"].includes(s.status));
  const views = submissions.reduce((sum, s) => sum + s.currentViews, 0);
  return { submissions, transactions, earningsCents: earnings._sum.netCents || 0, activeCount: active.length, views };
}

async function loadClient(userId: string, role: string) {
  const campaigns = await prisma.campaign.findMany({
    where: role === "ADMIN" ? {} : { ownerId: userId },
    include: { submissions: { include: { worker: true } } },
    orderBy: { createdAt: "desc" },
    take: 8
  });
  const totalViews = campaigns.reduce((sum, c) => sum + c.submissions.reduce((i, s) => i + s.currentViews, 0), 0);
  const remaining = campaigns.reduce((sum, c) => sum + c.remainingBudgetCents, 0);
  const clips = campaigns
    .flatMap((c) => c.submissions.map((s) => ({ id: s.id, handle: s.worker.handle, title: c.title, views: s.currentViews })))
    .sort((a, b) => b.views - a.views)
    .slice(0, 6);
  return { campaigns, totalViews, remaining, clips, clipCount: clips.length };
}

export default async function ProfilePage() {
  const user = await requireUser();
  const view = user.role === "CLIENT" ? "client" : "worker";
  const worker = view === "worker" ? await loadWorker(user.id) : null;
  const client = view === "client" ? await loadClient(user.id, user.role) : null;

  return (
    <AppShell>
      <section className="section profile-screen">
        <div className="profile-main">
          <div className="profile-person">
            <div className="avatar-ring">{user.name.slice(0, 2).toUpperCase()}</div>
            <div>
              <h2>{user.name}</h2>
              <p className="muted">@{user.handle}</p>
              <div className="rating-line">
                <Star size={18} fill="#fbbf24" color="#fbbf24" /> 4,9 <Tag>{view === "client" ? "Заказчик" : "Клиппер"}</Tag>
              </div>
            </div>
          </div>
          <Card className="wallet-mini">
            <span><WalletCards size={18} /> Кошелек</span>
            <strong>{rub(user.balanceCents)}</strong>
            <Link href="/wallet">Пополнить <Plus size={16} /></Link>
          </Card>
        </div>

        <form className="role-switch" action={switchRoleAction}>
          <button className={view === "worker" ? "active" : ""} name="role" value="WORKER" type="submit"><Zap size={18} /> Клиппер</button>
          <button className={view === "client" ? "active" : ""} name="role" value="CLIENT" type="submit"><BriefcaseBusiness size={18} /> Заказчик</button>
        </form>

        {view === "worker" && worker ? (
          <>
            <div className="actions profile-actions">
              <Link className="btn btn-primary" href="/campaigns">Найти заказ</Link>
              <Link className="btn" href="/upload"><Upload size={16} /> Выложить</Link>
            </div>

            <section className="profile-metrics">
              <Card><WalletCards color="#22c55e" /><span>Заработано всего</span><strong>{rub(worker.earningsCents)}</strong></Card>
              <Card><WalletCards color="#c084fc" /><span>Баланс</span><strong>{rub(user.balanceCents)}</strong></Card>
              <Card><BriefcaseBusiness color="#38bdf8" /><span>Активных заказов</span><strong>{worker.activeCount}</strong></Card>
              <Card><Eye color="#f472b6" /><span>Просмотры</span><strong>{compactNumber(worker.views)}</strong></Card>
            </section>

            <section className="section-list">
              <div className="section-head compact"><h2>Мои заказы</h2><Link href="/campaigns">Найти ещё</Link></div>
              <Card className="stack-list">
                {worker.submissions.length ? worker.submissions.map((submission, index) => (
                  <div className="progress-row" key={submission.id}>
                    <div className="thumb" style={{ backgroundImage: `url(${index % 2 === 0 ? "/assets/gaming-order.png" : "/assets/podcast-order.png"})` }} />
                    <div>
                      <strong>{submission.campaign.title}</strong>
                      <p>{rub(Math.round((submission.currentViews / 1000) * submission.campaign.cpmRateCents))} · {compactNumber(submission.currentViews)} просмотров</p>
                      <i style={{ width: `${Math.min(100, Math.round((submission.currentViews / Math.max(submission.campaign.viewThreshold, 1)) * 100))}%` }} />
                    </div>
                    <span>{submission.status}</span>
                  </div>
                )) : <p className="muted">Пока нет взятых заказов. Открой ленту или биржу и откликнись.</p>}
              </Card>
            </section>

            <section className="section-list">
              <div className="section-head compact"><h2>Вывести деньги</h2></div>
              <Card>
                <p className="muted">Доступно к выводу: <strong>{rub(user.balanceCents)}</strong>. На проверке: {rub(user.holdBalanceCents)}.</p>
                <form className="form" action={withdrawAction}>
                  <label className="field">Сумма, ₽<input name="amount" type="number" defaultValue="5000" /></label>
                  <button className="btn btn-primary" type="submit">Вывести</button>
                </form>
              </Card>
            </section>

            <section className="section-list">
              <div className="section-head compact"><h2>История выплат</h2><Link href="/wallet">Все</Link></div>
              <Card className="stack-list">
                {worker.transactions.length ? worker.transactions.map((t) => (
                  <div className="pay-row" key={t.id}>
                    <CheckCircle2 color="#22c55e" />
                    <div><strong>{t.type === "WITHDRAWAL" ? "Вывод на карту" : "Начисление"}</strong><p>{t.createdAt.toLocaleDateString("ru-RU")}</p></div>
                    <span>{rub(t.netCents)}</span>
                  </div>
                )) : <p className="muted">Выплат пока не было.</p>}
              </Card>
            </section>
          </>
        ) : null}

        {view === "client" && client ? (
          <>
            <div className="actions profile-actions">
              <Link className="btn btn-primary" href="/campaigns/new"><Plus size={16} /> Создать заказ</Link>
              <Link className="btn" href="/feed">Смотреть клипы</Link>
            </div>

            <section className="profile-metrics">
              <Card><BriefcaseBusiness color="#38bdf8" /><span>Моих заказов</span><strong>{client.campaigns.length}</strong></Card>
              <Card><Eye color="#f472b6" /><span>Просмотров</span><strong>{compactNumber(client.totalViews)}</strong></Card>
              <Card><WalletCards color="#22c55e" /><span>Бюджет остался</span><strong>{rub(client.remaining)}</strong></Card>
              <Card><WalletCards color="#c084fc" /><span>Клипов сделали</span><strong>{client.clipCount}</strong></Card>
            </section>

            <section className="section-list">
              <div className="section-head compact"><h2>Мои заказы</h2><Link href="/campaigns/new">Создать</Link></div>
              <Card className="stack-list">
                {client.campaigns.length ? client.campaigns.map((campaign) => (
                  <div className="campaign-mini" key={campaign.id}>
                    <strong><Link href={`/campaigns/${campaign.id}`}>{campaign.title}</Link></strong>
                    <span>{campaign.submissions.length} клипов · {rub(campaign.remainingBudgetCents)} осталось</span>
                    <Tag tone={campaign.status === "LOW_BUDGET" ? "warn" : "good"}>{campaign.status}</Tag>
                  </div>
                )) : <p className="muted">Пока нет заказов. Нажми «Создать заказ».</p>}
              </Card>
            </section>

            <section className="section-list">
              <div className="section-head compact"><h2>Клипы, которые сделали</h2></div>
              <Card className="stack-list">
                {client.clips.length ? client.clips.map((clip) => (
                  <div className="pay-row" key={clip.id}>
                    <div className="thumb thumb-sm" style={{ backgroundImage: "url(/assets/marketplace-thumb.png)" }} />
                    <div><strong>@{clip.handle}</strong><p>{clip.title}</p></div>
                    <span>{compactNumber(clip.views)} 👁</span>
                  </div>
                )) : <p className="muted">Клипов по твоим заказам ещё нет.</p>}
              </Card>
            </section>

            <section className="section-list">
              <div className="section-head compact"><h2>Пополнить бюджет</h2></div>
              <Card>
                <form className="form" action={depositAction}>
                  <input type="hidden" name="provider" value="yookassa" />
                  <label className="field">Сумма, ₽<input name="amount" type="number" defaultValue="50000" /></label>
                  <button className="btn btn-primary" type="submit">Пополнить</button>
                </form>
              </Card>
            </section>
          </>
        ) : null}
      </section>
    </AppShell>
  );
}
