"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { stringify } from "@/lib/json";
import { prisma } from "@/lib/prisma";
import { fetchStoreMetadata, safeHttpsUrl } from "@/lib/store";
import { syncPampaduCatalog } from "@/lib/pampadu-catalog";
import { processStoreImage } from "@/lib/store-image";
import { boundedInteger } from "@/lib/numbers";

const kinds = ["RP_REWARD", "PARTNER_LINK", "PAMPADU_WIDGET"] as const;
const statuses = ["NEW", "CONFIRMED", "FULFILLED", "CANCELLED"] as const;

function text(value: FormDataEntryValue | null, max = 500) {
  return String(value || "").trim().slice(0, max);
}

async function imageData(file: FormDataEntryValue | null, qr = false) {
  if (!(file instanceof File) || !file.size) return Promise.resolve<string | null>(null);
  const normalized = await processStoreImage(Buffer.from(await file.arrayBuffer()), file.type, qr);
  return `data:${normalized.contentType};base64,${normalized.buffer.toString("base64")}`;
}

export async function adminSaveStoreOfferAction(formData: FormData) {
  const admin = await requireAdmin();
  const id = text(formData.get("id"), 80);
  const kindInput = text(formData.get("kind"), 30);
  const kind = kinds.includes(kindInput as (typeof kinds)[number]) ? kindInput : "RP_REWARD";
  const category = text(formData.get("category"), 60) || null;
  const provider = text(formData.get("provider"), 140) || null;
  const url = safeHttpsUrl(formData.get("url"));
  let title = text(formData.get("title"), 120);
  let description = text(formData.get("description"), 600);
  let imageUrl = safeHttpsUrl(formData.get("imageUrl"));
  const qrImageUrl = safeHttpsUrl(formData.get("qrImageUrl"));
  const existing = id
    ? await prisma.storeOffer.findUnique({ where: { id }, select: { imageUrl: true, qrImageUrl: true } })
    : null;
  if (url && (!title || !description || !imageUrl)) {
    try {
      const metadata = await fetchStoreMetadata(url);
      title ||= metadata.title;
      description ||= metadata.description;
      imageUrl ||= metadata.imageUrl;
    } catch {
      // Manual fields remain available when a partner blocks metadata fetching.
    }
  }
  const uploadedImage = await imageData(formData.get("imageFile"));
  const uploadedQr = await imageData(formData.get("qrFile"), true);
  title ||= kind === "PAMPADU_WIDGET" ? "Партнёрская витрина Pampadu" : "Предложение";
  description ||= kind === "RP_REWARD" ? "Награда магазина ReelPay" : "Предложение партнёра";
  const priceRp = boundedInteger(formData.get("priceRp"), { min: 0, max: 1_000_000, fallback: 0 });
  const stockRaw = text(formData.get("stock"), 20);
  const stock = stockRaw === "" ? null : boundedInteger(stockRaw, { min: 0, max: 1_000_000, fallback: 0 });
  const data = {
    kind,
    category,
    provider,
    title,
    description,
    url,
    imageUrl: uploadedImage || imageUrl || existing?.imageUrl || null,
    qrImageUrl: uploadedQr || qrImageUrl || existing?.qrImageUrl || null,
    priceRp,
    stock,
    active: formData.get("active") === "on",
    featured: formData.get("featured") === "on",
    sortOrder: boundedInteger(formData.get("sortOrder"), { min: -1_000, max: 1_000, fallback: 0 })
  };
  const offer = id
    ? await prisma.storeOffer.update({ where: { id }, data })
    : await prisma.storeOffer.create({ data });
  await prisma.auditLog.create({
    data: { userId: admin.id, action: id ? "ADMIN_STORE_UPDATE" : "ADMIN_STORE_CREATE", entity: "StoreOffer", entityId: offer.id, metadata: stringify(data) }
  });
  revalidatePath("/store");
  revalidatePath("/leaderboard");
  revalidatePath("/admin/store");
  redirect("/admin/store?saved=1");
}

export async function adminImportPampaduCatalogAction() {
  const admin = await requireAdmin();
  try {
    const count = await syncPampaduCatalog(admin.id);
    revalidatePath("/store");
    revalidatePath("/admin/store");
    redirect(`/admin/store?imported=${count}`);
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    redirect("/admin/store?importError=1");
  }
}

export async function adminSetStoreOfferActiveAction(formData: FormData) {
  const admin = await requireAdmin();
  const id = text(formData.get("id"), 80);
  const active = formData.get("active") === "1";
  await prisma.storeOffer.update({ where: { id }, data: { active } });
  await prisma.auditLog.create({
    data: { userId: admin.id, action: "ADMIN_STORE_ACTIVE", entity: "StoreOffer", entityId: id, metadata: stringify({ active }) }
  });
  revalidatePath("/store");
  revalidatePath("/leaderboard");
  revalidatePath("/admin/store");
}

export async function adminUpdateRedemptionAction(formData: FormData) {
  const admin = await requireAdmin();
  const id = text(formData.get("id"), 80);
  const statusInput = text(formData.get("status"), 30);
  const status = statuses.includes(statusInput as (typeof statuses)[number]) ? statusInput : "NEW";
  const note = text(formData.get("adminNote"), 500) || null;
  await prisma.$transaction(async (tx) => {
    const redemption = await tx.storeRedemption.findUniqueOrThrow({ where: { id }, include: { offer: true } });
    if (redemption.status === "CANCELLED" && status !== "CANCELLED") throw new Error("CANCELLED_FINAL");
    if (status === "CANCELLED" && !redemption.refundedAt) {
      await tx.user.update({
        where: { id: redemption.userId },
        data: {
          rpBalance: { increment: redemption.costRp },
          rpPurchasedBalance: { increment: redemption.purchasedRpUsed }
        }
      });
      if (redemption.offer.stock !== null) {
        await tx.storeOffer.update({ where: { id: redemption.offerId }, data: { stock: { increment: 1 } } });
      }
      await tx.rpTransaction.create({
        data: {
          userId: redemption.userId,
          amount: redemption.costRp,
          type: "STORE_REFUND",
          reference: `store:refund:${redemption.id}`,
          metadataJson: stringify({ redemptionId: redemption.id, purchasedRestored: redemption.purchasedRpUsed })
        }
      });
    }
    await tx.storeRedemption.update({
      where: { id },
      data: {
        status,
        adminNote: note,
        fulfilledAt: status === "FULFILLED" ? new Date() : redemption.fulfilledAt,
        refundedAt: status === "CANCELLED" && !redemption.refundedAt ? new Date() : redemption.refundedAt
      }
    });
    await tx.auditLog.create({
      data: { userId: admin.id, action: "ADMIN_STORE_REDEMPTION", entity: "StoreRedemption", entityId: id, metadata: stringify({ status, note }) }
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  revalidatePath("/store");
  revalidatePath("/admin/store");
  revalidatePath("/profile");
  redirect("/admin/store?redemption=updated");
}
