import { ArrowDownToLine, ArrowUpRight, CreditCard, ShieldCheck, WalletCards } from "lucide-react";
import Link from "next/link";
import { AppShell, Card, Stat, Tag } from "@/components/ui";
import { depositAction, withdrawAction } from "@/app/actions";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { rub } from "@/lib/money";

const txLabel: Record<string, string> = {
  DEPOSIT: "Пополнение",
  EARNING: "Выплата за ролик",
  WITHDRAWAL: "Вывод",
  REFERRAL_BONUS: "Реферал",
  STREAK_BONUS: "Streak-бонус",
  ADJUSTMENT: "Корректировка"
};

export default async function WalletPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser();
  const params = await searchParams;
  const page = Math.max(1, Number(params.page || 1));
  const pageSize = 10;
  const [transactions, totalTransactions, earnedAggregate] = await Promise.all([
    prisma.transaction.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize
    }),
    prisma.transaction.count({ where: { userId: user.id } }),
    prisma.transaction.aggregate({ where: { userId: user.id, type: "EARNING" }, _sum: { netCents: true } })
  ]);

  const earned = earnedAggregate._sum.netCents || 0;
  const totalPages = Math.max(1, Math.ceil(totalTransactions / pageSize));

  return (
    <AppShell>
      <section className="section wallet-screen">
        <div className="wallet-hero">
          <div>
            <span className="eyebrow">Кошелёк</span>
            <h1>Деньги за ролики и заказы</h1>
            <p className="lead">Баланс, выплаты, пополнения и история операций в одном месте.</p>
          </div>
          <Card className="wallet-balance-card">
            <WalletCards />
            <span>Доступно</span>
            <strong>{rub(user.balanceCents)}</strong>
            <small>Hold: {rub(user.holdBalanceCents)} · KYC {user.kycStatus}</small>
          </Card>
        </div>

        <section className="grid grid-4 wallet-metrics">
          <Stat value={rub(user.balanceCents)} label="доступно" tone="good" />
          <Stat value={rub(user.holdBalanceCents)} label="на проверке" />
          <Stat value={rub(earned)} label="заработано" />
          <Stat value={transactions.length} label="операций" />
        </section>

        <section className="wallet-actions-grid">
          <Card className="wallet-action-card">
            <div className="wallet-action-head"><CreditCard /><h2>Пополнить</h2></div>
            <form className="form" action={depositAction}>
              <label className="field">Сумма, ₽<input name="amount" type="number" defaultValue="50000" /></label>
              <label className="field">Провайдер<select name="provider"><option value="yookassa">ЮKassa</option><option value="stripe">Stripe</option></select></label>
              <button className="btn btn-primary" type="submit"><ArrowDownToLine size={18} /> Создать платеж</button>
            </form>
          </Card>

          <Card className="wallet-action-card">
            <div className="wallet-action-head"><ArrowUpRight /><h2>Вывести</h2></div>
            <form className="form" action={withdrawAction}>
              <label className="field">Сумма, ₽<input name="amount" type="number" defaultValue="5000" /></label>
              <button className="btn btn-primary" type="submit"><ArrowUpRight size={18} /> Создать заявку</button>
            </form>
            <p className="safe-note"><ShieldCheck size={18} /> Комиссия вывода: ₽50 + 1%. Реальный вывод подключается после платежного провайдера.</p>
          </Card>
        </section>

        <Card className="wallet-history">
          <div className="section-head compact">
            <h2>История операций</h2>
            <Tag tone="soft">{totalTransactions} записей</Tag>
          </div>
          <div className="pay-list">
            {transactions.map((tx) => (
              <div className="pay-row wallet-row" key={tx.id}>
                <span>{tx.status === "COMPLETED" ? "✓" : "…"}</span>
                <div>
                  <strong>{txLabel[tx.type] || tx.type}</strong>
                  <small>{tx.createdAt.toLocaleString("ru-RU")}</small>
                </div>
                <div>
                  <b>{rub(tx.netCents)}</b>
                  <Tag tone={tx.status === "COMPLETED" ? "good" : "warn"}>{tx.status === "COMPLETED" ? "Успешно" : "В работе"}</Tag>
                </div>
              </div>
            ))}
          </div>
          <div className="pagination">
            <Link className={page <= 1 ? "disabled" : ""} href={`/wallet?page=${Math.max(1, page - 1)}`}>Назад</Link>
            <span>{page} / {totalPages}</span>
            <Link className={page >= totalPages ? "disabled" : ""} href={`/wallet?page=${Math.min(totalPages, page + 1)}`}>Дальше</Link>
          </div>
        </Card>
      </section>
    </AppShell>
  );
}
