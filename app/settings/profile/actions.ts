"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { moderateText } from "@/lib/moderation";
import { prisma } from "@/lib/prisma";
import {
  canChangeHandle,
  isPortfolioEligible,
  parseSocialLinks,
  parseSpecialties,
  validateHandle
} from "@/lib/profile-rules";

export async function updateProfileAction(formData: FormData) {
  const session = await requireUser();
  const user = await prisma.user.findUniqueOrThrow({ where: { id: session.id } });
  const name = String(formData.get("name") || "").trim().slice(0, 50);
  const bio = String(formData.get("bio") || "").trim().slice(0, 300);
  const { handle, ok } = validateHandle(formData.get("handle"));
  const specialties = parseSpecialties(formData.getAll("specialties"));
  const socialLinks = parseSocialLinks(formData.get("socialLinks"));
  const availabilityInput = String(formData.get("collabAvailability") || "ACTIVE_ROLE");
  const collabAvailability = (["ACTIVE_ROLE", "BOTH", "NONE"].includes(availabilityInput)
    ? availabilityInput
    : "ACTIVE_ROLE") as "ACTIVE_ROLE" | "BOTH" | "NONE";

  if (name.length < 2 || !ok) redirect("/settings/profile?error=fields");
  const moderation = await moderateText({
    text: `${name}\n${bio}`,
    contentType: "USER",
    authorId: user.id,
    context: "PUBLIC",
    payload: { entityId: user.id, source: "PROFILE" }
  });
  if (moderation.action === "BLOCK" || moderation.action === "REVIEW") redirect("/settings/profile?error=moderation");

  const changed = handle !== user.handle;
  if (changed && !canChangeHandle(user.handleChangedAt)) redirect("/settings/profile?error=cooldown");
  if (changed) {
    const occupied = await prisma.user.findFirst({ where: { handle, NOT: { id: user.id } }, select: { id: true } });
    const alias = await prisma.userHandleAlias.findUnique({ where: { handle }, select: { userId: true } });
    if (occupied || (alias && alias.userId !== user.id)) redirect("/settings/profile?error=handle");
  }

  try {
    await prisma.$transaction(async (tx) => {
      if (changed) {
        await tx.userHandleAlias.upsert({
          where: { handle: user.handle },
          create: { userId: user.id, handle: user.handle },
          update: { userId: user.id }
        });
      }
      await tx.user.update({
        where: { id: user.id },
        data: {
          name,
          handle,
          bio,
          specialtiesJson: JSON.stringify(specialties),
          socialLinksJson: JSON.stringify(socialLinks),
          collabAvailability,
          handleChangedAt: changed ? new Date() : user.handleChangedAt
        }
      });
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      redirect("/settings/profile?error=handle");
    }
    throw error;
  }
  revalidatePath("/profile");
  revalidatePath(`/clippers/${handle}`);
  revalidatePath(`/profiles/${handle}`);
  redirect("/settings/profile?saved=1");
}

export async function pinPortfolioAction(formData: FormData) {
  const user = await requireUser();
  const submissionId = String(formData.get("submissionId") || "");
  const submission = await prisma.submission.findFirst({
    where: { id: submissionId, workerId: user.id },
    select: { id: true, status: true, verifiedAt: true }
  });
  if (!submission || !isPortfolioEligible(submission.status, submission.verifiedAt)) {
    redirect("/settings/profile?error=portfolio");
  }
  const pins = await prisma.portfolioPin.findMany({ where: { userId: user.id }, orderBy: { position: "asc" } });
  if (pins.some((pin) => pin.submissionId === submissionId)) redirect("/settings/profile");
  const free = [0, 1, 2, 3, 4, 5].find((position) => !pins.some((pin) => pin.position === position));
  if (free === undefined) redirect("/settings/profile?error=limit");
  await prisma.portfolioPin.create({ data: { userId: user.id, submissionId, position: free } });
  revalidatePath(`/clippers/${user.handle}`);
  redirect("/settings/profile?saved=portfolio");
}

export async function removePortfolioPinAction(formData: FormData) {
  const user = await requireUser();
  await prisma.portfolioPin.deleteMany({
    where: { id: String(formData.get("pinId") || ""), userId: user.id }
  });
  revalidatePath(`/clippers/${user.handle}`);
  redirect("/settings/profile?saved=portfolio");
}

export async function movePortfolioPinAction(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("pinId") || "");
  const direction = String(formData.get("direction")) === "up" ? -1 : 1;
  const pin = await prisma.portfolioPin.findFirst({ where: { id, userId: user.id } });
  if (!pin) redirect("/settings/profile");
  const other = await prisma.portfolioPin.findFirst({
    where: { userId: user.id, position: pin.position + direction }
  });
  if (!other) redirect("/settings/profile");
  await prisma.$transaction([
    prisma.portfolioPin.update({ where: { id: pin.id }, data: { position: -1 } }),
    prisma.portfolioPin.update({ where: { id: other.id }, data: { position: pin.position } }),
    prisma.portfolioPin.update({ where: { id: pin.id }, data: { position: other.position } })
  ]);
  revalidatePath(`/clippers/${user.handle}`);
  redirect("/settings/profile?saved=portfolio");
}
