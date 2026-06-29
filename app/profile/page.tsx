import Link from "next/link";
import {
  ArrowRight,
  BriefcaseBusiness,
  CheckCircle2,
  Coins,
  Eye,
  Film,
  Plus,
  Settings,
  SquarePen,
  Trophy,
  WalletCards,
  Zap
} from "lucide-react";
import { switchRoleAction } from "@/app/actions";
import { ProfileRpBalance } from "@/components/profile-rp-balance";
import { WeeklyRewards } from "@/components/weekly-rewards";
import { ProfileDisclosure } from "@/components/profile-disclosure";
import { AppShell, Card, Tag } from "@/components/ui";
import { UserAvatar } from "@/components/user-avatar";
import { ProfileAchievements } from "@/components/profile-achievements";
import { requireUser } from "@/lib/auth";
import { compactNumber, rub } from "@/lib/money";
import { ACHIEVEMENTS, achievementProgress, formatRp } from "@/lib/achievements";
import { loadAchievementStats } from "@/lib/achievement-stats";
import { prisma } from "@/lib/prisma";
import { getActiveRoleMode } from "@/lib/role-mode";
import { RECURRING_REWARDS, moscowWeekKey } from "@/lib/rp";

const ACTIVE_SUBMISSION_STATUSES = ["ACCEPTED", "POSTED", "VERIFIED", "THRESHOLD_MET", "SETTLING"] as const;

const submissionLabels: Record<string, string> = {
  ACCEPTED: "Принято",
  POSTED: "Опубликовано",
  VERIFIED: "Проверено",
  THRESHOLD_MET: "Цель достигнута",
  SETTLING: "На расчёте",
  PAID: "Оплачено",
  REJECTED: "Отклонено"
};

const campaignLabels: Record<string, string> = {
  DRAFT: "Черновик",
  ACTIVE: "Активна",
  LOW_BUDGET: "Заканчивается бюджет",
  PAUSED: "Приостановлена",
  COMPLETED: "Завершена"
};

