import "server-only";

export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  const source = origin || request.headers.get("referer");
  if (!source) return true;

  try {
    return new URL(source).host === host;
  } catch {
    return false;
  }
}

const COMMON_PASSWORDS = new Set(
  [
    "123456",
    "123456789",
    "12345678",
    "1234567890",
    "password",
    "password1",
    "passw0rd",
    "qwerty",
    "qwerty123",
    "abc123",
    "111111",
    "000000",
    "admin",
    "welcome",
    "letmein",
    "zxcvbnm",
    "пароль",
    "йцукен",
    "reelpay",
    "clippers"
  ].map((value) => value.toLowerCase())
);

export function validatePassword(password: string, email?: string): string | null {
  if (password.length < 8) return "Пароль слишком короткий: минимум 8 символов.";
  if (password.length > 72) return "Пароль слишком длинный: максимум 72 символа.";
  if (COMMON_PASSWORDS.has(password.toLowerCase())) return "Этот пароль слишком простой. Придумайте другой.";

  const local = email?.split("@")[0]?.toLowerCase();
  if (local && local.length >= 3 && password.toLowerCase().includes(local)) {
    return "Не используйте email как пароль.";
  }

  return null;
}

export function normalizeEmail(value: FormDataEntryValue | null) {
  return String(value ?? "").trim().toLowerCase();
}
