import Link from "next/link";
import { BriefcaseBusiness, CheckCircle2, Eye, Plus, Star, WalletCards, Zap } from "lucide-react";
import { switchRoleAction } from "@/app/actions";
import { AppShell, Card, Tag } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { compactNumber, rub } from "@/lib/money";

export default async function ProfilePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const tab = String(params.tab || "overview");
  const user = await requireUser();
  const [submissions, campaigns, earnings, transactions, savedCampaigns, likedCampaigns] = await Promise.all([
    prisma.submission.findMany({ where: { workerId: user.id }, include: { campaign: true }, orderBy: { currentViews: "desc" }, take: 8 }),
    prisma.campaign.findMany({ where: { ownerId: user.id }, include: { submissions: true }, orderBy: { createdAt: "desc" }, take: 5 }),
    prisma.transaction.aggregate({ where: { userId: user.id, type: "EARNING" }, _sum: { netCents: true } }),
    prisma.transaction.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 4 }),
    prisma.savedCampaign.findMany({ where: { userId: user.id }, include: { campaign: true }, orderBy: { createdAt: "desc" }, take: 12 }),
    prisma.likedCampaign.findMany({ where: { userId: user.id }, include: { campaign: true }, orderBy: { createdAt: "desc" }, take: 12 })
  ]);

  const views = submissions.reduce((sum, item) => sum + item.currentViews, 0);

  return (
    <AppShell>
      <section className="section profile-screen">
        <div className="profile-topline">
          <div>
            <span className="eyebrow">ReelPay</span>
          </div>
          <Link className="settings-dot" href="/wallet">⚙</Link>
        </div>

        <div className="profile-main">
          <div className="profile-person">
            <div className="avatar-ring">{user.name.slice(0, 2).toUpperCase()}</div>
            <div>
              <h2>{user.name}</h2>
              <p className="muted">@{user.handle}</p>
              <div className="rating-line"><Star size={18} fill="#fbbf24" color="#fbbf24" /> 4,9 <Tag>Топ-исполнитель</Tag></div>
            </div>
          </div>
          <Card className="wallet-mini">
            <span><WalletCards size={18} /> Кошелек</span>
            <strong>{rub(user.balanceCents)}</strong>
            <Link href="/wallet">Пополнить <Plus size={16} /></Link>
          </Card>
        </div>

        <form className="role-switch" action={switchRoleAction}>
          <button className={user.role === "WORKER" || user.role === "BOTH" ? "active" : ""} name="role" value="WORKER" type="submit"><Zap size={18} /> Исполнитель</button>
          <button className={user.role === "CLIENT" ? "active" : ""} name="role" value="CLIENT" type="submit"><BriefcaseBusiness size={18} /> Заказчик</button>
        </form>

        <nav className="profile-tabs" aria-label="Профиль">
          <Link className={tab === "overview" ? "active" : ""} href="/profile">Обзор</Link>
          <Link className={tab === "saved" ? "active" : ""} href="/profile?tab=saved">Избранное</Link>
          <Link className={tab === "likes" ? "active" : ""} href="/profile?tab=likes">Лайки</Link>
        </nav>

        {tab === "saved" ? (
          <section className="section-list">
            <div className="section-head compact">
              <h2>Избранные заказы</h2>
              <Link href="/feed">Открыть ленту</Link>
            </div>
            <Card className="stack-list">
              {savedCampaigns.length ? savedCampaigns.map(({ campaign }) => (
                <div className="campaign-mini" key={campaign.id}>
                  <strong><Link href={`/campaigns/${campaign.id}`}>{campaign.title}</Link></strong>
                  <span>{campaign.niche || "Нарезка"} · {compactNumber(campaign.viewThreshold)} просмотров</span>
                  <Tag tone="soft">Saved</Tag>
                </div>
              )) : <p className="muted">Пока ничего не сохранено. Нажми закладку в ленте.</p>}
            </Card>
          </section>
        ) : null}

        {tab === "likes" ? (
          <section className="section-list">
            <div className="section-head compact">
              <h2>История лайков</h2>
              <Link href="/feed">Открыть ленту</Link>
            </div>
            <Card className="stack-list">
              {likedCampaigns.length ? likedCampaigns.map(({ campaign }) => (
                <div className="campaign-mini" key={campaign.id}>
                  <strong><Link href={`/campaigns/${campaign.id}`}>{campaign.title}</Link></strong>
                  <span>{campaign.niche || "Нарезка"} · {compactNumber(campaign.viewThreshold)} просмотров</span>
                  <Tag tone="good">Liked</Tag>
                </div>
              )) : <p className="muted">Пока нет лайков. Нажми сердечко в ленте.</p>}
            </Card>
          </section>
        ) : null}

        {tab === "overview" ? <section className="profile-metrics">
          <Card><WalletCards color="#22c55e" /><span>Заработано всего</span><strong>{rub(earnings._sum.netCents || 0)}</strong><small>+18% за месяц</small></Card>
          <Card><WalletCards color="#c084fc" /><span>Баланс</span><strong>{rub(user.balanceCents)}</strong><small>Доступно</small></Card>
          <Card><BriefcaseBusiness color="#38bdf8" /><span>Выполнено заказов</span><strong>{submissions.length}</strong><small>+{Math.min(32, submissions.length)} за месяц</small></Card>
          <Card><Eye color="#f472b6" /><span>Просмотры</span><strong>{compactNumber(views)}</strong><small>+22% за месяц</small></Card>
        </section> : null}

        {tab === "overview" ? <section className="section-list">
          <div className="section-head compact">
            <h2>Активные заказы</h2>
            <Link href="/campaigns">Смотреть все</Link>
          </div>
          <Card className="stack-list">
            {submissions.slice(0, 3).map((submission, index) => (
              <div className="progress-row" key={submission.id}>
                <div className="thumb" style={{ backgroundImage: `url(${index % 2 === 0 ? "/assets/gaming-order.png" : "/assets/podcast-order.png"})` }} />
                <div>
                  <strong>{submission.campaign.title}</strong>
                  <p>{rub(Math.round((submission.currentViews / 1000) * submission.campaign.cpmRateCents))} · {compactNumber(submission.currentViews)} просмотров</p>
                  <i style={{ width: `${Math.min(100, Math.round((submission.currentViews / submission.campaign.viewThreshold) * 100))}%` }} />
                </div>
                <span>{submission.status}</span>
              </div>
            ))}
          </Card>
        </section> : null}

        {tab === "overview" ? <section className="section-list">
          <div className="section-head compact">
            <h2>Мои кампании</h2>
            <Link href="/campaigns/new">Создать</Link>
          </div>
          <Card className="stack-list">
            {campaigns.length ? campaigns.map((campaign) => (
              <div className="campaign-mini" key={campaign.id}>
                <strong>{campaign.title}</strong>
                <span>{campaign.submissions.length} заявок · {rub(campaign.remainingBudgetCents)}</span>
                <Tag tone="good">{campaign.status}</Tag>
              </div>
            )) : <p className="muted">Пока нет созданных кампаний.</p>}
          </Card>
        </section> : null}

        {tab === "overview" ? <section className="section-list">
          <div className="section-head compact">
            <h2>История выплат</h2>
            <Link href="/wallet">Смотреть все</Link>
          </div>
          <Card className="stack-list">
            {transactions.map((transaction) => (
              <div className="pay-row" key={transaction.id}>
                <CheckCircle2 color="#22c55e" />
                <div>
                  <strong>{transaction.type === "WITHDRAWAL" ? "Вывод на карту" : "Начисление"}</strong>
                  <p>{transaction.createdAt.toLocaleDateString("ru-RU")}</p>
                </div>
                <span>{rub(transaction.netCents)}</span>
              </div>
            ))}
          </Card>
        </section> : null}
      </section>
    </AppShell>
  );
}
