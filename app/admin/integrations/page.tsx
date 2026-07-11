import { AlertTriangle, CheckCircle2, Link2, RefreshCw } from "lucide-react";
import { AdminPageHeader, AdminShell } from "@/components/admin-shell";
import { Card, Tag } from "@/components/ui";
import { adminRecheckIntegrationsAction } from "@/app/admin/actions";
import { prisma } from "@/lib/prisma";
import { socialPlatformConfigured } from "@/lib/social-platforms";
import { socialTokenEncryptionReady } from "@/lib/secret-box";

export const dynamic = "force-dynamic";

export default async function AdminIntegrationsPage() {
  const expiringAt = new Date(Date.now() + 7 * 86400_000);
  const [accounts, expiring, reconnects, pendingChecks, failedEvents, evidence] = await Promise.all([
    prisma.socialAccount.count({ where: { connectionStatus: "CONNECTED" } }),
    prisma.socialCredential.count({ where: { tokenExpiresAt: { lte: expiringAt } } }),
    prisma.socialAccount.count({ where: { connectionStatus: { not: "CONNECTED" } } }),
    prisma.videoCheck.count({ where: { checkType: { in: ["OWNERSHIP", "WATERMARK"] }, status: { in: ["PENDING", "NEEDS_REVIEW"] } } }),
    prisma.analyticsEvent.findMany({ where: { type: "SOCIAL_CONNECT_FAILED" }, orderBy: { createdAt: "desc" }, take: 12 }),
    prisma.submissionOwnershipEvidence.findMany({ orderBy: { createdAt: "desc" }, take: 15, include: { submission: { select: { trackingCode: true } } } })
  ]);
  const platforms = ["YOUTUBE", "TIKTOK", "VK", "INSTAGRAM"] as const;

  return (
    <AdminShell>
      <div className="admin-screen">
        <AdminPageHeader eyebrow="Проверка роликов" title="Площадки и OAuth" description="Состояние read-only подключений без отображения токенов и секретов." action={
          <form action={adminRecheckIntegrationsAction}><button className="btn" type="submit"><RefreshCw size={16} /> Перепроверить</button></form>
        } />
        <div className="admin-grid compact">
          <Card className="admin-metric"><Link2 /><span>Подключено</span><strong>{accounts}</strong><small>рабочих аккаунтов</small></Card>
          <Card className="admin-metric"><AlertTriangle /><span>Истекают</span><strong>{expiring}</strong><small>в ближайшие 7 дней</small></Card>
          <Card className="admin-metric"><AlertTriangle /><span>Повторный вход</span><strong>{reconnects}</strong><small>подключений</small></Card>
          <Card className="admin-metric"><CheckCircle2 /><span>Ручная очередь</span><strong>{pendingChecks}</strong><small>проверок</small></Card>
        </div>
        <div className="admin-two">
          <Card className="admin-panel">
            <div className="section-head compact"><h2>Готовность площадок</h2></div>
            <div className="admin-list">
              {platforms.map((platform) => {
                const configured = (platform === "YOUTUBE" || platform === "TIKTOK") && socialPlatformConfigured(platform);
                return <div className="admin-event" key={platform}>{configured ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}<div><strong>{platform}</strong><span>{platform === "VK" ? "Автопроверка ключом" : platform === "INSTAGRAM" ? "Ключ + модерация до Meta Review" : configured ? "OAuth read-only настроен" : "Нужны ключи приложения"}</span></div><Tag tone={configured || platform === "VK" ? "good" : "warn"}>{configured || platform === "VK" ? "Готово" : "Ожидает"}</Tag></div>;
              })}
              <div className="admin-event"><CheckCircle2 size={16} /><div><strong>Шифрование токенов</strong><span>AES-256-GCM, версия ключа и AAD</span></div><Tag tone={socialTokenEncryptionReady() ? "good" : "warn"}>{socialTokenEncryptionReady() ? "OK" : "Нет ключа"}</Tag></div>
            </div>
          </Card>
          <Card className="admin-panel">
            <div className="section-head compact"><h2>Последние ошибки OAuth</h2></div>
            <div className="admin-list">{failedEvents.length ? failedEvents.map((event) => <div className="admin-event" key={event.id}><AlertTriangle size={16} /><div><strong>{event.provider || "Площадка"}</strong><span>{event.createdAt.toLocaleString("ru-RU")}</span></div></div>) : <p className="muted">Ошибок нет.</p>}</div>
          </Card>
        </div>
        <Card className="admin-panel">
          <div className="section-head compact"><h2>Неизменяемая история доказательств</h2></div>
          <div className="admin-list">{evidence.map((item) => <div className="admin-event" key={item.id}><CheckCircle2 size={16} /><div><strong>{item.submission.trackingCode} · {item.method}</strong><span>{item.source} · {item.createdAt.toLocaleString("ru-RU")}</span></div><Tag tone={item.status === "PASS" || item.status === "PASSED" ? "good" : "warn"}>{item.status}</Tag></div>)}</div>
        </Card>
      </div>
    </AdminShell>
  );
}
