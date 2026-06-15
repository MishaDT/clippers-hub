import Link from "next/link";
import { AppShell, Card } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { UploadForm } from "./upload-form";

export default async function UploadPage() {
  const user = await requireUser();
  const submissions = await prisma.submission.findMany({
    where: { workerId: user.id },
    include: { campaign: true },
    orderBy: { updatedAt: "desc" },
    take: 20
  });

  return (
    <AppShell>
      <section className="section upload-work">
        <div className="screen-title">
          <span className="eyebrow">ReelPay</span>
          <h1>Выложить работу</h1>
          <p className="lead">Загрузите ролик, вставьте публичную ссылку и отправьте работу на проверку. После проверки начнется трекинг просмотров.</p>
        </div>

        {submissions.length ? (
          <UploadForm submissions={submissions.map((submission) => ({
            id: submission.id,
            title: submission.campaign.title,
            trackingCode: submission.trackingCode,
            currentViews: submission.currentViews
          }))} />
        ) : (
          <Card className="empty-box">
            <h2>У тебя пока нет взятых заказов</h2>
            <p>Сначала открой список заказов, выбери подходящий и нажми “Откликнуться”.</p>
            <Link className="btn btn-primary" href="/campaigns">Открыть заказы</Link>
          </Card>
        )}
      </section>
    </AppShell>
  );
}
