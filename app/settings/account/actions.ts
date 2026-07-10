"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { MAX_AVATAR_BYTES, processAvatarImage } from "@/lib/avatar-image";
import { prisma } from "@/lib/prisma";
import { stringify } from "@/lib/json";
import { normalizePayoutDetails } from "@/lib/payout-details";
import { revokeTikTokConnection } from "@/lib/social-platforms";

export async function updatePayoutDetailsAction(formData: FormData) {
  const user = await requireUser();
  const details = normalizePayoutDetails({
    payoutFullName: formData.get("payoutFullName"),
    payoutInn: formData.get("payoutInn"),
    payoutAccount: formData.get("payoutAccount"),
    payoutBik: formData.get("payoutBik"),
    payoutPhone: formData.get("payoutPhone")
  });
  const confirmed = formData.get("selfEmployedConfirmed") === "on";

  if (!details || !confirmed) {
    redirect("/settings/account?payout=invalid");
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: {
        ...details,
        selfEmployedConfirmedAt: user.selfEmployedConfirmedAt || new Date()
      }
    }),
    prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "PAYOUT_DETAILS_UPDATED",
        entity: "User",
        entityId: user.id,
        metadata: stringify({ innLast4: details.payoutInn.slice(-4), accountLast4: details.payoutAccount.slice(-4) })
      }
    })
  ]);
  revalidatePath("/settings/account");
  revalidatePath("/wallet");
  redirect("/settings/account?payout=saved");
}

function refreshAvatarPages(handle: string) {
  revalidateTag("campaigns");
  revalidatePath("/profile");
  revalidatePath("/settings/account");
  revalidatePath("/campaigns");
  revalidatePath(`/clippers/${handle}`);
}

export async function updateAvatarAction(formData: FormData) {
  const user = await requireUser();
  const file = formData.get("avatar");
  if (!(file instanceof File) || !file.size || file.size > MAX_AVATAR_BYTES) {
    redirect("/settings/account?avatar=invalid");
  }

  let output: Buffer;
  try {
    output = await processAvatarImage(Buffer.from(await file.arrayBuffer()), file.type);
  } catch {
    redirect("/settings/account?avatar=invalid");
  }

  const avatar = `data:image/webp;base64,${output.toString("base64")}`;

  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { avatar } }),
    prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "PROFILE_AVATAR_UPDATED",
        entity: "User",
        entityId: user.id,
        metadata: stringify({ sourceType: file.type, outputType: "image/webp", outputBytes: output.length })
      }
    })
  ]);
  refreshAvatarPages(user.handle);
  redirect("/settings/account?avatar=updated");
}

export async function removeAvatarAction() {
  const user = await requireUser();
  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { avatar: null } }),
    prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "PROFILE_AVATAR_REMOVED",
        entity: "User",
        entityId: user.id
      }
    })
  ]);
  refreshAvatarPages(user.handle);
  redirect("/settings/account?avatar=removed");
}

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

export async function unlinkSocialPlatformAction(formData: FormData) {
  const user = await requireUser();
  const socialAccountId = String(formData.get("socialAccountId") || "");
  if (!socialAccountId) redirect("/settings/account?social=failed");

  const account = await prisma.socialAccount.findFirst({
    where: { id: socialAccountId, userId: user.id },
    select: { id: true, platform: true, accessToken: true }
  });
  if (!account) redirect("/settings/account?social=failed");

  if (account.platform === "TIKTOK") {
    await revokeTikTokConnection(account.accessToken);
  }
  await prisma.$transaction([
    prisma.socialAccount.delete({ where: { id: account.id } }),
    prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "SOCIAL_ACCOUNT_DISCONNECTED",
        entity: "SocialAccount",
        entityId: account.id,
        metadata: stringify({ platform: account.platform })
      }
    })
  ]);
  revalidatePath("/settings/account");
  redirect("/settings/account?social=disconnected");
}
