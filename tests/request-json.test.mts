import assert from "node:assert/strict";
import test from "node:test";
import { readJsonWithLimit, RequestBodyTooLargeError } from "../lib/request-json.ts";

test("reads a JSON request within the byte limit", async () => {
  const request = new Request("https://reelpay.test/api", {
    method: "POST",
    body: JSON.stringify({ ok: true })
  });
  assert.deepEqual(await readJsonWithLimit(request, 100), { ok: true });
});

test("rejects an oversized body even without Content-Length", async () => {
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(JSON.stringify({ value: "x".repeat(200) })));
      controller.close();
    }
  });
  const request = new Request("https://reelpay.test/api", { method: "POST", body, duplex: "half" } as RequestInit);
  await assert.rejects(readJsonWithLimit(request, 32), RequestBodyTooLargeError);
});
