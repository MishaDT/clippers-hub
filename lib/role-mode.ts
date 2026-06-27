import "server-only";

import type { User } from "@prisma/client";
import { cookies } from "next/headers";

export type RoleMode = "worker" | "client";

export const ROLE_MODE_COOKIE = "rp_role_mode";

export function canUseRoleMode(role: User["role"], mode: RoleMode) {
  if (role === "ADMIN" || role === "BOTH") return true;
  return mode === "client" ? role === "CLIENT" : role === "WORKER";
}

export async function getActiveRoleMode(user: Pick<User, "role">): Promise<RoleMode> {
  if (user.role === "CLIENT") return "client";
  if (user.role === "WORKER") return "worker";

  const selected = (await cookies()).get(ROLE_MODE_COOKIE)?.value;
  return selected === "client" ? "client" : "worker";
}
