import Link from "next/link";
import { ArrowDownToLine, ArrowLeft, ArrowUpRight, Coins, CreditCard, ShieldCheck, WalletCards } from "lucide-react";
import { convertRpToRubAction, convertRubToRpAction, depositAction, withdrawAction } from "@/app/actions";
import { AppShell, Card, Tag } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { rub } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { getActiveRoleMode } from "@/lib/role-mode";
import { availablePaymentProviders } from "@/lib/payment-readiness";
import { hasCompletePayoutDetails } from "@/lib/payout-details";

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
  const tab = ["operations", "reserved", "campaigns", "rp"].includes(String(params.tab)) ? String(params.tab) : "operations";
  const page = Math.max(1, Number(params.page || 1));
  const pageSize = 10;
  const requestedDepositCents = Math.max(0, Number(params.need || 0));
  const depositDefaultRub = requestedDepositCents > 0 ? Math.ceil(requestedDepositCents / 100) : 50000;
  const paymentProviders = availablePaymentProviders();
  const visibleTypes = mode === "client"
    ? ["DEPOSIT", "ADJUSTMENT"] as const
    : ["EARNING", "WITHDRAWAL", "REFERRAL_BONUS", "STREAK_BONUS"] as const;
  const transactionWhere = { userId: user.id, isDemo: user.isDemo, type: { in: [...visibleTypes] } };
  const payoutReady = hasCompletePayoutDetails(user);

  const [transactions, totalTransactions, campaignBudget, campaignExpenses, rpTransactions] = await Promise.all([
    prisma.transaction.findMany({
      where: transactionWhere,
      select: { id: true, type: true, netCents: true, status: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize
    }),
    prisma.transaction.count({ where: transactionWhere }),
    mode === "client"
      ? prisma.campaign.aggregate({
          where: { ownerId: user.id, isDemo: user.isDemo },
          _sum: { totalBudgetCents: true, remainingBudgetCents: true, reservedBudgetCents: true }
        })
      : Promise.resolve(null),
    mode === "client"
      ? prisma.campaign.findMany({
          where: { ownerId: user.id, isDemo: user.isDemo },
          select: { id: true, title: true, totalBudgetCents: true, remainingBudgetCents: true, reservedBudgetCents: true },
          orderBy: { updatedAt: "desc" },
          take: 5
        })
      : Promise.resolve([]),
    prisma.rpTransaction.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 5
    })
  ]);

  const reserved = (campaignBudget?._sum.remainingBudgetCents || 0) + (campaignBudget?._sum.reservedBudgetCents || 0);
  const totalPages = Math.max(1, Math.ceil(totalTransactions / pageSize));
  const transactionGroups = transactions.reduce<Array<{ date: string; items: typeof transactions }>>((groups, item) => {
    const date = item.createdAt.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
    const current = groups.at(-1);
    if (current?.date === date) current.items.push(item);
    else groups.push({ date, items: [item] });
    return groups;
  }, []);

  return (
    <AppShell hideFooter>
      <section className="section wallet-screen">
        <Link className="wallet-back" href="/profile"><ArrowLeft size={17} /> Назад</Link>
        {params.error === "insufficient_budget" ? (
          <Card className="upload-status warn">
            <strong>Для запуска кампании не хватает средств</strong>
            <span>Пополните баланс минимум на {rub(requestedDepositCents)}. После оплаты вернитесь к созданию кампании.</span>
          </Card>
        ) : null}
        {params.error === "payments_unavailable" ? (
          <Card className="upload-status warn">
            <strong>Пополнение пока недоступно</strong>
            <span>Ни один платёжный способ ещё не подключён. Деньги не списывались.</span>
          </Card>
        ) : null}
        {params.error === "payout_details" ? (
          <Card className="upload-status warn">
            <strong>Сначала заполните реквизиты</strong>
            <span>Без подтверждённых реквизитов заявка на выплату не создаётся.</span>
          </Card>
        ) : null}
        {params.withdrawal === "requested" ? (
          <Card className="upload-status ok">
            <strong>Заявка на выплату создана</strong>
            <span>Сумма зарезервирована. Статус появится в истории, а после банковского перевода придёт уведомление с подтверждением.</span>
          </Card>
        ) : null}
        <div className="wallet-hero">
          <div className="wallet-title-block">
            <span className="eyebrow"><WalletCards size={15} /> Финансы ReelPay</span>
            <h1>Кошелёк</h1>
            <p className="lead">Деньги, резерв кампаний и бонусы в одном месте.</p>
          </div>
          <Card className="wallet-balance-card">
            <WalletCards />
            <span>Доступно</span>
            <strong>{rub(user.balanceCents)}</strong>
            <small>{mode === "client" ? `В кампаниях: ${rub(reserved)}` : `На проверке: ${rub(user.holdBalanceCents)}`}</small>
            {mode !== "client" && user.holdBalanceCents > 0 ? (
              <small className="wallet-hold-hint">Начисления проходят защитную проверку 48 часов, затем автоматически становятся доступны к выводу.</small>
            ) : null}
            <Link className="wallet-balance-cta" href={`/wallet?tab=operations#${mode === "client" ? "wallet-deposit" : "wallet-withdraw"}`}>
              {mode === "client" ? "Пополнить баланс" : payoutReady ? "Вывести средства" : "Настроить вывод"}
            </Link>
          </Card>
          <Card className="wallet-balance-card wallet-rp-card">
            <Coins />
            <span>RP-баланс</span>
            <strong>{user.rpBalance.toLocaleString("ru-RU")} RP</strong>
            <small>Куплено: {user.rpPurchasedBalance.toLocaleString("ru-RU")} · бонусы: {(user.rpBalance - user.rpPurchasedBalance).toLocaleString("ru-RU")}</small>
          </Card>
        </div>

        <nav className="wallet-tabs" aria-label="Разделы кошелька">
          <Link className={tab === "operations" ? "active" : ""} href="/wallet?tab=operations">Операции</Link>
          <Link className={tab === "reserved" ? "active" : ""} href="/wallet?tab=reserved">В резерве</Link>
          <Link className={tab === "campaigns" ? "active" : ""} href="/wallet?tab=campaigns">Кампании</Link>
          <Link className={tab === "rp" ? "active" : ""} href="/wallet?tab=rp">RP</Link>
        </nav>

        {tab === "operations" ? <section className="wallet-actions-grid">
          {mode === "client" ? (
            <Card className="wallet-action-card" id="wallet-deposit">
              <div className="wallet-action-head"><CreditCard /><h2>Пополнить баланс</h2></div>
              {paymentProviders.length ? (
                <form className="form" action={depositAction}>
                  <label className="field">Сумма, ₽<input name="amount" type="number" min="100" step="100" defaultValue={depositDefaultRub} /></label>
                  <label className="field">
                    Способ оплаты
                    <select name="provider">
                      {paymentProviders.map((provider) => (
                        <option value={provider.id} key={provider.id}>{provider.label}</option>
                      ))}
                    </select>
                  </label>
                  <button className="btn btn-primary" type="submit"><ArrowDownToLine size={18} /> Перейти к оплате</button>
                </form>
              ) : (
                <>
                  <div className="safe-note">
                    <ShieldCheck size={18} />
                    <span>Онлайн-оплата сейчас не подключена. Пополнить баланс можно по счёту — обычно зачисляем в течение рабочего дня.</span>
                  </div>
                  <Link className="btn btn-primary" href="/support?new=1">Запросить счёт на пополнение</Link>
                  <p className="wallet-invoice-hint">Для юрлиц и ИП: напишите сумму, ИНН и название компании — пришлём счёт и закрывающие документы.</p>
                </>
              )}
            </Card>
          ) : (
            <Card className="wallet-action-card" id="wallet-withdraw">
              <div className="wallet-action-head"><ArrowUpRight /><h2>Вывести средства</h2></div>
              {payoutReady ? (
                <form className="form" action={withdrawAction}>
                  <label className="field">Сумма, ₽<input name="amount" type="number" min="500" step="100" defaultValue="5000" /></label>
                  <button className="btn btn-primary" type="submit"><ArrowUpRight size={18} /> Отправить заявку</button>
                </form>
              ) : (
                <div className="form">
                  <p className="muted">Укажите ФИО, ИНН, счёт и БИК. Эти данные не показываются другим пользователям.</p>
                  <Link className="btn btn-primary" href="/settings/account#payout-details">Заполнить реквизиты</Link>
                </div>
              )}
              <p className="safe-note"><ShieldCheck size={18} /> Комиссия: 50 ₽ + 1%. Выплата обрабатывается вручную, каждая операция подтверждается номером перевода и чеком.</p>
            </Card>
          )}
        </section> : null}

        {tab === "campaigns" && mode === "client" && campaignExpenses.length ? (
          <Card className="wallet-history">
            <div className="section-head compact"><h2>Расходы по кампаниям</h2></div>
            <div className="pay-list">
              {campaignExpenses.map((campaign) => (
                <div className="pay-row wallet-row" key={campaign.id}>
                  <span>₽</span>
                  <div>
                    <strong><Link href={`/campaigns/${campaign.id}?returnTo=%2Fwallet`}>{campaign.title}</Link></strong>
                    <small>Свободно {rub(campaign.remainingBudgetCents)} · под клипперов {rub(campaign.reservedBudgetCents)}</small>
                  </div>
                  <b>{rub(Math.max(0, campaign.totalBudgetCents - campaign.remainingBudgetCents - campaign.reservedBudgetCents))}</b>
                </div>
              ))}
            </div>
          </Card>
        ) : null}

        {tab === "operations" ? <Card className="wallet-history">
          <div className="section-head compact">
            <h2>{mode === "client" ? "Пополнения и расходы" : "История выплат"}</h2>
            <Tag tone="soft">{totalTransactions}</Tag>
          </div>
          <div className="pay-list">
            {transactionGroups.length ? transactionGroups.map((group) => (
              <section className="wallet-date-group" key={group.date}>
                <h3>{group.date}</h3>
                {group.items.map((transaction) => (
                  <div className="pay-row wallet-row" key={transaction.id}>
                    <span>{transaction.status === "COMPLETED" ? "✓" : "…"}</span>
                    <div>
                      <strong>{transactionLabels[transaction.type] || transaction.type}</strong>
                      <small>{transaction.createdAt.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}</small>
                    </div>
                    <div>
                      <b>{rub(transaction.netCents)}</b>
                      <Tag tone={transaction.status === "COMPLETED" ? "good" : "warn"}>
                        {transaction.status === "COMPLETED" ? "Готово" : "В обработке"}
                      </Tag>
                    </div>
                  </div>
                ))}
              </section>
            )) : <p className="muted">Операций пока нет.</p>}
          </div>
          {totalPages > 1 ? (
            <div className="pagination">
              <Link className={page <= 1 ? "disabled" : ""} href={`/wallet?page=${Math.max(1, page - 1)}`}>Назад</Link>
              <span>{page} / {totalPages}</span>
              <Link className={page >= totalPages ? "disabled" : ""} href={`/wallet?page=${Math.min(totalPages, page + 1)}`}>Дальше</Link>
            </div>
          ) : null}
        </Card> : null}

        {tab === "reserved" ? (
          <Card className="wallet-history wallet-reserve">
            <div className="section-head compact"><h2>Средства в резерве</h2></div>
            <div className="wallet-reserve-value">{rub(mode === "client" ? reserved : user.holdBalanceCents)}</div>
            <p className="muted">{mode === "client" ? "Зарезервированы под активные кампании." : "Ожидают завершения проверки работ."}</p>
          </Card>
        ) : null}

        {tab === "rp" ? (
          <Card className="wallet-history">
            <div className="section-head compact"><div><h2>RP</h2><p className="muted">1 RP = 1 ₽. Сначала расходуются бонусные RP.</p></div><Tag tone="soft">{user.rpBalance} RP</Tag></div>
            <div className="rp-convert-grid">
              <form action={convertRubToRpAction}>
                <b>Купить RP с баланса</b>
                <input name="amount" type="number" min="1" placeholder="Сумма" required />
                <button className="btn btn-primary" type="submit">Перевести в RP</button>
              </form>
              <form action={convertRpToRubAction}>
                <b>Вернуть купленные RP</b>
                <input name="amount" type="number" min="1" max={user.rpPurchasedBalance} placeholder="Сумма" required />
                <button className="btn" type="submit" disabled={!user.rpPurchasedBalance}>Вернуть в рубли</button>
              </form>
            </div>
            <div className="pay-list">
              {rpTransactions.map((item) => (
                <div className="pay-row wallet-row" key={item.id}>
                  <span>RP</span>
                  <div><strong>{item.type === "ACHIEVEMENT" ? "Награда за достижение" : "Продвижение кампании"}</strong><small>{item.createdAt.toLocaleString("ru-RU")}</small></div>
                  <b>{item.amount > 0 ? "+" : ""}{item.amount} RP</b>
                </div>
              ))}
            </div>
            <Link className="wallet-rp-help" href="/help/rp">Что такое RP и как ими пользоваться</Link>
          </Card>
        ) : null}
      </section>
    </AppShell>
  );
}
