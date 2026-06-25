"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";
import { hashPassword } from "@/lib/auth";
import { stringify } from "@/lib/json";
import { parseRubToCents } from "@/lib/money";

const roles = ["ADMIN", "CLIENT", "WORKER", "BOTH"] as const;
const ranks = ["BRONZE", "SILVER", "GOLD", "DIAMOND", "LEGENDARY"] as const;
const kycStatuses = ["NONE", "PENDING", "VERIFIED"] as const;
const txStatuses = ["PENDING", "COMPLETED", "FAILED", "REVERSED"] as const;

function clean(value: FormDataEntryValue | null, fallback = "") {
  return String(value ?? fallback).trim();
}

async function logAdmin(adminId: string, action: string, entity: string, entityId: string, metadata: Record<string, unknown>) {
  await prisma.auditLog.create({
    data: { userId: adminId, action, entity, entityId, metadata: stringify(metadata) }
  });
}

export async function adminCreateUserAction(formData: FormData) {
  const admin = await requireAdmin();
  const email = clean(formData.get("email")).toLowerCase();
  const name = clean(formData.get("name"), "New user");
  const handleBase = clean(formData.get("handle"), email.split("@")[0] || "user").replace(/[^a-z0-9_]/gi, "").toLowerCase().slice(0, 16);
  const roleInput = clean(formData.get("role"), "WORKER");
  const role = roles.includes(roleInput as (typeof roles)[number]) ? roleInput : "WORKER";
  if (!email.includes("@") || !handleBase) redirect("/admin/users?error=create");

  const password = randomBytes(18).toString("base64url");
  const user = await prisma.user.create({
    data: {
      email,
      name,
      handle: `${handleBase}${Math.floor(Math.random() * 900 + 100)}`,
      passwordHash: await hashPassword(password),
      role: role as "ADMIN" | "CLIENT" | "WORKER" | "BOTH",
      referralCode: `${handleBase}${Math.floor(Math.random() * 9000 + 1000)}`.toUpperCase().slice(0, 12)
    }
  });
  await logAdmin(admin.id, "ADMIN_USER_CREATE", "User", user.id, { email, role });
  revalidatePath("/admin/users");
  redirect(`/admin/users/${user.id}?created=1`);
}

export async function adminUpdateUserAction(formData: FormData) {
  const admin = await requireAdmin();
  const userId = clean(formData.get("userId"));
  const roleInput = clean(formData.get("role"));
  const rankInput = clean(formData.get("rank"));
  const kycInput = clean(formData.get("kycStatus"));
  const trustScore = Math.min(100, Math.max(0, Number(formData.get("trustScore") || 100)));
  if (!userId) redirect("/admin/users");

  const data = {
    role: (roles.includes(roleInput as (typeof roles)[number]) ? roleInput : "WORKER") as "ADMIN" | "CLIENT" | "WORKER" | "BOTH",
    rank: (ranks.includes(rankInput as (typeof ranks)[number]) ? rankInput : "BRONZE") as "BRONZE" | "SILVER" | "GOLD" | "DIAMOND" | "LEGENDARY",
    kycStatus: (kycStatuses.includes(kycInput as (typeof kycStatuses)[number]) ? kycInput : "NONE") as "NONE" | "PENDING" | "VERIFIED",
    trustScore
  };

  await prisma.user.update({ where: { id: userId }, data });
  await logAdmin(admin.id, "ADMIN_USER_UPDATE", "User", userId, data);
  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${userId}`);
  redirect(`/admin/users/${userId}?saved=1`);
}

export async function adminAdjustBalanceAction(formData: FormData) {
  const admin = await requireAdmin();
  const userId = clean(formData.get("userId"));
  const amountCents = parseRubToCents(formData.get("amount"));
  const direction = clean(formData.get("direction"), "plus");
  const reason = clean(formData.get("reason"), "admin adjustment").slice(0, 180);
  if (!userId || amountCents <= 0) redirect(`/admin/users/${userId || ""}?error=amount`);

  const signed = direction === "minus" ? -amountCents : amountCents;
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { balanceCents: { increment: signed } } }),
    prisma.transaction.create({
      data: {
        userId,
        amountCents: signed,
        feeCents: 0,
        netCents: signed,
        type: "ADJUSTMENT",
        status: "COMPLETED",
        provider: "admin",
        providerData: stringify({ reason, adminId: admin.id })
      }
    }),
    prisma.auditLog.create({
      data: { userId: admin.id, action: "ADMIN_BALANCE_ADJUST", entity: "User", entityId: userId, metadata: stringify({ amountCents: signed, reason }) }
    })
  ]);
  revalidatePath(`/admin/users/${userId}`);
  redirect(`/admin/users/${userId}?balance=1`);
}

export async function adminUpdateTransactionAction(formData: FormData) {
  const admin = await requireAdmin();
  const transactionId = clean(formData.get("transactionId"));
  const statusInput = clean(formData.get("status"));
  const status = txStatuses.includes(statusInput as (typeof txStatuses)[number]) ? statusInput : "PENDING";
  const tx = await prisma.transaction.update({ where: { id: transactionId }, data: { status: status as "PENDING" | "COMPLETED" | "FAILED" | "REVERSED" } });
  await logAdmin(admin.id, "ADMIN_TRANSACTION_UPDATE", "Transaction", transactionId, { status, userId: tx.userId });
  revalidatePath("/admin/finance");
  revalidatePath(`/admin/users/${tx.userId}`);
  redirect(`/admin/finance?updated=1`);
}

export async function adminModerateSubmissionAction(formData: FormData) {
  const admin = await requireAdmin();
  const submissionId = clean(formData.get("submissionId"));
  const decision = clean(formData.get("decision"));
  const note = clean(formData.get("note")).slice(0, 180);
  if (!submissionId) redirect("/admin/security");

  const status = decision === "approve" ? "VERIFIED" : "REJECTED";
  await prisma.$transaction([
    prisma.submission.update({
      where: { id: submissionId },
      data: {
        status: status as "VERIFIED" | "REJECTED",
        fraudScore: decision === "approve" ? 20 : 95,
        verifiedAt: decision === "approve" ? new Date() : null
      }
    }),
    prisma.auditLog.create({
      data: {
        userId: admin.id,
        action: decision === "approve" ? "ADMIN_SUBMISSION_APPROVE" : "ADMIN_SUBMISSION_REJECT",
        entity: "Submission",
        entityId: submissionId,
        metadata: stringify({ note })
      }
    })
  ]);
  revalidatePath("/admin/security");
  revalidatePath("/admin/content");
  redirect("/admin/security?moderated=1");
}

export async function adminDeleteUserAction(formData: FormData) {
  const admin = await requireAdmin();
  const userId = clean(formData.get("userId"));
  const confirmation = clean(formData.get("confirmation")).toUpperCase();
  if (!userId || confirmation !== "DELETE") redirect(`/admin/users/${userId}?error=delete_confirm`);
  if (userId === admin.id) redirect(`/admin/users/${userId}?error=self_delete`);

  await logAdmin(admin.id, "ADMIN_USER_DELETE", "User", userId, {});
  await prisma.user.delete({ where: { id: userId } });
  revalidatePath("/admin/users");
  redirect("/admin/users?deleted=1");
}
