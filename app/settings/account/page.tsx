import Link from "next/link";
import { ArrowLeft, Link2, Mail, ShieldCheck, Trash2 } from "lucide-react";
import { deleteAccountAction } from "@/app/actions";
import { AppShell, Card } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { isConfigured, type ProviderId } from "@/lib/oauth";
import { prisma } from "@/lib/prisma";
import { unlinkAccountProviderAction } from "./actions";
import styles from "./settings.module.css";

const providers: Array<{ id: ProviderId; label: string }> = [
  { id: "google", label: "Google" },
  { id: "vk", label: "VK ID" },
  { id: "yandex", label: "Яндекс" }
];

export default async function AccountSettingsPage() {
  const user = await requireUser();
  const accounts = await prisma.oAuthAccount.findMany({
    where: { userId: user.id },
    select: { id: true, provider: true, createdAt: true },
    orderBy: { createdAt: "desc" }
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

        <Card className={styles.card}>
          <div className={styles.cardTitle}>
            <Mail size={20} />
            <div><h2>Основной аккаунт</h2><p>{user.email}</p></div>
          </div>
          <p className={styles.note}>Email используется для входа и важных уведомлений об аккаунте.</p>
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
