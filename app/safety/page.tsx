import type { Metadata } from "next";
import Link from "next/link";
import { AppShell } from "@/components/ui";
import styles from "../info.module.css";

export const metadata: Metadata = {
  title: "Безопасность — ReelPay",
  description: "Как ReelPay защищает аккаунты, работы и выплаты."
};

export default function SafetyPage() {
  return (
    <AppShell>
      <article className={styles.page}>
        <header className={styles.hero}>
          <span className="eyebrow">Безопасность</span>
          <h1>Проверяем работы и защищаем аккаунты</h1>
          <p>Здесь коротко описано, что проверяет сервис и что нужно делать пользователю.</p>
        </header>

        <section className={styles.section}>
          <h2>Аккаунт</h2>
          <ul>
            <li>Пароли хранятся только в виде защищённого хеша.</li>
            <li>При входе через соцсеть мы не получаем доступ к сообщениям и публикациям.</li>
            <li>Подозрительные запросы ограничиваются автоматически.</li>
          </ul>
        </section>

        <section className={styles.section}>
          <h2>Заказы и ролики</h2>
          <ul>
            <li>Ссылки и файлы проходят проверку перед обработкой.</li>
            <li>Просмотры и резкие изменения активности проверяются на накрутку.</li>
            <li>Спорные работы отправляются на ручную модерацию.</li>
          </ul>
        </section>

        <section className={styles.section}>
          <h2>Деньги</h2>
          <ul>
            <li>Средства на проверке не смешиваются с доступным балансом.</li>
            <li>История операций остаётся в кошельке.</li>
            <li>Данные банковской карты обрабатывает платёжный провайдер, а не ReelPay.</li>
          </ul>
        </section>

        <section className={styles.section}>
          <h2>Если что-то выглядит подозрительно</h2>
          <p>Не отправляйте данные карты или пароль в чате. Сообщите о проблеме поддержке.</p>
          <Link className="btn btn-primary" href="/support">Сообщить</Link>
        </section>
      </article>
    </AppShell>
  );
}
