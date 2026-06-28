import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { AvatarValidationError, processAvatarImage } from "../lib/avatar-image.ts";

test("normalizes an uploaded avatar to a compact 192px WebP", async () => {
  const input = await sharp({
    create: { width: 640, height: 480, channels: 3, background: "#22c55e" }
  }).png().toBuffer();

  const output = await processAvatarImage(input, "image/png");
  const metadata = await sharp(output).metadata();

  assert.equal(metadata.format, "webp");
  assert.equal(metadata.width, 192);
  assert.equal(metadata.height, 192);
  assert.ok(output.length < 60_000);
});

test("rejects SVG and fake image content", async () => {
  await assert.rejects(
    processAvatarImage(Buffer.from("<svg><script>alert(1)</script></svg>"), "image/svg+xml"),
    AvatarValidationError
  );
  await assert.rejects(
    processAvatarImage(Buffer.from("not an image"), "image/png"),
    AvatarValidationError
  );
});
