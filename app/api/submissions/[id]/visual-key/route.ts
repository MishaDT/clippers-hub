import QRCode from "qrcode";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { visualProofMatches, visualProofToken } from "@/lib/visual-proof";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const submission = await prisma.submission.findFirst({
    where: { id: (await params).id, workerId: user.id },
    select: { id: true, trackingCode: true, visualProofTokenHash: true, campaign: { select: { strictVerification: true } } }
  });
  if (!submission || !submission.campaign.strictVerification) return new Response("Not found", { status: 404 });
  const token = visualProofToken(submission.id, submission.trackingCode);
  if (!visualProofMatches(token, submission.visualProofTokenHash)) return new Response("Proof key mismatch", { status: 409 });

  const format = new URL(request.url).searchParams.get("format") === "svg" ? "svg" : "png";
  const common = { errorCorrectionLevel: "H" as const, margin: 2, color: { dark: "#0a0c09", light: "#c6ff00" }, width: 512 };
  if (format === "svg") {
    const svg = await QRCode.toString(token, { ...common, type: "svg" });
    return new Response(svg, {
      headers: { "Content-Type": "image/svg+xml", "Content-Disposition": `attachment; filename="reelpay-${submission.id}.svg"`, "Cache-Control": "private, no-store" }
    });
  }
  const png = await QRCode.toBuffer(token, { ...common, type: "png" });
  return new Response(new Uint8Array(png), {
    headers: { "Content-Type": "image/png", "Content-Disposition": `attachment; filename="reelpay-${submission.id}.png"`, "Cache-Control": "private, no-store" }
  });
}
