export function safeReturnTo(value: unknown, fallback: string) {
  const path = String(value || "");
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\") || /[\r\n]/.test(path)) return fallback;
  return path;
}

export function withReturnTo(path: string, returnTo: string) {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}returnTo=${encodeURIComponent(returnTo)}`;
}
