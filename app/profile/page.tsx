import Link from "next/link";
import { BriefcaseBusiness, CheckCircle2, Eye, Link2, Plus, ShieldCheck, Trash2, Upload, WalletCards, Zap } from "lucide-react";
import { deleteAccountAction, depositAction, switchRoleAction, unlinkOAuthAccountAction, withdrawAction } from "@/app/actions";
import { AppShell, Card, Tag } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { isConfigured, type ProviderId } from "@/lib/oauth";
import { prisma } from "@/lib/prisma";
import { compactNumber, rub } from "@/lib/money";
import { getActiveRoleMode } from "@/lib/role-mode";

const OAUTH_PROVIDERS: Array<{ id: ProviderId; label: string }> = [
  { id: "google", label: "Google" },
  { id: "vk", label: "VK ID" },
  { id: "yandex", label: "Yandex" }
];

async function loadWorker(userId: string) {
  const activeStatuses = ["ACCEPTED", "POSTED", "VERIFIED", "THRESHOLD_MET", "SETTLING"] as const;
  const [submissions, earnings, transactions, stats, activeCount] = await Promise.all([
    prisma.submission.findMany({
      where: { workerId: userId },
      select: {
        id: true,
        currentViews: true,
        status: true,
        campaign: { select: { title: true, cpmRateCents: true, viewThreshold: true } }
      },
      orderBy: { currentViews: "desc" },
      take: 6
    }),
    prisma.transaction.aggregate({ where: { userId, type: "EARNING" }, _sum: { netCents: true } }),
    prisma.transaction.findMany({
      where: { userId },
      select: { id: true, type: true, netCents: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 5
    }),
    prisma.submission.aggregate({ where: { workerId: userId }, _sum: { currentViews: true } }),
    prisma.submission.count({ where: { workerId: userId, status: { in: [...activeStatuses] } } })
  ]);
  return {
    submissions,
    transactions,
    earningsCents: earnings._sum.netCents || 0,
    activeCount,
    views: stats._sum.currentViews || 0
  };
}

async function loadClient(userId: string) {
  const campaignWhere = { ownerId: userId };
  const submissionWhere = { campaign: { ownerId: userId } };
  const [campaigns, campaignCount, viewStats, budgetStats, clipCount, topClips] = await Promise.all([
    prisma.campaign.findMany({
      where: campaignWhere,
      select: {
        id: true,
        title: true,
        status: true,
        remainingBudgetCents: true,
        _count: { select: { submissions: true } }
      },
      orderBy: { createdAt: "desc" },
      take: 8
    }),
    prisma.campaign.count({ where: campaignWhere }),
    prisma.submission.aggregate({ where: submissionWhere, _sum: { currentViews: true } }),
    prisma.campaign.aggregate({ where: campaignWhere, _sum: { remainingBudgetCents: true } }),
    prisma.submission.count({ where: submissionWhere }),
    prisma.submission.findMany({
      where: submissionWhere,
      select: {
        id: true,
        currentViews: true,
        worker: { select: { handle: true } },
        campaign: { select: { title: true } }
      },
      orderBy: { currentViews: "desc" },
      take: 6
    })
  ]);
  const clips = topClips.map((clip) => ({
    id: clip.id,
    handle: clip.worker.handle,
    title: clip.campaign.title,
    views: clip.currentViews
  }));
  return {
    campaigns,
    campaignCount,
    totalViews: viewStats._sum.currentViews || 0,
    remaining: budgetStats._sum.remainingBudgetCents || 0,
    clips,
    clipCount
  };
}

export default async function ProfilePage() {
  const user = await requireUser();
  const view = await getActiveRoleMode(user);
  const canSwitchMode = user.role === "BOTH" || user.role === "ADMIN";
  const [worker, client, oauthAccounts] = await Promise.all([
    view === "worker" ? loadWorker(user.id) : Promise.resolve(null),
    view === "client" ? loadClient(user.id) : Promise.resolve(null),
    prisma.oAuthAccount.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } })
  ]);

  return (
    <AppShell>
      <section className="section profile-screen">
        <div className="profile-main">
          <div className="profile-person">
            <img className="pf-avatar" src={user.avatar || `https://api.dicebear.com/9.x/thumbs/svg?seed=${encodeURIComponent(user.handle)}`} alt="" />
            <div>
              <h2>{user.name}</h2>
              <p className="muted">@{user.handle}</p>
              <div className="rating-line">
                <Tag>{view === "client" ? "Заказчик" : "Клиппер"}</Tag>
              </div>
            </div>
          </div>
          <Card className="wallet-mini">
            <span><WalletCards size={18} /> Кошелек</span>
            <strong>{rub(user.balanceCents)}</strong>
            <Link href="/wallet">Пополнить <Plus size={16} /></Link>
          </Card>
        </div>

        {canSwitchMode ? (
          <form className="role-switch" action={switchRoleAction}>
            <button className={view === "worker" ? "active" : ""} name="mode" value="worker" type="submit"><Zap size={18} /> Исполнитель</button>
            <button className={view === "client" ? "active" : ""} name="mode" value="client" type="submit"><BriefcaseBusiness size={18} /> Заказчик</button>
          </form>
        ) : null}

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
                {worker.submissions.length ? worker.submissions.map((submission) => (
                  <div className="progress-row" key={submission.id}>
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
              <Card><BriefcaseBusiness color="#38bdf8" /><span>Моих заказов</span><strong>{client.campaignCount}</strong></Card>
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
                    <span>{campaign._count.submissions} клипов · {rub(campaign.remainingBudgetCents)} осталось</span>
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
                    <img className="pf-ava" src={`https://api.dicebear.com/9.x/thumbs/svg?seed=${encodeURIComponent(clip.handle)}`} alt="" />
                    <div><strong>@{clip.handle}</strong><p>{clip.title}</p></div>
                    <span>{compactNumber(clip.views)}</span>
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

        <section className="section-list account-settings">
          <div className="section-head compact">
            <h2>Данные и безопасность</h2>
          </div>
          <Card className="account-card">
            <div className="account-card-head">
              <ShieldCheck color="#22c55e" />
              <div>
                <strong>Социальный вход</strong>
                <p>Мы храним только связку “провайдер + id аккаунта”. Токены соцсетей не сохраняем.</p>
              </div>
            </div>
            <div className="oauth-list">
              {OAUTH_PROVIDERS.map((provider) => {
                const linked = oauthAccounts.find((account) => account.provider === provider.id);
                const configured = isConfigured(provider.id);
                return (
                  <div className="oauth-row" key={provider.id}>
                    <div>
                      <b>{provider.label}</b>
                      <span>
                        {linked ? "Привязано" : configured ? "Можно привязать" : "Нужны ключи OAuth в Vercel"}
                      </span>
                    </div>
                    {linked ? (
                      <form action={unlinkOAuthAccountAction}>
                        <input type="hidden" name="oauthAccountId" value={linked.id} />
                        <button className="btn btn-small btn-ghost" type="submit">Отвязать</button>
                      </form>
                    ) : configured ? (
                      <Link className="btn btn-small" href={`/api/auth/oauth/${provider.id}?mode=link`}>
                        <Link2 size={15} /> Привязать
                      </Link>
                    ) : (
                      <span className="btn btn-small btn-ghost disabled">Не настроено</span>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>

          <Card className="account-card danger-zone">
            <div className="account-card-head">
              <Trash2 color="#fb7185" />
              <div>
                <strong>Удалить аккаунт</strong>
                <p>Удалятся профиль, заказы, отклики, сохранённые реакции и привязки соцсетей.</p>
              </div>
            </div>
            <form className="delete-account-form" action={deleteAccountAction}>
              <label className="field">
                Для подтверждения введите УДАЛИТЬ
                <input name="confirmation" placeholder="УДАЛИТЬ" />
              </label>
              <button className="btn btn-ghost danger-btn" type="submit">Удалить аккаунт</button>
            </form>
          </Card>
        </section>
      </section>
    </AppShell>
  );
}
