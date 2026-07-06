// Telegram channel auto-posting. Disabled unless TELEGRAM_BOT_TOKEN, TELEGRAM_CHANNEL_ID
// and TELEGRAM_ENABLED=1 are all set. Every call is fail-silent: a broken/unset integration
// must never break campaign creation or the digest cron.

const API = "https://api.telegram.org";

export function telegramEnabled() {
  return (
    process.env.TELEGRAM_ENABLED === "1" &&
    Boolean(process.env.TELEGRAM_BOT_TOKEN) &&
    Boolean(process.env.TELEGRAM_CHANNEL_ID)
  );
}

export async function postToChannel(text: string): Promise<boolean> {
  if (!telegramEnabled()) return false;
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHANNEL_ID;
  try {
    const response = await fetch(`${API}/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: false
      }),
      // Never let a slow Telegram API stall the request that triggered it.
      signal: AbortSignal.timeout(6000)
    });
    return response.ok;
  } catch {
    return false;
  }
}

const escape = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function siteUrl() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://clippers-hub-mdt.netlify.app")
  );
}

export function formatCampaignPost(input: {
  id: string;
  title: string;
  cpmRateCents: number;
  totalBudgetCents: number;
  minimumGuaranteeCents: number;
  deadline: Date;
}): string {
  const cpm = Math.round(input.cpmRateCents / 100);
  const budget = Math.round(input.totalBudgetCents / 100).toLocaleString("ru-RU");
  const days = Math.max(1, Math.ceil((input.deadline.getTime() - Date.now()) / 86400000));
  const guarantee = input.minimumGuaranteeCents > 0
    ? `\n🎁 Гарантия: от ${Math.round(input.minimumGuaranteeCents / 100)} ₽ за принятый ролик`
    : "";
  return [
    `🎬 <b>Новый заказ на нарезки</b>`,
    ``,
    `<b>${escape(input.title)}</b>`,
    `💰 Ставка: ${cpm} ₽ / 1000 просмотров`,
    `📦 Бюджет: ${budget} ₽`,
    `⏳ Дедлайн: ${days} дн.${guarantee}`,
    ``,
    `👉 ${siteUrl()}/campaigns/${input.id}`
  ].join("\n");
}

export function formatWeeklyDigest(input: {
  topPayoutCents: number;
  topClipperHandle: string | null;
  topClipperEarnedCents: number;
  newCampaigns: number;
  totalPaidCents: number;
}): string {
  const rub = (cents: number) => Math.round(cents / 100).toLocaleString("ru-RU");
  const clipperLine = input.topClipperHandle
    ? `🏆 Топ-клиппер недели: @${escape(input.topClipperHandle)} — ${rub(input.topClipperEarnedCents)} ₽`
    : `🏆 Топ-клиппер недели: на этой неделе пусто`;
  return [
    `📊 <b>Итоги недели ReelPay</b>`,
    ``,
    clipperLine,
    `💸 Выплачено клипперам: ${rub(input.totalPaidCents)} ₽`,
    `🆕 Новых заказов: ${input.newCampaigns}`,
    ``,
    `Заходи в ленту и забирай свой заказ 👇`,
    `${siteUrl()}/campaigns`
  ].join("\n");
}
