import { enabledProviders, type ProviderId } from "@/lib/oauth";

const AUTH_ERRORS: Record<string, string> = {
  too_many: "Слишком много попыток. Подождите минуту и попробуйте снова.",
  bad_credentials: "Неверный email или пароль.",
  invalid: "Проверьте поля формы.",
  weak_password: "Пароль слишком простой. Используйте более длинную фразу.",
  register_failed: "Не получилось создать аккаунт. Проверьте данные или попробуйте войти.",
  provider_unconfigured: "Этот способ входа ещё не настроен. Нужны ключи провайдера.",
  oauth_denied: "Вход отменён.",
  oauth_state: "Сессия входа устарела. Попробуйте ещё раз.",
  oauth_no_email: "Соцсеть не передала подтверждённый email. Войдите по email или другим способом.",
  oauth_failed: "Не удалось войти через соцсеть. Попробуйте ещё раз."
};

export function authErrorText(code?: string | string[]) {
  const key = Array.isArray(code) ? code[0] : code;
  return key ? AUTH_ERRORS[key] ?? null : null;
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
      <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.46 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z" />
    </svg>
  );
}

function LetterMark({ bg, fg, text, serif }: { bg: string; fg: string; text: string; serif?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <rect width="24" height="24" rx="6" fill={bg} />
      <text
        x="12"
        y={serif ? 17 : 16}
        fontSize={serif ? 13 : 10}
        fontWeight="800"
        textAnchor="middle"
        fill={fg}
        fontFamily={serif ? "Georgia, 'Times New Roman', serif" : "Inter, system-ui, sans-serif"}
      >
        {text}
      </text>
    </svg>
  );
}

const META: Record<ProviderId, { label: string; mark: React.ReactNode }> = {
  google: { label: "Google", mark: <GoogleMark /> },
  vk: { label: "VK ID", mark: <LetterMark bg="#0077FF" fg="#fff" text="VK" /> },
  yandex: { label: "Yandex", mark: <LetterMark bg="#FC3F1D" fg="#fff" text="Я" serif /> }
};

const ALL: ProviderId[] = ["google", "vk", "yandex"];

export function SocialAuth({ mode = "login" }: { mode?: "login" | "register" }) {
  const enabled = enabledProviders();
  const verb = mode === "register" ? "регистрация" : "вход";

  return (
    <div className="social-auth">
      <div className="social-sep"><span>или {verb} через</span></div>
      <div className="social-grid">
        {ALL.map((id) => {
          const inner = (
            <>
              {META[id].mark}
              <span>{META[id].label}</span>
            </>
          );
          return enabled.includes(id) ? (
            <a className={`social-btn social-${id}`} href={`/api/auth/oauth/${id}`} key={id}>
              {inner}
            </a>
          ) : (
            <span className="social-btn social-off" key={id} aria-disabled="true" title="Нужны OAuth-ключи в Vercel">
              {inner}
            </span>
          );
        })}
      </div>
    </div>
  );
}
