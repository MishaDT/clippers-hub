import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowUpRight, BadgeCheck, Clock3, Eye, ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/ui";
import { ClipReport } from "@/components/clip-report";
import { compactNumber } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import styles from "./report.module.css";

export const metadata: Metadata = {
  title: "Отчёт по клипу — ReelPay",
  robots: { index: false, follow: false }
};

const statusLabels: Record<string, string> = {
  ACCEPTED: "Заказ взят",
  POSTED: "Опубликован",
  VERIFIED: "Идёт трекинг",
  THRESHOLD_MET: "Цель достигнута",
  SETTLING: "Проверка выплаты",
  PAID: "Оплачено",
  REJECTED: "Отклонён"
};

function fmt(date: Date | null) {
  return date ? date.toLocaleDateString("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";
}

export default async function ClipReportPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const submission = await prisma.submission.findFirst({
    where: { shareToken: token, shareTokenRevokedAt: null, shareTokenExpiresAt: { gt: new Date() } },
    select: {
      status: true,
      fraudScore: true,
      currentViews: true,
      platform: true,
      postUrl: true,
      viewVelocityJson: true,
      createdAt: true,
      verifiedAt: true,
      paidAt: true,
      lastSyncedAt: true,
      shareTokenExpiresAt: true,
      campaign: { select: { title: true, viewThreshold: true } },
      videoChecks: { select: { checkType: true, status: true } },
      disputes: { where: { status: "OPEN" }, select: { id: true } }
    }
  });
  if (!submission) notFound();

  const timeline = [
    { label: "Заказ взят", at: submission.createdAt },
    { label: "Проверка просмотров", at: submission.verifiedAt },
    { label: "Выплата", at: submission.paidAt }
  ];

  return (
    <AppShell>
      <main className={styles.page}>
        <header className={styles.hero}>
          <span className="eyebrow"><ShieldCheck size={14} /> Публичный отчёт</span>
          <h1>{submission.campaign.title}</h1>
          <div className={styles.meta}>
            <span><Eye size={14} /> {compactNumber(submission.currentViews)} просмотров</span>
            <span><BadgeCheck size={14} /> {statusLabels[submission.status] || submission.status}</span>
            <span>цель {compactNumber(submission.campaign.viewThreshold)}</span>
          </div>
          {/^https:\/\//i.test(submission.postUrl) ? (
            <a className={styles.post} href={submission.postUrl} target="_blank" rel="noreferrer">
              Открыть публикацию <ArrowUpRight size={14} />
            </a>
          ) : null}
        </header>

        <ClipReport
          input={{
            status: submission.status,
            fraudScore: submission.fraudScore,
            currentViews: submission.currentViews,
            viewThreshold: submission.campaign.viewThreshold,
            platform: submission.platform,
            videoChecks: submission.videoChecks,
            disputeOpen: submission.disputes.length > 0
          }}
          velocity={submission.viewVelocityJson}
        />

        <section className={styles.timeline}>
          <h2><Clock3 size={16} /> Хронология сделки</h2>
          <ol>
            {timeline.map((step) => (
              <li key={step.label} data-done={Boolean(step.at)}>
                <b>{step.label}</b>
                <span>{fmt(step.at)}</span>
              </li>
            ))}
          </ol>
        </section>

        <p className={styles.note}>
          Источник статистики: {submission.platform === "YOUTUBE" || submission.platform === "VK" ? "официальный API площадки" : "подключённый аккаунт или ручная проверка ReelPay"}.
          Обновлено {fmt(submission.lastSyncedAt)}. Ссылка действует до {fmt(submission.shareTokenExpiresAt)}.
        </p>
      </main>
    </AppShell>
  );
}
