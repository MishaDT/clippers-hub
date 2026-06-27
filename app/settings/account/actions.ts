"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function unlinkAccountProviderAction(formData: FormData) {
  const user = await requireUser();
  const oauthAccountId = String(formData.get("oauthAccountId") || "");
  if (!oauthAccountId) redirect("/settings/account?error=oauth");

  await prisma.oAuthAccount.deleteMany({
    where: { id: oauthAccountId, userId: user.id }
  });
  revalidatePath("/settings/account");
  redirect("/settings/account?updated=oauth");
}
