// Pure, testable "why accepted / why rejected" explainer for a submission. Turns the raw
// status + ownership check + fraud score + view progress + dispute into plain-language reasons
// both the clipper and the client can read. No prisma / server-only, so it runs on the client
// component and in unit tests.

export type VideoCheckLite = { checkType: string; status: string };

export type ClipReportInput = {
  status: string;
  fraudScore: number;
  currentViews: number;
  viewThreshold: number;
  platform: string;
  videoChecks: VideoCheckLite[];
  disputeOpen: boolean;
};

export type ReasonState = "ok" | "pending" | "warn" | "bad";
export type ClipReason = { state: ReasonState; label: string; text: string };
export type ClipReportTone = "good" | "pending" | "warn" | "bad";
export type ClipReport = {
  headline: string;
  tone: ClipReportTone;
  tracking: string;
  reasons: ClipReason[];
};

// Only these platforms have a real metrics API today (see lib/view-providers.ts). TikTok and
// Instagram have no public metrics endpoint, so their results are verified manually.
const AUTO_TRACKED = new Set(["YOUTUBE", "VK"]);
const FRAUD_BLOCK = 70;
const FRAUD_WARN = 60;

function ru(n: number) {
  return Math.max(0, Math.round(n)).toLocaleString("ru-RU");
}

export function explainSubmission(input: ClipReportInput): ClipReport {
  const { status, fraudScore, currentViews, viewThreshold, platform, videoChecks, disputeOpen } = input;
  const auto = AUTO_TRACKED.has(platform);
  const ownership = videoChecks.find((c) => c.checkType === "OWNERSHIP");
  const reasons: ClipReason[] = [];

  // Ownership (tracking code in the published post).
  if (ownership?.status === "PASS") {
    reasons.push({ state: "ok", label: "Владение", text: "Трекинг-код найден в публикации" });
  } else if (ownership?.status === "FAIL") {
    reasons.push({ state: "bad", label: "Владение", text: "Трекинг-код не найден — добавьте код в описание публикации" });
  } else {
    reasons.push({
      state: "pending",
      label: "Владение",
      text: auto ? "Ждём проверку кода в описании публикации" : "Ждём ручное подтверждение модератора"
    });
  }

  // View goal.
  const reached = currentViews >= viewThreshold;
  reasons.push(
    reached
      ? { state: "ok", label: "Цель по просмотрам", text: `Достигнута: ${ru(currentViews)} из ${ru(viewThreshold)}` }
      : { state: "pending", label: "Цель по просмотрам", text: `${ru(currentViews)} из ${ru(viewThreshold)}` }
  );

  // Anti-fraud.
  if (fraudScore >= FRAUD_BLOCK) {
    reasons.push({ state: "bad", label: "Проверка на накрутку", text: `Высокий риск (${fraudScore}%) — работа на ручной проверке, накрутка не оплачивается` });
  } else if (fraudScore >= FRAUD_WARN) {
    reasons.push({ state: "warn", label: "Проверка на накрутку", text: `Повышенный риск (${fraudScore}%) — следим за динамикой` });
  } else {
    reasons.push({ state: "ok", label: "Проверка на накрутку", text: `Риск в норме (${fraudScore}%)` });
  }

  // Dispute.
  if (disputeOpen) {
    reasons.push({ state: "warn", label: "Спор", text: "Открыт спор — выплата приостановлена до решения администратора" });
  }

  const tracking = auto
    ? "Авто-проверка просмотров через API площадки (YouTube/VK)"
    : "Ручная проверка просмотров модератором (TikTok/Instagram)";

  let headline = "В работе";
  let tone: ClipReportTone = "pending";
  if (disputeOpen) {
    headline = "Идёт спор — выплата на паузе";
    tone = "warn";
  } else {
    switch (status) {
      case "REJECTED": headline = "Работа не прошла проверку"; tone = "bad"; break;
      case "PAID": headline = "Оплачено"; tone = "good"; break;
      case "SETTLING": headline = "Проверка выплаты · защитное окно 48 часов"; tone = "pending"; break;
      case "THRESHOLD_MET": headline = "Цель достигнута · готовим начисление"; tone = "good"; break;
      case "VERIFIED": headline = "Публикация принята · считаем просмотры"; tone = "pending"; break;
      case "POSTED": headline = "Ссылка на проверке"; tone = "pending"; break;
      case "ACCEPTED": headline = "Заказ взят · ждём публикацию"; tone = "pending"; break;
      default: headline = "В работе"; tone = "pending";
    }
  }

  return { headline, tone, tracking, reasons };
}
