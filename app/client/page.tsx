import Link from "next/link";
import { AppShell, Card, Stat, Tag } from "@/components/ui";
import { depositAction, syncViewsAction } from "@/app/actions";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { compactNumber, rub } from "@/lib/money";

export default async function ClientPage() {
  const user = await requireUser();
  const campaigns = await prisma.campaign.findMany({
    where: user.role === "ADMIN" ? {} : { ownerId: user.id },
    include: { submissions: { include: { worker: true } } },
    orderBy: { createdAt: "desc" }
  });
  const totalViews = campaigns.reduce((sum, campaign) => sum + campaign.submissions.reduce((inner, sub) => inner + sub.currentViews, 0), 0);
  const remaining = campaigns.reduce((sum, campaign) => sum + campaign.remainingBudgetCents, 0);
  const allClips = campaigns.flatMap((campaign) => campaign.submissions.map((submission) => ({ ...submission, campaignTitle: campaign.title }))).sort((a, b) => b.currentViews - a.currentViews);

  return (
    <AppShell>
      <section className="section profile-hero-new">
        <div className="profile-avatar">{user.name.slice(0, 2).toUpperCase()}</div>
        <div>
          <span className="eyebrow">Кабинет заказчика</span>
          <h1>{user.name}: заказы, клипы и бюджет.</h1>
          <p className="lead">Создавай задания, смотри готовые клипы и плати только за просмотры, которые реально появились.</p>
          <div className="actions">
            <Link className="btn btn-primary" href="/campaigns/new">Создать заказ</Link>
            <Link className="btn" href="/feed">Смотреть клипы</Link>
            <form action={syncViewsAction}><button className="btn" type="submit">Обновить просмотры</button></form>
          </div>
        </div>
      </section>
      <section className="section grid grid-5">
        <Stat value={campaigns.length} label="моих заказов" />
        <Stat value={compactNumber(totalViews)} label="просмотров" />
        <Stat value={rub(remaining)} label="бюджет остался" />
        <Stat value={rub(user.balanceCents)} label="на балансе" tone="good" />
        <Stat value={allClips.length} label="клипов сделали" />
      </section>
      <section className="section grid grid-2">
        <Card>
          <h2>Мои заказы</h2>
          {campaigns.map((campaign) => (
            <div className="row" key={campaign.id}>
              <div>
                <strong><Link href={`/campaigns/${campaign.id}`}>{campaign.title}</Link></strong>
                <p className="small">{campaign.submissions.length} клипов · {rub(campaign.cpmRateCents)} / 1000 просмотров</p>
              </div>
              <Tag tone={campaign.status === "LOW_BUDGET" ? "warn" : "good"}>{campaign.status}</Tag>
            </div>
          ))}
        </Card>
        <Card>
          <h2>Клипы, которые уже сделали</h2>
          {allClips.slice(0, 6).map((submission) => (
            <div className="row" key={submission.id}>
              <div>
                <strong>@{submission.worker.handle}</strong>
                <p className="small">{submission.campaignTitle} · {compactNumber(submission.currentViews)} просмотров</p>
              </div>
              <Tag tone={submission.fraudScore > 70 ? "warn" : "good"}>{submission.fraudScore}/100</Tag>
            </div>
          ))}
        </Card>
      </section>
      <section className="section grid grid-2">
        <Card>
          <h2>Пополнить бюджет</h2>
          <form className="form" action={depositAction}>
            <input type="hidden" name="provider" value="yookassa" />
            <label className="field">Сумма, ₽<input name="amount" type="number" defaultValue="50000" /></label>
            <button className="btn btn-primary" type="submit">Пополнить demo-баланс</button>
          </form>
        </Card>
        <Card>
          <Tag tone="soft">Подсказка</Tag>
          <h2>Как давать обратную связь</h2>
          <p className="muted">Открой готовый клип, посмотри стиль, затем уточни в описании заказа: больше мемов, короче начало, крупнее субтитры или другой темп.</p>
        </Card>
      </section>
    </AppShell>
  );
}
