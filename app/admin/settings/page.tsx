import Link from "next/link";
import { CheckCircle2, Database, KeyRound, Settings, WalletCards, XCircle } from "lucide-react";
import { AdminPageHeader, AdminShell } from "@/components/admin-shell";
import { Card, Tag } from "@/components/ui";
import { prisma } from "@/lib/prisma";
import { callbackUri, isConfigured, type ProviderId } from "@/lib/oauth";
import { paymentProviderStatuses, stripeWebhookReady } from "@/lib/payment-readiness";
import { emailDeliveryReady } from "@/lib/email-verification";
import { socialCallbackUri, socialPlatformConfigured } from "@/lib/social-platforms";
import { socialTokenEncryptionReady } from "@/lib/secret-box";
import styles from "./settings.module.css";

export const dynamic = "force-dynamic";

const providers: Array<{ id: ProviderId; label: string }> = [
  { id: "google", label: "Google" },
  { id: "vk", label: "VK ID" },
  { id: "yandex", label: "Yandex" }
];

function envOk(name: string) {
  return Boolean(process.env[name]);
}

function StatusRow({ label, ok, detail }: { label: string; ok: boolean; detail: string }) {
  return (
    <div className="admin-event">
      {ok ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
      <div>
        <strong>{label}</strong>
        <span>{detail}</span>
      </div>
      <Tag tone={ok ? "good" : "warn"}>{ok ? "OK" : "Нет"}</Tag>
    </div>
  );
}

export default async function AdminSettingsPage() {
  const paymentProviders = paymentProviderStatuses();
  const [users, campaigns, events] = await Promise.all([
    prisma.user.count(),
    prisma.campaign.count(),
    prisma.analyticsEvent.count()
  ]);

  const requestUrl = `${process.env.OAUTH_REDIRECT_BASE || "https://clippers-hub.vercel.app"}/admin/settings`;

  return (
    <AdminShell>
      <div className={`admin-screen ${styles.page}`}>
        <AdminPageHeader
          eyebrow="Настройки"
          title="Интеграции и готовность"
          description="Без раскрытия секретов: видно, что подключено, чего не хватает, и какие redirect URI нужны для соц-входа."
          action={<Link className="btn" href="/legal/cookies">Данные и cookie</Link>}
        />

        <div className="admin-grid compact">
          <Card className="admin-metric"><Database /><span>Пользователи</span><strong>{users}</strong><small>Neon/Prisma работает</small></Card>
          <Card className="admin-metric"><Database /><span>Кампании</span><strong>{campaigns}</strong><small>данные читаются</small></Card>
          <Card className="admin-metric"><Settings /><span>События</span><strong>{events}</strong><small>аналитика включена</small></Card>
          <Card className="admin-metric"><KeyRound /><span>OAuth</span><strong>{providers.filter((p) => isConfigured(p.id)).length}/3</strong><small>провайдеров настроено</small></Card>
        </div>

        <div className="admin-two">
          <Card className="admin-panel">
            <div className="section-head compact"><h2>Социальный вход</h2></div>
            <div className="admin-list">
              {providers.map((provider) => (
                <div className="admin-event" key={provider.id}>
                  {isConfigured(provider.id) ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                  <div>
                    <strong>{provider.label}</strong>
                    <span>{callbackUri(requestUrl, provider.id)}</span>
                  </div>
                  <Tag tone={isConfigured(provider.id) ? "good" : "warn"}>{isConfigured(provider.id) ? "Работает" : "Ключи"}</Tag>
                </div>
              ))}
            </div>
          </Card>

          <Card className="admin-panel">
            <div className="section-head compact"><h2>Системные переменные</h2></div>
            <div className="admin-list">
              <StatusRow label="DATABASE_URL" ok={envOk("DATABASE_URL")} detail="Подключение к базе данных" />
              <StatusRow label="DIRECT_URL" ok={envOk("DIRECT_URL")} detail="Прямое подключение для миграций" />
              <StatusRow label="SESSION_SECRET" ok={envOk("SESSION_SECRET")} detail="Подпись сессий пользователей" />
              <StatusRow label="ADMIN_EMAILS" ok={envOk("ADMIN_EMAILS")} detail="Email владельцев админки" />
              <StatusRow label="ANALYTICS_SALT" ok={envOk("ANALYTICS_SALT")} detail="Хеширование IP/User-Agent" />
              <StatusRow label="Email-подтверждение" ok={emailDeliveryReady()} detail="RESEND_API_KEY и EMAIL_FROM для одноразовых ссылок" />
            </div>
          </Card>
        </div>

        <div className="admin-two">
          <Card className="admin-panel">
            <div className="section-head compact"><h2>Платежи</h2></div>
            <div className="admin-list">
              {paymentProviders.map((provider) => (
                <StatusRow
                  key={provider.id}
                  label={provider.label}
                  ok={provider.live}
                  detail={provider.live ? "Боевой режим подключён." : `Не настроено: ${provider.missing.join(", ")}.`}
                />
              ))}
              <StatusRow label="Stripe Webhook" ok={stripeWebhookReady()} detail="Подтверждение платежных событий." />
            </div>
          </Card>

          <Card className="admin-panel">
            <div className="section-head compact"><h2>Просмотры и соцплатформы</h2></div>
            <div className="admin-list">
              <StatusRow label="YouTube Data API" ok={envOk("YOUTUBE_DATA_API_KEY")} detail="Реальная синхронизация Shorts/YouTube." />
              <StatusRow label="VK Service Token" ok={envOk("VK_SERVICE_TOKEN")} detail="Синхронизация VK Clips." />
              <StatusRow label="Шифрование токенов" ok={socialTokenEncryptionReady()} detail="SOCIAL_TOKEN_ENCRYPTION_KEY, минимум 32 случайных символа." />
              <StatusRow
                label="TikTok OAuth"
                ok={socialPlatformConfigured("TIKTOK")}
                detail={`Автопроверка роликов и просмотров. Callback: ${socialCallbackUri(requestUrl, "TIKTOK")}`}
              />
              <StatusRow
                label="Instagram OAuth"
                ok={false}
                detail={`Ожидает проверку приложения Meta. Callback: ${socialCallbackUri(requestUrl, "INSTAGRAM")}`}
              />
            </div>
          </Card>
        </div>

        <Card className="admin-panel">
          <div className="section-head compact"><h2>Что подключать дальше</h2></div>
          <div className="admin-quick-grid">
            <Link href="/admin/security"><b>Антифрод v2</b><span>Отдельные статусы блокировки и ручной review queue</span></Link>
            <Link href="/admin/content"><b>Модерация работ</b><span>Approve/reject, комментарии, история решений</span></Link>
            <Link href="/wallet"><b>Платежи</b><span>Подключение ЮKassa/Stripe и webhook-подтверждений</span></Link>
            <Link href="/admin/users"><b>Роли</b><span>Выдача ролей, заморозка аккаунта, KYC-флаги</span></Link>
          </div>
        </Card>
      </div>
    </AdminShell>
  );
}
