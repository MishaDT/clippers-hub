export type AuthIntent = "client" | "worker";

export function parseAuthIntent(value: unknown): AuthIntent | null {
  return value === "client" || value === "worker" ? value : null;
}

export function safeAuthReturnTo(value: unknown, intent: AuthIntent | null) {
  const path = String(value || "");
  if (path.startsWith("/") && !path.startsWith("//") && !path.includes("\\")) return path.slice(0, 240);
  return intent === "client" ? "/campaigns/new" : "/campaigns";
}
