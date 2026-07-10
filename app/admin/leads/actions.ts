"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { businessLeadStatuses } from "@/lib/business-lead";
import { stringify } from "@/lib/json";
import { prisma } from "@/lib/prisma";

export async function updateBusinessLeadAction(formData: FormData) {
  const admin = await requireAdmin();
  const leadId = String(formData.get("leadId") || "");
  const statusInput = String(formData.get("status") || "");
  const status = businessLeadStatuses.includes(statusInput as (typeof businessLeadStatuses)[number])
    ? statusInput as (typeof businessLeadStatuses)[number]
    : "NEW";
  const assignedAdminId = String(formData.get("assignedAdminId") || "") || null;
  const notes = String(formData.get("notes") || "").trim().slice(0, 2000);

  const lead = await prisma.businessLead.findUnique({ where: { id: leadId }, select: { id: true, status: true } });
  if (!lead) redirect("/admin/leads?error=missing");
  if (assignedAdminId) {
    const assignee = await prisma.user.findFirst({ where: { id: assignedAdminId, role: "ADMIN" }, select: { id: true } });
    if (!assignee) redirect("/admin/leads?error=assignee");
  }

  await prisma.$transaction([
    prisma.businessLead.update({ where: { id: leadId }, data: { status, assignedAdminId, notes } }),
    prisma.auditLog.create({
      data: {
        userId: admin.id,
        action: "BUSINESS_LEAD_UPDATED",
        entity: "BusinessLead",
        entityId: leadId,
        metadata: stringify({ from: lead.status, to: status, assignedAdminId })
      }
    })
  ]);
  revalidatePath("/admin/leads");
  revalidatePath("/admin");
  redirect("/admin/leads?updated=1");
}
