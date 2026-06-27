import Link from "next/link";
import { ArrowDownToLine, ArrowUpRight, CreditCard, ShieldCheck, WalletCards } from "lucide-react";
import { depositAction, withdrawAction } from "@/app/actions";
import { AppShell, Card, Stat, Tag } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { rub } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { getActiveRoleMode } from "@/lib/role-mode";

const transactionLabels: Record<string, string> = {
  DEPOSIT: "Пополнение",
  EARNING: "Оплата работы",
  WITHDRAWAL: "Вывод",
  REFERRAL_BONUS: "Бонус",
  STREAK_BONUS: "Бонус за серию",
  ADJUSTMENT: "Корректировка"
};

export default async function WalletPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const mode = await getActiveRoleMode(user);
  const params = await searchParams;
  const page = Math.max(1, Number(params.page || 1));
  const pageSize = 10;
  const visibleTypes = mode === "client"
    ? ["DEPOSIT", "ADJUSTMENT"] as const
    : ["EARNING", "WITHDRAWAL", "REFERRAL_BONUS", "STREAK_BONUS"] as const;
  const transactionWhere = { userId: user.id, type: { in: [...visibleTypes] } };

  const [transactions, totalTransactions, totalAggregate, campaignBudget, campaignExpenses] = await Promise.all([
    prisma.transaction.findMany({
      where: transactionWhere,
      select: { id: true, type: true, netCents: true, status: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize
    }),
    prisma.transaction.count({ where: transactionWhere }),
    prisma.transaction.aggregate({
      where: { userId: user.id, type: mode === "client" ? "DEPOSIT" : "EARNING" },
      _sum: { netCents: true }
    }),
    mode === "client"
      ? prisma.campaign.aggregate({
          where: { ownerId: user.id },
          _sum: { totalBudgetCents: true, remainingBudgetCents: true }
        })
      : Promise.resolve(null),
    mode === "client"
      ? prisma.campaign.findMany({
          where: { ownerId: user.id },
          select: { id: true, title: true, totalBudgetCents: true, remainingBudgetCents: true },
          orderBy: { updatedAt: "desc" },
          take: 5
        })
      : Promise.resolve([])
  ]);

  const totalMoney = totalAggregate._sum.netCents || 0;
  const reserved = campaignBudget?._sum.remainingBudgetCents || 0;
  const spent = Math.max(0, (campaignBudget?._sum.totalBudgetCents || 0) - reserved);
  const totalPages = Math.max(1, Math.ceil(totalTransactions / pageSize));

  return (
    <AppShell>
      <section className="section wallet-screen">
        <div className="wallet-hero">
          <div>
            <span className="eyebrow">Кошелёк</span>
            <h1>{mode === "client" ? "Бюджет" : "Выплаты"}</h1>
            <p className="lead">
              {mode === "client"
                ? "Пополняйте баланс и контролируйте расходы кампаний."
                : "Следите за начислениями и выводите доступные средства."}
            </p>
          </div>
          <Card className="wallet-balance-card">
            <WalletCards />
            <span>Доступно</span>
            <strong>{rub(user.balanceCents)}</strong>
            <small>{mode === "client" ? `В кампаниях: ${rub(reserved)}` : `На проверке: ${rub(user.holdBalanceCents)}`}</small>
          </Card>
        </div>

        <section className="grid grid-4 wallet-metrics">
          <Stat value={rub(user.balanceCents)} label="доступно" tone="good" />
          <Stat value={rub(mode === "client" ? reserved : user.holdBalanceCents)} label={mode === "client" ? "в кампаниях" : "на проверке"} />
          <Stat value={rub(mode === "client" ? spent : totalMoney)} label={mode === "client" ? "потрачено" : "заработано"} />
          <Stat value={String(totalTransactions)} label={mode === "client" ? "операций" : "выплат"} />
        </section>

        <section className="wallet-actions-grid">
          {mode === "client" ? (
            <Card className="wallet-action-card">
              <div className="wallet-action-head"><CreditCard /><h2>Пополнить баланс</h2></div>
              <form className="form" action={depositAction}>
                <label className="field">Сумма, ₽<input name="amount" type="number" min="100" step="100" defaultValue="50000" /></label>
                <label className="field">
                  Способ оплаты
                  <select name="provider">
                    <option value="yookassa">ЮKassa</option>
                    <option value="stripe">Stripe</option>
                  </select>
                </label>
                <button className="btn btn-primary" type="submit"><ArrowDownToLine size={18} /> Перейти к оплате</button>
              </form>
            </Card>
          ) : (
            <Card className="wallet-action-card">
              <div className="wallet-action-head"><ArrowUpRight /><h2>Вывести средства</h2></div>
              <form className="form" action={withdrawAction}>
                <label className="field">Сумма, ₽<input name="amount" type="number" min="500" step="100" defaultValue="5000" /></label>
                <button className="btn btn-primary" type="submit"><ArrowUpRight size={18} /> Отправить заявку</button>
              </form>
              <p className="safe-note"><ShieldCheck size={18} /> Комиссия: 50 ₽ + 1%. Заявка проходит проверку перед выплатой.</p>
            </Card>
          )}
        </section>

        {mode === "client" && campaignExpenses.length ? (
          <Card className="wallet-history">
            <div className="section-head compact"><h2>Расходы по кампаниям</h2></div>
            <div className="pay-list">
              {campaignExpenses.map((campaign) => (
                <div className="pay-row wallet-row" key={campaign.id}>
                  <span>₽</span>
                  <div>
                    <strong><Link href={`/campaigns/${campaign.id}`}>{campaign.title}</Link></strong>
                    <small>Осталось {rub(campaign.remainingBudgetCents)}</small>
                  </div>
                  <b>{rub(Math.max(0, campaign.totalBudgetCents - campaign.remainingBudgetCents))}</b>
                </div>
              ))}
            </div>
          </Card>
        ) : null}

        <Card className="wallet-history">
          <div className="section-head compact">
            <h2>{mode === "client" ? "Пополнения и расходы" : "История выплат"}</h2>
            <Tag tone="soft">{totalTransactions}</Tag>
          </div>
          <div className="pay-list">
            {transactions.length ? transactions.map((transaction) => (
              <div className="pay-row wallet-row" key={transaction.id}>
                <span>{transaction.status === "COMPLETED" ? "✓" : "…"}</span>
                <div>
                  <strong>{transactionLabels[transaction.type] || transaction.type}</strong>
                  <small>{transaction.createdAt.toLocaleString("ru-RU")}</small>
                </div>
                <div>
                  <b>{rub(transaction.netCents)}</b>
                  <Tag tone={transaction.status === "COMPLETED" ? "good" : "warn"}>
                    {transaction.status === "COMPLETED" ? "Готово" : "В обработке"}
                  </Tag>
                </div>
              </div>
            )) : <p className="muted">Операций пока нет.</p>}
          </div>
          {totalPages > 1 ? (
            <div className="pagination">
              <Link className={page <= 1 ? "disabled" : ""} href={`/wallet?page=${Math.max(1, page - 1)}`}>Назад</Link>
              <span>{page} / {totalPages}</span>
              <Link className={page >= totalPages ? "disabled" : ""} href={`/wallet?page=${Math.min(totalPages, page + 1)}`}>Дальше</Link>
            </div>
          ) : null}
        </Card>
      </section>
    </AppShell>
  );
}
