export const REPORT_REASONS = [
  { value: "SPAM", label: "Спам или реклама" },
  { value: "FRAUD", label: "Мошенничество" },
  { value: "ILLEGAL", label: "Запрещённый контент" },
  { value: "HARASSMENT", label: "Оскорбления или травля" },
  { value: "IMPERSONATION", label: "Выдаёт себя за другого" },
  { value: "OTHER", label: "Другое" }
] as const;

export function reportReasonLabel(value: string) {
  return REPORT_REASONS.find((item) => item.value === value)?.label ?? null;
}

export function normalizeRussianReport(value: string) {
  return value.normalize("NFKC").replace(/[\u200B-\u200D\uFEFF]/g, "").replace(/\s+/g, " ").trim();
}

export function isSafeRussianReport(value: string) {
  const text = normalizeRussianReport(value);
  const words = text ? text.split(" ").length : 0;
  return text.length >= 5
    && text.length <= 220
    && words <= 35
    && /^[а-яёА-ЯЁ0-9\s.,!?():;«»"'—-]+$/.test(text)
    && !/(https?:|www\.|<|>|javascript:)/i.test(text);
}
