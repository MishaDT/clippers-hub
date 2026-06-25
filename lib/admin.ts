import "server-only";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

function adminEmails() {
  return new Set(
    String(process.env.ADMIN_EMAILS || "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean)
  );
}

export function canAccessAdmin(user: { role: string; email: string } | null | undefined) {
  if (!user) return false;
  if (user.role === "ADMIN") return true;
  return adminEmails().has(user.email.toLowerCase());
}

export async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canAccessAdmin(user)) redirect("/feed");
  return user;
}
