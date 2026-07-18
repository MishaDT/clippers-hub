import { z } from "zod";
import { safeHttpsUrl } from "./safe-https-url.ts";

const shortText = (max: number) => z.string().trim().min(2).max(max);

export const businessLeadSchema = z.object({
  name: shortText(80),
  contact: shortText(120).refine(
    (value) => value.includes("@") || value.replace(/\D/g, "").length >= 10,
    "Укажите email, Telegram или телефон"
  ),
  contentUrl: z.string().trim().max(500).optional().default("").refine(
    (value) => !value || Boolean(safeHttpsUrl(value)),
    "Ссылка должна начинаться с https://"
  ),
  budgetRub: z.coerce.number().int().min(15_000).max(10_000_000),
  goal: shortText(500),
  utmSource: z.string().trim().max(80).optional().default(""),
  utmMedium: z.string().trim().max(80).optional().default(""),
  utmCampaign: z.string().trim().max(120).optional().default(""),
  website: z.string().max(0).optional().default(""),
  consent: z.literal(true)
});

export const businessLeadStatuses = ["NEW", "CONTACTED", "QUALIFIED", "DRAFT", "FUNDED", "WON", "LOST"] as const;

export const businessLeadStatusLabels: Record<(typeof businessLeadStatuses)[number], string> = {
  NEW: "Новая",
  CONTACTED: "Связались",
  QUALIFIED: "Подходит",
  DRAFT: "Черновик",
  FUNDED: "Пополнено",
  WON: "Запущена",
  LOST: "Не состоялась"
};
