import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { processStoreImage, StoreImageValidationError } from "../lib/store-image.ts";

test("normalizes store artwork and QR uploads to safe raster formats", async () => {
  const input = await sharp({
    create: { width: 1600, height: 900, channels: 3, background: "#baff00" }
  }).png().toBuffer();
  const artwork = await processStoreImage(input, "image/png");
  const qr = await processStoreImage(input, "image/png", true);
  assert.equal((await sharp(artwork.buffer).metadata()).format, "webp");
  assert.equal((await sharp(qr.buffer).metadata()).format, "png");
});

test("rejects SVG and fake store images", async () => {
  await assert.rejects(
    processStoreImage(Buffer.from("<svg><script>alert(1)</script></svg>"), "image/svg+xml"),
    StoreImageValidationError
  );
  await assert.rejects(
    processStoreImage(Buffer.from("not an image"), "image/png"),
    StoreImageValidationError
  );
});
