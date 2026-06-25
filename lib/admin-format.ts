export function eventLabel(type: string) {
  const labels: Record<string, string> = {
    PAGE_VIEW: "Просмотр",
    LOGIN_SUCCESS: "Вход",
    REGISTER_SUCCESS: "Регистрация",
    OAUTH_LOGIN: "Вход через соцсеть",
    OAUTH_REGISTER: "Регистрация через соцсеть",
    OAUTH_LINK: "Привязка соцсети",
    LOGOUT: "Выход",
    CTA_CLICK: "Клик"
  };
  return labels[type] || type;
}

export function providerLabel(provider: string | null | undefined) {
  if (provider === "google") return "Google";
  if (provider === "vk") return "VK ID";
  if (provider === "yandex") return "Yandex";
  return "Email";
}

export function roleLabel(role: string) {
  if (role === "ADMIN") return "Админ";
  if (role === "CLIENT") return "Заказчик";
  if (role === "WORKER") return "Клиппер";
  if (role === "BOTH") return "Обе роли";
  return role;
}

export function statusLabel(status: string) {
  const labels: Record<string, string> = {
    DRAFT: "Черновик",
    ACTIVE: "Активно",
    LOW_BUDGET: "Мало бюджета",
    PAUSED: "Пауза",
    COMPLETED: "Завершено",
    ACCEPTED: "Взято",
    POSTED: "Отправлено",
    VERIFIED: "Проверено",
    THRESHOLD_MET: "Порог достигнут",
    SETTLING: "Ожидает выплату",
    PAID: "Оплачено",
    REJECTED: "Отклонено",
    PENDING: "Ожидает",
    FAILED: "Ошибка",
    REVERSED: "Возврат"
  };
  return labels[status] || status;
}

export function shortDate(date: Date) {
  return date.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function fullDate(date: Date) {
  return date.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function clampPage(value: unknown) {
  return Math.max(1, Number(value || 1) || 1);
}

export function pageHref(base: string, params: Record<string, string | number | undefined>, page: number) {
  const url = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") url.set(key, String(value));
  });
  if (page > 1) url.set("page", String(page));
  else url.delete("page");
  const qs = url.toString();
  return qs ? `${base}?${qs}` : base;
}
