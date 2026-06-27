import Link from "next/link";
import {
  BriefcaseBusiness,
  CheckCircle2,
  Eye,
  Film,
  Plus,
  Settings,
  WalletCards,
  Zap
} from "lucide-react";
import { switchRoleAction } from "@/app/actions";
import { AppShell, Card, Tag } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { compactNumber, rub } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { getActiveRoleMode } from "@/lib/role-mode";

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
        campaign: { select: { title: true, viewThreshold: true } }
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
  const data = mode === "worker" ? await loadWorker(user.id) : await loadClient(user.id);

  return (
    <AppShell>
      <section className="section profile-screen">
        <div className="profile-main">
          <div className="profile-person">
            <img
              className="pf-avatar"
              src={user.avatar || `https://api.dicebear.com/9.x/thumbs/svg?seed=${encodeURIComponent(user.handle)}`}
              alt=""
            />
            <div>
              <h1>{user.name}</h1>
              <p className="muted">@{user.handle}</p>
              <Tag>{mode === "client" ? "Заказчик" : "Исполнитель"}</Tag>
            </div>
          </div>
          <Link className="btn btn-ghost" href="/settings/account">
            <Settings size={17} /> Настройки
          </Link>
        </div>

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

            <section className="section-list">
              <div className="section-head compact"><h2>Текущие работы</h2><Link href="/campaigns">Все заказы</Link></div>
              <Card className="stack-list">
                {data.submissions.length ? data.submissions.map((submission) => (
                  <div className="progress-row" key={submission.id}>
                    <div>
                      <strong>{submission.campaign.title}</strong>
                      <p>{compactNumber(submission.currentViews)} просмотров</p>
                      <i style={{ width: `${Math.min(100, Math.round((submission.currentViews / Math.max(submission.campaign.viewThreshold, 1)) * 100))}%` }} />
                    </div>
                    <span>{submissionLabels[submission.status] || submission.status}</span>
                  </div>
                )) : <p className="muted">Активных работ пока нет.</p>}
              </Card>
            </section>

            <section className="section-list">
              <div className="section-head compact"><h2>Последние выплаты</h2><Link href="/wallet">Вся история</Link></div>
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
            </section>
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
              <div className="section-head compact"><h2>Кампании</h2><Link href="/campaigns/new">Создать</Link></div>
              <Card className="stack-list">
                {data.campaigns.length ? data.campaigns.map((campaign) => (
                  <div className="campaign-mini" key={campaign.id}>
                    <strong><Link href={`/campaigns/${campaign.id}`}>{campaign.title}</Link></strong>
                    <span>{campaign._count.submissions} роликов · {rub(campaign.remainingBudgetCents)} осталось</span>
                    <Tag tone={campaign.status === "LOW_BUDGET" ? "warn" : "good"}>
                      {campaignLabels[campaign.status] || campaign.status}
                    </Tag>
                  </div>
                )) : <p className="muted">Кампаний пока нет.</p>}
              </Card>
            </section>

            <section className="section-list">
              <div className="section-head compact"><h2>Бюджет</h2><Link href="/wallet">Подробнее</Link></div>
              <div className="grid grid-2">
                <Card><span className="muted">Использовано</span><h2>{rub(data.spentBudget)}</h2></Card>
                <Card><span className="muted">Осталось в кампаниях</span><h2>{rub(data.remainingBudget)}</h2></Card>
              </div>
            </section>

            <section className="section-list">
              <div className="section-head compact"><h2>Лучшие ролики</h2></div>
              <Card className="stack-list">
                {data.topClips.length ? data.topClips.map((clip) => (
                  <div className="pay-row" key={clip.id}>
                    <img
                      className="pf-ava"
                      src={clip.worker.avatar || `https://api.dicebear.com/9.x/thumbs/svg?seed=${encodeURIComponent(clip.worker.handle)}`}
                      alt=""
                    />
                    <div><strong>@{clip.worker.handle}</strong><p>{clip.campaign.title}</p></div>
                    <span>{compactNumber(clip.currentViews)}</span>
                  </div>
                )) : <p className="muted">Ролики появятся после первых публикаций.</p>}
              </Card>
            </section>
          </>
        ) : null}
      </section>
    </AppShell>
  );
}
