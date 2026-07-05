type DiagnosticSubmission = {
  status: string;
  draftStatus?: string | null;
  currentViews: number;
  fraudScore: number;
  createdAt: Date | string;
  updatedAt: Date | string;
  draftSubmittedAt?: Date | string | null;
};

type DiagnosticCampaign = {
  id: string;
  status: string;
  createdAt: Date | string;
  deadline: Date | string;
  remainingBudgetCents: number;
  reservedBudgetCents: number;
  grossPayoutCents: number;
  slotsLeft: number;
  submissions: DiagnosticSubmission[];
};

export type CampaignDiagnostic = {
  tone: "good" | "notice" | "warning" | "critical";
  title: string;
  text: string;
  action?: string;
  href?: string;
};

const HOUR = 3_600_000;

export function diagnoseCampaign(campaign: DiagnosticCampaign, now = new Date()): CampaignDiagnostic[] {
  const diagnostics: CampaignDiagnostic[] = [];
  const ageHours = (now.getTime() - new Date(campaign.createdAt).getTime()) / HOUR;
  const hoursLeft = (new Date(campaign.deadline).getTime() - now.getTime()) / HOUR;
  const active = campaign.submissions.filter((item) => item.status !== "REJECTED");
  const posted = active.filter((item) => ["POSTED", "VERIFIED", "THRESHOLD_MET", "SETTLING", "PAID"].includes(item.status));
  const paid = active.filter((item) => item.status === "PAID");
  const rejected = campaign.submissions.filter((item) => item.status === "REJECTED");
  const stalled = active.filter((item) =>
    item.status === "ACCEPTED" && now.getTime() - new Date(item.updatedAt).getTime() > 24 * HOUR
  );
  const pendingDrafts = active.filter((item) =>
    item.draftStatus === "PENDING"
    && item.draftSubmittedAt
    && now.getTime() - new Date(item.draftSubmittedAt).getTime() > 12 * HOUR
  );

  if (campaign.status === "COMPLETED") {
    diagnostics.push({
      tone: "good",
      title: "Кампания завершена",
      text: `Оплачено результатов: ${paid.length}. Неиспользованный резерв возвращён.`
    });
    return diagnostics;
  }

  if (campaign.slotsLeft <= 0) {
    diagnostics.push({
      tone: "notice",
      title: "Все оплачиваемые места заняты",
      text: "Новые исполнители больше не смогут взять заказ. Дождитесь текущих результатов."
    });
  } else if (campaign.remainingBudgetCents < campaign.grossPayoutCents) {
    diagnostics.push({
      tone: "critical",
      title: "Не хватает свободного бюджета",
      text: "На следующий результат денег уже недостаточно. Пополните баланс или завершите кампанию.",
      action: "Открыть кошелёк",
      href: "/wallet"
    });
  }

  if (ageHours >= 48 && active.length === 0 && campaign.slotsLeft > 0) {
    diagnostics.push({
      tone: "warning",
      title: "Заказ не взяли за 48 часов",
      text: "Проверьте ставку, срок и сложность задания. Также можно пригласить подходящего исполнителя.",
      action: "Найти исполнителя",
      href: `/leaderboard?returnTo=${encodeURIComponent(`/campaigns/${campaign.id}`)}`
    });
  }

  if (stalled.length) {
    diagnostics.push({
      tone: "warning",
      title: `${stalled.length} ${stalled.length === 1 ? "работа ждёт продолжения" : "работы ждут продолжения"}`,
      text: "Исполнитель взял заказ, но больше суток не присылал черновик или ссылку.",
      action: "Написать в чат",
      href: "/chats"
    });
  }

  if (pendingDrafts.length) {
    diagnostics.push({
      tone: "critical",
      title: `${pendingDrafts.length} ${pendingDrafts.length === 1 ? "черновик ждёт проверки" : "черновика ждут проверки"}`,
      text: "Проверка задерживается больше 12 часов. Одобрите работу или отправьте точные правки.",
      action: "Проверить ниже",
      href: "#campaign-report-title"
    });
  }

  if (rejected.length >= 2 && rejected.length >= Math.ceil(campaign.submissions.length / 2)) {
    diagnostics.push({
      tone: "warning",
      title: "Много отклонённых работ",
      text: "Уточните требования и примеры: исполнители могут по-разному понимать текущий бриф."
    });
  }

  if (hoursLeft <= 48 && posted.length === 0 && active.length > 0) {
    diagnostics.push({
      tone: "critical",
      title: "Дедлайн близко, публикаций ещё нет",
      text: "До срока осталось меньше двух дней. Свяжитесь с исполнителями и уточните готовность.",
      action: "Открыть чаты",
      href: "/chats"
    });
  }

  if (!diagnostics.length) {
    diagnostics.push({
      tone: "good",
      title: active.length ? "Кампания идёт по плану" : "Кампания готова к исполнителям",
      text: active.length
        ? `${active.length} в работе, опубликовано ${posted.length}. Критичных задержек не найдено.`
        : "Бюджет и места доступны. Система продолжает подбирать исполнителей."
    });
  }

  return diagnostics.slice(0, 3);
}
