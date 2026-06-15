import { notFound } from "next/navigation";
import Link from "next/link";
import { Clock, Target, WalletCards } from "lucide-react";
import { AppShell, Card, Tag } from "@/components/ui";
import { joinCampaignAction } from "@/app/actions";
import { prisma } from "@/lib/prisma";
import { compactNumber, rub } from "@/lib/money";
import { CampaignTabs } from "./campaign-tabs";

export default async function CampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const campaign = await prisma.campaign.findUnique({
    where: { id },
    include: { owner: true, submissions: { include: { worker: true }, orderBy: { currentViews: "desc" } } }
  });
  if (!campaign) notFound();

  const expected = Math.round((campaign.viewThreshold / 1000) * campaign.cpmRateCents * 0.89);
  const totalViews = campaign.submissions.reduce((sum, item) => sum + item.currentViews, 0);

  return (
    <AppShell>
      <section className="section order-detail">
        <div className="detail-cover" style={{ backgroundImage: "linear-gradient(180deg, rgba(0,0,0,.04), rgba(0,0,0,.55)), url(/assets/gaming-order.png)" }}>
          <button className="play-button" type="button">▶</button>
          <span>{compactNumber(totalViews)} просмотров</span>
        </div>

        <h1 className="detail-title">{campaign.title}</h1>

        <div className="creator-row">
          <div className="creator-avatar">{campaign.owner.name.slice(0, 2).toUpperCase()}</div>
          <div>
            <h2>{campaign.owner.name}</h2>
            <p className="muted">Заказ #{campaign.trackingPrefix}</p>
          </div>
          <Card className="detail-pay">
            <strong>до {rub(expected)}</strong>
            <span>за выполнение</span>
          </Card>
        </div>

        <section className="detail-stats">
          <Card><Target /><span>Цель</span><strong>{compactNumber(campaign.viewThreshold)}</strong><small>просмотров</small></Card>
          <Card><Clock /><span>Дедлайн</span><strong>{campaign.deadline.toLocaleDateString("ru-RU")}</strong><small>до 23:59</small></Card>
          <Card><WalletCards /><span>Оплата</span><strong>{rub(campaign.cpmRateCents)}</strong><small>за 1000</small></Card>
        </section>

        <Card className="detail-tabs">
          <CampaignTabs
            description={campaign.description}
            platformsJson={campaign.allowedPlatformsJson}
            rulesJson={campaign.rulesJson}
            sourcePlatform={campaign.sourcePlatform}
            sourceUrl={campaign.sourceUrl}
          />
        </Card>

        <div className="sticky-cta">
          <div><Tag tone="good">Оплата после проверки</Tag><p>Отклик не обязывает выполнять заказ, пока ты не загрузишь работу.</p></div>
          <form action={joinCampaignAction}>
            <input type="hidden" name="campaignId" value={campaign.id} />
            <button className="btn btn-primary" type="submit">Откликнуться</button>
          </form>
        </div>

        <section className="section">
          <div className="section-head compact">
            <h2>Уже делают</h2>
            <Link href="/feed">Смотреть ленту</Link>
          </div>
          <div className="reel-grid">
            {campaign.submissions.slice(0, 3).map((submission, index) => (
              <article className="reel-card" key={submission.id} style={{ backgroundImage: `linear-gradient(180deg, rgba(0,0,0,.05), rgba(0,0,0,.82)), url(${index % 2 === 0 ? "/assets/gaming-order.png" : "/assets/podcast-order.png"})` }}>
                <div className="reel-badge">{submission.platform}</div>
                <div className="reel-info">
                  <strong>@{submission.worker.handle}</strong>
                  <p>{compactNumber(submission.currentViews)} просмотров</p>
                </div>
              </article>
            ))}
          </div>
        </section>
      </section>
    </AppShell>
  );
}
