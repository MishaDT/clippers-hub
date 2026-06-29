"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { assertAccountActive } from "@/lib/moderation";
import { prisma } from "@/lib/prisma";
import { splitRpSpend } from "@/lib/rp";
import { stringify } from "@/lib/json";

export async function redeemStoreOfferAction(formData: FormData) {
  const user = await requireUser();
  await assertAccountActive(user);
  const offerId = String(formData.get("offerId") || "");
  let result = "ok";
  try {
    await prisma.$transaction(async (tx) => {
      const [offer, account] = await Promise.all([
        tx.storeOffer.findFirst({ where: { id: offerId, active: true, kind: "RP_REWARD" } }),
        tx.user.findUniqueOrThrow({ where: { id: user.id }, select: { email: true, rpBalance: true, rpPurchasedBalance: true } })
      ]);
      if (!offer || offer.priceRp <= 0) throw new Error("NOT_AVAILABLE");
      if (offer.stock !== null && offer.stock <= 0) throw new Error("OUT_OF_STOCK");
      if (account.rpBalance < offer.priceRp) throw new Error("RP_BALANCE");
      const { purchasedUsed } = splitRpSpend(account.rpBalance, account.rpPurchasedBalance, offer.priceRp);
      const redemption = await tx.storeRedemption.create({
        data: {
          userId: user.id,
          offerId: offer.id,
          costRp: offer.priceRp,
          purchasedRpUsed: purchasedUsed,
          contactEmail: account.email
        }
      });
      const updated = await tx.user.updateMany({
        where: { id: user.id, rpBalance: { gte: offer.priceRp }, rpPurchasedBalance: { gte: purchasedUsed } },
        data: { rpBalance: { decrement: offer.priceRp }, rpPurchasedBalance: { decrement: purchasedUsed } }
      });
      if (!updated.count) throw new Error("RP_BALANCE");
      if (offer.stock !== null) {
        const stock = await tx.storeOffer.updateMany({
          where: { id: offer.id, stock: { gt: 0 } },
          data: { stock: { decrement: 1 } }
        });
        if (!stock.count) throw new Error("OUT_OF_STOCK");
      }
      await tx.rpTransaction.create({
        data: {
          userId: user.id,
          amount: -offer.priceRp,
          type: "STORE_PURCHASE",
          reference: `store:purchase:${redemption.id}`,
          metadataJson: stringify({ offerId: offer.id, redemptionId: redemption.id, purchasedUsed })
        }
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    result = error instanceof Error ? error.message.toLowerCase() : "failed";
  }
  revalidatePath("/store");
  revalidatePath("/profile");
  redirect(`/store?purchase=${encodeURIComponent(result)}`);
}
