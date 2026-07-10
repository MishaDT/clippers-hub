import Link from "next/link";
import { ArrowLeft, Landmark, Link2, Mail, ShieldCheck, Trash2, Video } from "lucide-react";
import { deleteAccountAction } from "@/app/actions";
import { AppShell, Card } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { isConfigured, type ProviderId } from "@/lib/oauth";
import { prisma } from "@/lib/prisma";
import { socialPlatformConfigured } from "@/lib/social-platforms";
import { unlinkAccountProviderAction, unlinkSocialPlatformAction, updatePayoutDetailsAction } from "./actions";
import { AvatarUpload } from "./avatar-upload";
import styles from "./settings.module.css";

const providers: Array<{ id: ProviderId; label: string }> = [
  { id: "google", label: "Google" },
  { id: "vk", label: "VK ID" },
  { id: "yandex", label: "Яндекс" }
];

export default async function AccountSettingsPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const accounts = await prisma.oAuthAccount.findMany({
    where: { userId: user.id },
    select: { id: true, provider: true, createdAt: true },
    orderBy: { createdAt: "desc" }
  });
  const socialAccounts = await prisma.socialAccount.findMany({
    where: {
      userId: user.id,
      platform: { in: ["TIKTOK", "INSTAGRAM"] },
      accessToken: { not: null }
    },
    select: {
      id: true,
      platform: true,
      handle: true,
      verifiedAt: true,
      tokenExpiresAt: true,
      scopesJson: true
    },
    orderBy: { updatedAt: "desc" }
  });

  return (
    <AppShell>
      <section className={`section ${styles.page}`}>
        <div className={styles.heading}>
          <Link className="btn btn-ghost" href="/profile"><ArrowLeft size={17} /> Профиль</Link>
          <div>
            <span className="eyebrow">Настройки</span>
            <h1>Аккаунт и безопасность</h1>
            <p className="lead">Вход, привязанные аккаунты и управление данными.</p>
          </div>
        </div>

        {params.avatar === "updated" ? <p className={styles.success}>Логотип профиля обновлён.</p> : null}
        {params.avatar === "removed" ? <p className={styles.success}>Логотип удалён. Используются инициалы.</p> : null}
        {params.avatar === "invalid" ? <p className={styles.error}>Файл не прошёл проверку. Выберите обычный JPG, PNG или WebP до 2 МБ.</p> : null}
        {params.social === "connected" ? <p className={styles.success}>TikTok подключён. ReelPay сможет проверять ваши ролики и просмотры.</p> : null}
        {params.social === "disconnected" ? <p className={styles.success}>Соцсеть отключена, сохранённые токены удалены.</p> : null}
        {params.social && !["connected", "disconnected"].includes(String(params.social)) ? (
          <p className={styles.error}>Подключение не завершено. Проверьте доступ приложения и попробуйте ещё раз.</p>
        ) : null}
        {params.payout === "saved" ? <p className={styles.success}>Реквизиты для выплат сохранены.</p> : null}
        {params.payout === "invalid" ? <p className={styles.error}>Проверьте ФИО, ИНН, счёт, БИК, телефон и подтверждение статуса самозанятого.</p> : null}
        {params.payout === "required" ? <p className={styles.error}>Перед выводом заполните и подтвердите реквизиты.</p> : null}

        <Card className={styles.card}>
          <AvatarUpload avatar={user.avatar} name={user.name} handle={user.handle} />
        </Card>

        <div id="payout-details">
        <Card className={styles.card}>
          <div className={styles.cardTitle}>
            <Landmark size={20} />
            <div>
              <h2>Реквизиты для выплат</h2>
              <p>Нужны для безопасного вывода и подтверждающих документов.</p>
            </div>
          </div>
          <form className={styles.payoutForm} action={updatePayoutDetailsAction}>
            <label className="field">ФИО полностью<input name="payoutFullName" defaultValue={user.payoutFullName || ""} autoComplete="name" required /></label>
            <div className={styles.payoutGrid}>
              <label className="field">ИНН самозанятого<input name="payoutInn" inputMode="numeric" defaultValue={user.payoutInn || ""} minLength={12} maxLength={12} required /></label>
              <label className="field">Телефон<input name="payoutPhone" inputMode="tel" defaultValue={user.payoutPhone || ""} autoComplete="tel" required /></label>
              <label className="field">Расчётный счёт<input name="payoutAccount" inputMode="numeric" defaultValue={user.payoutAccount || ""} minLength={20} maxLength={20} required /></label>
              <label className="field">БИК<input name="payoutBik" inputMode="numeric" defaultValue={user.payoutBik || ""} minLength={9} maxLength={9} required /></label>
            </div>
            <label className={styles.confirmation}>
              <input type="checkbox" name="selfEmployedConfirmed" defaultChecked={Boolean(user.selfEmployedConfirmedAt)} required />
              <span>Подтверждаю, что применяю НПД и передам корректный чек после выплаты.</span>
            </label>
            <button className="btn btn-primary" type="submit"><Landmark size={16} /> Сохранить реквизиты</button>
          </form>
          <p className={styles.note}>ReelPay не показывает реквизиты другим пользователям. До подключения автоматического провайдера заявки обрабатываются администратором и записываются в журнал.</p>
        </Card>
        </div>

        <Card className={styles.card}>
          <div className={styles.cardTitle}>
            <Mail size={20} />
            <div>
              <h2>Основной аккаунт</h2>
              <p>{user.email} · {user.emailVerifiedAt ? "подтверждён" : "не подтверждён"}</p>
            </div>
          </div>
          <p className={styles.note}>Email используется для входа и важных уведомлений об аккаунте.</p>
          {!user.emailVerifiedAt ? (
            <form action="/api/auth/verify-email" method="post">
              <input type="hidden" name="returnTo" value="/settings/account" />
              <button className="btn btn-primary" type="submit"><Mail size={16} /> Подтвердить email</button>
            </form>
          ) : null}
        </Card>

        <Card className={styles.card}>
          <div className={styles.cardTitle}>
            <ShieldCheck size={20} />
            <div>
              <h2>Вход через соцсети</h2>
              <p>Привяжите удобный способ входа.</p>
            </div>
          </div>
          <div className={styles.providers}>
            {providers.map((provider) => {
              const linked = accounts.find((account) => account.provider === provider.id);
              const configured = isConfigured(provider.id);
              return (
                <div className={styles.provider} key={provider.id}>
                  <div>
                    <strong>{provider.label}</strong>
                    <span>{linked ? "Подключено" : configured ? "Не подключено" : "Временно недоступно"}</span>
                  </div>
                  {linked ? (
                    <form action={unlinkAccountProviderAction}>
                      <input type="hidden" name="oauthAccountId" value={linked.id} />
                      <button className="btn btn-small btn-ghost" type="submit">Отключить</button>
                    </form>
                  ) : configured ? (
                    <Link className="btn btn-small" href={`/api/auth/oauth/${provider.id}?mode=link`}>
                      <Link2 size={15} /> Подключить
                    </Link>
                  ) : (
                    <span className={styles.unavailable}>Недоступно</span>
                  )}
                </div>
              );
            })}
          </div>
          <p className={styles.note}>
            ReelPay хранит только связь с вашим аккаунтом. Доступ к сообщениям и публикациям не запрашивается.
          </p>
        </Card>

        <Card className={styles.card}>
          <div className={styles.cardTitle}>
            <Video size={20} />
            <div>
              <h2>Площадки для проверки роликов</h2>
              <p>Подключение нужно только для подтверждения ваших публикаций и их статистики.</p>
            </div>
          </div>
          <div className={styles.providers}>
            {(["TIKTOK", "INSTAGRAM"] as const).map((platform) => {
              const account = socialAccounts.find((item) => item.platform === platform);
              const configured = platform === "TIKTOK" && socialPlatformConfigured(platform);
              const label = platform === "TIKTOK" ? "TikTok" : "Instagram Reels";
              return (
                <div className={styles.provider} key={platform}>
                  <div>
                    <strong>{label}</strong>
                    <span>
                      {account
                        ? `${account.handle} · подключено`
                        : configured
                          ? "Можно подключить"
                          : platform === "INSTAGRAM"
                            ? "Будет доступно после проверки приложения Meta"
                            : "Нужны ключи приложения"}
                    </span>
                  </div>
                  {account ? (
                    <form action={unlinkSocialPlatformAction}>
                      <input type="hidden" name="socialAccountId" value={account.id} />
                      <button className="btn btn-small btn-ghost" type="submit">Отключить</button>
                    </form>
                  ) : configured ? (
                    <Link className="btn btn-small" href={`/api/social/oauth/${platform.toLowerCase()}`}>
                      <Link2 size={15} /> Подключить
                    </Link>
                  ) : (
                    <span className={styles.unavailable}>Недоступно</span>
                  )}
                </div>
              );
            })}
          </div>
          <p className={styles.note}>
            Токены хранятся на сервере в зашифрованном виде. ReelPay не получает пароль и не публикует ролики от вашего имени.
          </p>
        </Card>

        <Card className={`${styles.card} ${styles.danger}`}>
          <div className={styles.cardTitle}>
            <Trash2 size={20} />
            <div><h2>Удалить аккаунт</h2><p>Это действие нельзя отменить.</p></div>
          </div>
          <form className={styles.deleteForm} action={deleteAccountAction}>
            <label className="field">
              Введите УДАЛИТЬ
              <input name="confirmation" placeholder="УДАЛИТЬ" autoComplete="off" />
            </label>
            <button className="btn btn-ghost danger-btn" type="submit">Удалить аккаунт</button>
          </form>
        </Card>
      </section>
    </AppShell>
  );
}
