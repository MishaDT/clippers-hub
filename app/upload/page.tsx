import Link from "next/link";
import { redirect } from "next/navigation";
import { Send } from "lucide-react";
import { AppShell, Card } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { compactNumber, expectedPayout, minimumGuaranteedPayout, rub } from "@/lib/money";
import { getActiveRoleMode } from "@/lib/role-mode";
import { UploadForm } from "./upload-form";

const PLATFORM_LABEL: Record<string, string> = { TIKTOK: "TikTok", YOUTUBE: "YouTube", INSTAGRAM: "Instagram", VK: "VK", TWITCH: "Twitch" };

function parseRules(value: string) {
  try {
    return JSON.parse(value) as { watermarkBonus?: boolean; requiredTags?: string[] };
  } catch {
    return {};
  }
}

function parsePlatforms(value: string) {
  try {
    const list = JSON.parse(value) as string[];
    return Array.isArray(list) ? list.map((p) => PLATFORM_LABEL[p] || p) : [];
  } catch {
    return [];
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
      payout: rub(expectedPayout(submission.campaign.viewThreshold, submission.campaign.cpmRateCents, user.rank)),
      guarantee: submission.campaign.minimumGuaranteeCents > 0
        ? rub(minimumGuaranteedPayout(submission.campaign.minimumGuaranteeCents, user.rank))
        : null,
      target: compactNumber(submission.campaign.viewThreshold),
      daysLeft: Math.max(1, Math.ceil((submission.campaign.deadline.getTime() - Date.now()) / 86400000)),
      platforms: parsePlatforms(submission.campaign.allowedPlatformsJson),
      watermarkRequired: Boolean(rules.watermarkBonus),
      requiredTags: rules.requiredTags || [],
      draftRequired: submission.campaign.draftRequired,
      draftStatus: submission.draftStatus,
      draftRevision: submission.draftRevision,
      maxRevisionRounds: submission.campaign.maxRevisionRounds,
      reviewMode: submission.campaign.reviewMode,
      draftReviewNote: submission.draftReviewNote,
      draftUrl: submission.draftUrl
    };
  });

  return (
    <AppShell>
      <section className="section up-screen">
        <div className="up-head">
          <span className="up-eyebrow"><Send size={15} /> Сдача работы</span>
          <h1>Выложить работу</h1>
          <p>Опубликуй ролик с кодом заказа в описании и вставь ссылку — мы подтвердим, что клип твой, начнём считать просмотры и начислим выплату после проверки. Проверка черновиков и публикаций обычно занимает до 24 часов.</p>
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

        {params.draft === "approved" ? (
          <Card className="upload-status ok">
            <strong>Черновик принят</strong>
            <span>Теперь можно публиковать ролик и отправлять ссылку на проверку просмотров.</span>
          </Card>
        ) : null}
        {params.draft === "pending" ? (
          <Card className="upload-status warn">
            <strong>Черновик отправлен</strong>
            <span>Дождитесь решения в уведомлениях или чате. До принятия публиковать ролик не нужно.</span>
          </Card>
        ) : null}
        {params.draft && !["approved", "pending"].includes(String(params.draft)) ? (
          <Card className="upload-status warn">
            <strong>Не удалось изменить черновик</strong>
            <span>Проверьте HTTPS-ссылку, текущий статус и доступное число правок.</span>
          </Card>
        ) : null}

        {orders.length ? (
          <UploadForm orders={orders} blobEnabled={Boolean(process.env.BLOB_READ_WRITE_TOKEN)} />
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
