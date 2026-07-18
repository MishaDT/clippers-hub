export class RequestBodyTooLargeError extends Error {}

type BodySource = Pick<Request, "headers" | "body">;

export async function readBytesWithLimit(source: BodySource, maxBytes: number): Promise<Uint8Array> {
  const declared = Number(source.headers.get("content-length") || 0);
  if (Number.isFinite(declared) && declared > maxBytes) throw new RequestBodyTooLargeError();
  const reader = source.body?.getReader();
  if (!reader) throw new SyntaxError("Missing request body");
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => {});
      throw new RequestBodyTooLargeError();
    }
    chunks.push(value);
  }
  const joined = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    joined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return joined;
}

export async function readTextWithLimit(source: BodySource, maxBytes: number): Promise<string> {
  return new TextDecoder().decode(await readBytesWithLimit(source, maxBytes));
}

export async function readJsonWithLimit(request: Request, maxBytes: number): Promise<unknown> {
  return JSON.parse(await readTextWithLimit(request, maxBytes));
}

export async function readFormDataWithLimit(request: Request, maxBytes: number): Promise<FormData> {
  const contentType = request.headers.get("content-type") || "";
  if (!contentType) throw new SyntaxError("Missing content type");
  const bytes = await readBytesWithLimit(request, maxBytes);
  const body = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(body).set(bytes);
  return new Response(body, { headers: { "content-type": contentType } }).formData();
}
