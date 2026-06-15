import Link from "next/link";
import { AppShell, Card, Stat, Tag } from "@/components/ui";
import { syncViewsAction, withdrawAction } from "@/app/actions";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { compactNumber, commissionRate, rub } from "@/lib/money";

export default async function ClipperPage() {
  const user = await requireUser();
  const submissions = await prisma.submission.findMany({
    where: { workerId: user.id },
    include: { campaign: true },
    orderBy: { updatedAt: "desc" }
  });
  const lifetimeViews = submissions.reduce((sum, submission) => sum + submission.currentViews, user.lifetimeViews);
  const active = submissions.filter((item) => ["ACCEPTED", "POSTED", "VERIFIED", "THRESHOLD_MET", "SETTLING"].includes(item.status));

  return (
    <AppShell>
      <section className="section profile-hero-new">
        <div className="profile-avatar">{user.name.slice(0, 2).toUpperCase()}</div>
        <div>
          <span className="eyebrow">Кабинет клиппера</span>
          <h1>{user.name} зарабатывает на коротких видео.</h1>
          <p className="lead">Бери заказы, делай клипы, вставляй ссылку и следи, как просмотры превращаются в выплаты.</p>
          <div className="actions">
            <Link className="btn btn-primary" href="/campaigns">Найти заказ</Link>
            <Link className="btn" href="/upload">Выложить клип</Link>
            <form action={syncViewsAction}><button className="btn" type="submit">Обновить просмотры</button></form>
          </div>
        </div>
      </section>
      <section className="section grid grid-5">
        <Stat value={compactNumber(lifetimeViews)} label="всего просмотров" />
        <Stat value={rub(user.balanceCents)} label="можно вывести" tone="good" />
        <Stat value={rub(user.holdBalanceCents)} label="ждет проверки" />
        <Stat value={active.length} label="активных заказов" />
        <Stat value={`${Math.round(commissionRate(user.rank) * 100)}%`} label="комиссия ранга" />
      </section>
      <section className="section grid grid-2">
        <Card>
          <h2>Что сейчас в работе</h2>
          {submissions.map((submission) => (
            <div className="row" key={submission.id}>
              <div>
                <strong>{submission.campaign.title}</strong>
                <p className="small">{submission.trackingCode} · {submission.platform} · {compactNumber(submission.currentViews)} просмотров</p>
              </div>
              <Tag tone={submission.status === "REJECTED" ? "warn" : "good"}>{submission.status}</Tag>
            </div>
          ))}
        </Card>
        <Card>
          <h2>Вывод денег</h2>
          <p className="muted">Когда клипы проходят проверку, деньги появляются на балансе. Сейчас можно создать заявку на вывод.</p>
          <form className="form" action={withdrawAction}>
            <label className="field">Сумма, ₽<input name="amount" type="number" defaultValue="5000" /></label>
            <button className="btn btn-primary" type="submit">Вывести деньги</button>
          </form>
        </Card>
      </section>
    </AppShell>
  );
}
