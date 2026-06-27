import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell, Card } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { expectedPayout, rub } from "@/lib/money";
import { getActiveRoleMode } from "@/lib/role-mode";
import { UploadForm } from "./upload-form";

function parseRules(value: string) {
  try {
    return JSON.parse(value) as { watermarkBonus?: boolean; requiredTags?: string[] };
  } catch {
    return {};
  }
}

export default async function UploadPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const user = await requireUser();
  if (await getActiveRoleMode(user) !== "worker") redirect("/campaigns");
  const submissions = await prisma.submission.findMany({
    where: { workerId: user.id },
    include: { campaign: true },
    orderBy: { updatedAt: "desc" },
    take: 20
  });

  const orders = submissions.map((submission) => {
    const rules = parseRules(submission.campaign.rulesJson);
    return {
      id: submission.id,
      title: submission.campaign.title,
      trackingCode: submission.trackingCode,
      payout: rub(expectedPayout(submission.campaign.viewThreshold, submission.campaign.cpmRateCents)),
      watermarkRequired: Boolean(rules.watermarkBonus),
      requiredTags: rules.requiredTags || []
    };
  });

  return (
    <AppShell>
      <section className="section upload-screen">
        <div className="screen-title">
          <h1>Выложить работу</h1>
          <p className="lead">Вставь ссылку на опубликованный ролик — мы начнём считать просмотры. Оплата после проверки.</p>
        </div>

        {params.sent ? (
          <Card className="upload-status ok">
            <strong>Работа отправлена</strong>
            <span>Ссылка принята. Теперь она попала в трекинг просмотров и базовую проверку.</span>
          </Card>
        ) : null}

        {params.verified ? (
          <Card className="upload-status ok">
            <strong>Владение подтверждено ✓</strong>
            <span>Мы нашли твой трекинг-код в описании ролика — публикация привязана к заказу. Просмотры считаются, выплата начнётся при достижении порога.</span>
          </Card>
        ) : null}

        {params.nocode ? (
          <Card className="upload-status warn">
            <strong>Не нашли трекинг-код в описании</strong>
            <span>Ролик принят, но без кода из заказа в описании выплата не начисляется — так мы убеждаемся, что клип твой. Добавь код в описание и пересдай ссылку: проверка пройдёт автоматически.</span>
          </Card>
        ) : null}

        {params.flagged ? (
          <Card className="upload-status warn">
            <strong>Нужна ручная проверка</strong>
            <span>Ссылка выглядит рискованно: возможен дубль, неверная платформа или подозрительная активность. Мы сохранили работу, но выплату проверит администратор.</span>
          </Card>
        ) : null}

        {orders.length ? (
          <UploadForm orders={orders} />
        ) : (
          <Card className="empty-box">
            <h2>Пока нет взятых заказов</h2>
            <p className="muted">Сначала открой заказы, выбери подходящий и нажми «Откликнуться» — он появится здесь для сдачи.</p>
            <Link className="btn btn-primary" href="/campaigns">Открыть заказы</Link>
          </Card>
        )}
      </section>
    </AppShell>
  );
}
