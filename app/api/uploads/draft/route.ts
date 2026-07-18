import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { assertAccountActive } from "@/lib/moderation";
import { prisma } from "@/lib/prisma";
import { strictSameOrigin } from "@/lib/security";
import { readJsonWithLimit } from "@/lib/request-json";
import { rateLimit } from "@/lib/rate-limit";

const MAX_DRAFT_BYTES = 500 * 1024 * 1024;
const VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm"];

class DraftUploadError extends Error {
  constructor(readonly code: "INVALID_PATH" | "DRAFT_UNAVAILABLE" | "UPLOAD_LIMIT") {
    super(code);
  }
}

function publicUploadError(error: unknown) {
  if (error instanceof DraftUploadError) {
    if (error.code === "UPLOAD_LIMIT") return "Слишком много загрузок для этой работы. Попробуйте позже.";
    if (error.code === "DRAFT_UNAVAILABLE") return "Черновик недоступен для загрузки.";
    return "Некорректный путь загрузки.";
  }
  return "Не удалось подготовить загрузку. Попробуйте ещё раз.";
}

export async function POST(request: Request) {
  if (!strictSameOrigin(request)) return NextResponse.json({ error: "INVALID_ORIGIN" }, { status: 403 });
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Требуется вход" }, { status: 401 });
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: "Хранилище файлов ещё не подключено" }, { status: 503 });
  }
  try {
    await assertAccountActive(user);
    const body = await readJsonWithLimit(request, 64_000) as HandleUploadBody;
    if ((body as { type?: string }).type === "blob.generate-client-token") {
      if (!(await rateLimit(`draft-upload-token:${user.id}`, 12, 60 * 60_000))) {
        return NextResponse.json({ error: "TOO_MANY_UPLOADS" }, { status: 429 });
      }
    }
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
          throw new DraftUploadError("INVALID_PATH");
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
        if (!submission) throw new DraftUploadError("DRAFT_UNAVAILABLE");
        if (!(await rateLimit(`draft-upload-submission:${user.id}:${submissionId}`, 3, 60 * 60_000))) {
          throw new DraftUploadError("UPLOAD_LIMIT");
        }
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
    return NextResponse.json({ error: publicUploadError(error) }, { status: 400 });
  }
}
