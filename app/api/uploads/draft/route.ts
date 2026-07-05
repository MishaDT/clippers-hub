import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { assertAccountActive } from "@/lib/moderation";
import { prisma } from "@/lib/prisma";

const MAX_DRAFT_BYTES = 500 * 1024 * 1024;
const VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm"];

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Требуется вход" }, { status: 401 });
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: "Хранилище файлов ещё не подключено" }, { status: 503 });
  }
  try {
    await assertAccountActive(user);
    const body = await request.json() as HandleUploadBody;
    const result = await handleUpload({
      request,
      body,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        let submissionId = "";
        try {
          submissionId = String(JSON.parse(clientPayload || "{}").submissionId || "");
        } catch {}
        const expectedPrefix = `drafts/${submissionId}/`;
        if (
          !submissionId
          || !pathname.startsWith(expectedPrefix)
          || pathname.includes("..")
          || pathname.length > 240
        ) {
          throw new Error("Некорректный путь загрузки");
        }
        const submission = await prisma.submission.findFirst({
          where: {
            id: submissionId,
            workerId: user.id,
            status: "ACCEPTED",
            draftStatus: { in: ["NOT_SUBMITTED", "CHANGES_REQUESTED"] }
          },
          select: { id: true }
        });
        if (!submission) throw new Error("Черновик недоступен для загрузки");
        return {
          allowedContentTypes: VIDEO_TYPES,
          maximumSizeInBytes: MAX_DRAFT_BYTES,
          validUntil: Date.now() + 5 * 60_000,
          addRandomSuffix: true,
          allowOverwrite: false
        };
      }
    });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось подготовить загрузку";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
