import "server-only";

import type { SupportCategory, SupportPriority, SupportStatus } from "@prisma/client";

export const supportCategoryLabels: Record<SupportCategory, string> = {
  PAYMENT: "Оплата и вывод",
  CAMPAIGN: "Кампания",
  SUBMISSION: "Работа и проверка",
  ACCOUNT: "Аккаунт",
  SECURITY: "Безопасность",
  OTHER: "Другое"
};

export const supportStatusLabels: Record<SupportStatus, string> = {
  OPEN: "Новое",
  IN_PROGRESS: "В работе",
  WAITING_USER: "Ждём ответа",
  RESOLVED: "Решено",
  CLOSED: "Закрыто"
};

export const supportPriorityLabels: Record<SupportPriority, string> = {
  LOW: "Низкий",
  NORMAL: "Обычный",
  HIGH: "Высокий",
  URGENT: "Срочный"
};

export const supportCategories = Object.keys(supportCategoryLabels) as SupportCategory[];
export const supportStatuses = Object.keys(supportStatusLabels) as SupportStatus[];
export const supportPriorities = Object.keys(supportPriorityLabels) as SupportPriority[];