async function loadWorker(userId: string) {
  const [submissions, earnings, payouts, views, activeCount] = await Promise.all([
    prisma.submission.findMany({
      where: { workerId: userId },
      select: {
        id: true,
        currentViews: true,
        status: true,
        campaign: { select: { id: true, title: true, viewThreshold: true } }
      },
      orderBy: { updatedAt: "desc" },
      take: 5
    }),
    prisma.transaction.aggregate({
      where: { userId, type: "EARNING", status: "COMPLETED" },
      _sum: { netCents: true }
    }),
    prisma.transaction.findMany({
      where: { userId, type: { in: ["EARNING", "WITHDRAWAL"] } },
      select: { id: true, type: true, netCents: true, status: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 5
    }),
    prisma.submission.aggregate({
      where: { workerId: userId },
      _sum: { currentViews: true }
    }),
    prisma.submission.count({
      where: { workerId: userId, status: { in: [...ACTIVE_SUBMISSION_STATUSES] } }
    })
  ]);

  return {
    submissions,
    payouts,
    earningsCents: earnings._sum.netCents || 0,
    activeCount,
    views: views._sum.currentViews || 0
  };
}

async function loadClient(userId: string) {
  const campaignWhere = { ownerId: userId };
  const submissionWhere = { campaign: { ownerId: userId } };
  const [campaigns, budgets, views, clipCount, topClips] = await Promise.all([
    prisma.campaign.findMany({
      where: campaignWhere,
      select: {
        id: true,
        title: true,
        status: true,
        totalBudgetCents: true,
        remainingBudgetCents: true,
        _count: { select: { submissions: true } }
      },
      orderBy: { updatedAt: "desc" },
      take: 6
    }),
    prisma.campaign.aggregate({
      where: campaignWhere,
      _count: { id: true },
      _sum: { totalBudgetCents: true, remainingBudgetCents: true }
    }),
    prisma.submission.aggregate({
      where: submissionWhere,
      _sum: { currentViews: true }
    }),
    prisma.submission.count({ where: submissionWhere }),
    prisma.submission.findMany({
      where: submissionWhere,
      select: {
        id: true,
        currentViews: true,
        status: true,
        worker: { select: { handle: true, avatar: true } },
        campaign: { select: { title: true } }
      },
      orderBy: { currentViews: "desc" },
      take: 5
    })
  ]);

  const totalBudget = budgets._sum.totalBudgetCents || 0;
  const remainingBudget = budgets._sum.remainingBudgetCents || 0;
  return {
    campaigns,
    campaignCount: budgets._count.id,
    totalBudget,
    remainingBudget,
    spentBudget: Math.max(0, totalBudget - remainingBudget),
    views: views._sum.currentViews || 0,
    clipCount,
    topClips
  };
}

export default async function ProfilePage() {
  const user = await requireUser();
  const mode = await getActiveRoleMode(user);
  const canSwitchMode = user.role === "BOTH" || user.role === "ADMIN";
  const periodKey = moscowWeekKey();
  const [data, achievementStats, unlocked, weeklyClaims] = await Promise.all([
    mode === "worker" ? loadWorker(user.id) : loadClient(user.id),
    loadAchievementStats(user),
    prisma.userAchievement.findMany({
      where: { userId: user.id },
      select: { claimedAt: true, achievement: { select: { code: true } } }
    }),
    prisma.recurringRewardClaim.findMany({ where: { userId: user.id, periodKey }, select: { code: true } })
  ]);
  const claimedCodes = new Set(unlocked.filter((item) => item.claimedAt).map((item) => item.achievement.code));
  const achievementItems = ACHIEVEMENTS
    .filter((item) => item.role === "any" || item.role === mode)
    .map((item) => ({
      ...item,
      ...achievementProgress(item, achievementStats),
      claimed: claimedCodes.has(item.code)
    }));
  const weeklyClaimed = new Set(weeklyClaims.map((item) => item.code));

  return (
    <AppShell>
      <section className="section profile-screen">
        <header className="profile-overview">
          <div className="profile-person">
            <UserAvatar avatar={user.avatar} name={user.name} handle={user.handle} size={72} />
            <div>
              <h1>{user.name}</h1>
              <p className="muted">@{user.handle}</p>
              <Tag>{mode === "client" ? "Заказчик" : "Исполнитель"}</Tag>
            </div>
          </div>
          <div className="profile-edit-actions">
            <Link href="/settings/profile" aria-label="Редактировать профиль"><SquarePen size={18} /></Link>
            <Link href="/settings/account" aria-label="Настройки аккаунта"><Settings size={18} /></Link>
          </div>
        </header>

        <section className="profile-balances" aria-label="Баланс">
          <Link href="/wallet">
            <WalletCards size={20} />
            <span><small>Рублёвый баланс</small><b>{rub(user.balanceCents)}</b></span>
            <ArrowRight size={17} />
          </Link>
          <div>
            <Coins size={20} />
            <span><small>Бонусы ReelPay</small><ProfileRpBalance initial={user.rpBalance} /></span>
            <em>1 RP = 1 ₽ внутри сервиса</em>
          </div>
        </section>

        {canSwitchMode ? (
          <form className="role-switch" action={switchRoleAction}>
            <button className={mode === "worker" ? "active" : ""} name="mode" value="worker" type="submit">
              <Zap size={18} /> Исполнитель
            </button>
            <button className={mode === "client" ? "active" : ""} name="mode" value="client" type="submit">
              <BriefcaseBusiness size={18} /> Заказчик
            </button>
          </form>
        ) : null}

        <ProfileDisclosure storageKey="rewards" title="Награды и задания" summary="Достижения и RP" defaultOpen={RECURRING_REWARDS.some((reward) => (achievementStats[reward.metric] || 0) >= reward.target && !weeklyClaimed.has(reward.code))}>
        <section className="profile-achievements">
          <div className="section-head compact">
            <div><span className="eyebrow">Награды</span><h2>Достижения</h2></div>
            <span className="profile-rp-hint"><Trophy size={15} /> RP нельзя вывести</span>
          </div>
          <ProfileAchievements items={achievementItems} />
          <div className="weekly-rewards-wrap">
            <div className="section-head compact"><div><h3>Задания недели</h3><p className="muted">До 120 RP, обновление в понедельник по Москве.</p></div></div>
            <WeeklyRewards items={RECURRING_REWARDS.map((reward) => ({
              ...reward,
              value: achievementStats[reward.metric] || 0,
              claimed: weeklyClaimed.has(reward.code)
            }))} />
          </div>
        </section>
        </ProfileDisclosure>

        {mode === "worker" && "earningsCents" in data ? (
          <>
            <div className="actions profile-actions">
              <Link className="btn btn-primary" href="/campaigns">Найти заказ</Link>
              <Link className="btn" href="/wallet">Открыть выплаты</Link>
            </div>

            <section className="profile-metrics" aria-label="Статистика исполнителя">
              <Card><WalletCards color="#22c55e" /><span>Заработано</span><strong>{rub(data.earningsCents)}</strong></Card>
              <Card><BriefcaseBusiness color="#38bdf8" /><span>Активные работы</span><strong>{data.activeCount}</strong></Card>
              <Card><Eye color="#f472b6" /><span>Просмотры</span><strong>{compactNumber(data.views)}</strong></Card>
              <Card><WalletCards color="#c084fc" /><span>Доступно</span><strong>{rub(user.balanceCents)}</strong></Card>
            </section>

            <section className="section-list profile-work-section">
              <div className="section-head compact profile-work-head">
                <div>
                  <span className="eyebrow">Рабочая зона</span>
                  <h2>Текущие работы</h2>
                </div>
                <Link href="/campaigns">Все заказы <ArrowRight size={15} /></Link>
              </div>
              <Card className="profile-work-list">
                {data.submissions.length ? data.submissions.map((submission) => (
                  <Link className="profile-work-row" href={`/campaigns/${submission.campaign.id}`} key={submission.id}>
                    <span className="profile-work-icon"><Film size={19} /></span>
                    <div className="profile-work-main">
                      <strong>{submission.campaign.title}</strong>
                      <div className="profile-work-meta">
                        <span><Eye size={14} /> {compactNumber(submission.currentViews)} просмотров</span>
                        <span>{Math.min(100, Math.round((submission.currentViews / Math.max(submission.campaign.viewThreshold, 1)) * 100))}% цели</span>
                      </div>
                      <span className="profile-work-progress" aria-hidden="true">
                        <i style={{ width: `${Math.min(100, Math.round((submission.currentViews / Math.max(submission.campaign.viewThreshold, 1)) * 100))}%` }} />
                      </span>
                    </div>
                    <span className={`profile-work-status status-${submission.status.toLowerCase()}`}>
                      {submissionLabels[submission.status] || submission.status}
                    </span>
                    <ArrowRight className="profile-work-arrow" size={17} />
                  </Link>
                )) : <p className="muted">Активных работ пока нет.</p>}
              </Card>
            </section>

            <ProfileDisclosure storageKey="worker-history" title="Последние выплаты" summary="История операций">
              <Card className="stack-list">
                {data.payouts.length ? data.payouts.map((payment) => (
                  <div className="pay-row" key={payment.id}>
                    <CheckCircle2 color={payment.status === "COMPLETED" ? "#22c55e" : "#f59e0b"} />
                    <div>
                      <strong>{payment.type === "WITHDRAWAL" ? "Вывод средств" : "Оплата работы"}</strong>
                      <p>{payment.createdAt.toLocaleDateString("ru-RU")}</p>
                    </div>
                    <span>{rub(payment.netCents)}</span>
                  </div>
                )) : <p className="muted">Выплат пока нет.</p>}
              </Card>
            </ProfileDisclosure>
          </>
        ) : null}

        {mode === "client" && "campaignCount" in data ? (
          <>
            <div className="actions profile-actions">
              <Link className="btn btn-primary" href="/campaigns/new"><Plus size={16} /> Создать заказ</Link>
              <Link className="btn" href="/wallet">Управлять бюджетом</Link>
            </div>

            <section className="profile-metrics" aria-label="Статистика заказчика">
              <Card><BriefcaseBusiness color="#38bdf8" /><span>Кампании</span><strong>{data.campaignCount}</strong></Card>
              <Card><WalletCards color="#22c55e" /><span>Бюджет кампаний</span><strong>{rub(data.totalBudget)}</strong></Card>
              <Card><Film color="#c084fc" /><span>Получено роликов</span><strong>{data.clipCount}</strong></Card>
              <Card><Eye color="#f472b6" /><span>Просмотры</span><strong>{compactNumber(data.views)}</strong></Card>
            </section>

            <section className="section-list">
              <div className="section-head compact"><h2>Мои заказы</h2><Link href="/campaigns/new">Создать</Link></div>
              <div className="profile-order-groups">
              <Card className="stack-list"><h3>Активные</h3>
                {data.campaigns.filter((campaign) => ["ACTIVE", "LOW_BUDGET", "PAUSED"].includes(campaign.status)).length ? data.campaigns.filter((campaign) => ["ACTIVE", "LOW_BUDGET", "PAUSED"].includes(campaign.status)).map((campaign) => (
                  <div className="campaign-mini" key={campaign.id}>
                    <strong><Link href={`/campaigns/${campaign.id}`}>{campaign.title}</Link></strong>
                    <span>{campaign._count.submissions} роликов · {rub(campaign.remainingBudgetCents)} осталось</span>
                    <Tag tone={campaign.status === "LOW_BUDGET" ? "warn" : "good"}>
                      {campaignLabels[campaign.status] || campaign.status}
                    </Tag>
                  </div>
                )) : <p className="muted">Активных заказов нет.</p>}
              </Card>
              <Card className="stack-list"><h3>Завершённые</h3>
                {data.campaigns.filter((campaign) => campaign.status === "COMPLETED").length ? data.campaigns.filter((campaign) => campaign.status === "COMPLETED").map((campaign) => (
                  <div className="campaign-mini" key={campaign.id}>
                    <strong><Link href={`/campaigns/${campaign.id}`}>{campaign.title}</Link></strong>
                    <span>{campaign._count.submissions} роликов</span>
                    <Tag>{campaignLabels[campaign.status]}</Tag>
                  </div>
                )) : <p className="muted">Завершённых заказов нет.</p>}
              </Card>
              </div>
            </section>

            <ProfileDisclosure storageKey="client-budget" title="Бюджет" summary={`Осталось ${rub(data.remainingBudget)}`}>
              <div className="grid grid-2">
                <Card><span className="muted">Использовано</span><h2>{rub(data.spentBudget)}</h2></Card>
                <Card><span className="muted">Осталось в кампаниях</span><h2>{rub(data.remainingBudget)}</h2></Card>
              </div>
            </ProfileDisclosure>

            {data.topClips.some((clip) => clip.currentViews > 0) ? <ProfileDisclosure storageKey="client-clips" title="Ролики по моим заказам" summary="Лучшие по просмотрам">
              <Card className="stack-list">
                {data.topClips.filter((clip) => clip.currentViews > 0).map((clip) => (
                  <div className="pay-row" key={clip.id}>
                    <UserAvatar
                      avatar={clip.worker.avatar}
                      name={clip.worker.handle}
                      handle={clip.worker.handle}
                      size={40}
                    />
                    <div><strong>@{clip.worker.handle}</strong><p>{clip.campaign.title} · {submissionLabels[clip.status] || clip.status}</p></div>
                    <span>{compactNumber(clip.currentViews)}</span>
                  </div>
                ))}
              </Card>
            </ProfileDisclosure> : null}
          </>
        ) : null}
      </section>
    </AppShell>
  );
}
