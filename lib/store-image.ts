import sharp from "sharp";

export const MAX_STORE_IMAGE_BYTES = 1_500_000;
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

export class StoreImageValidationError extends Error {}

export async function processStoreImage(input: Buffer, contentType: string, qr = false) {
  if (!input.length || input.length > MAX_STORE_IMAGE_BYTES || !ALLOWED_TYPES.has(contentType)) {
    throw new StoreImageValidationError("invalid_file");
  }

  try {
    const image = sharp(input, { failOn: "error", limitInputPixels: 16_000_000 });
    const metadata = await image.metadata();
    if (!metadata.width || !metadata.height || (metadata.pages || 1) > 1) {
      throw new StoreImageValidationError("invalid_dimensions");
    }

    const normalized = image.rotate().resize({
      width: qr ? 900 : 1200,
      height: qr ? 900 : 1200,
      fit: "inside",
      withoutEnlargement: true
    });
    const output = qr
      ? await normalized.png({ compressionLevel: 9 }).toBuffer()
      : await normalized.webp({ quality: 84, effort: 4 }).toBuffer();
    if (!output.length || output.length > MAX_STORE_IMAGE_BYTES) {
      throw new StoreImageValidationError("output_too_large");
    }
    return {
      contentType: qr ? "image/png" : "image/webp",
      buffer: output
    };
  } catch (error) {
    if (error instanceof StoreImageValidationError) throw error;
    throw new StoreImageValidationError("decode_failed");
  }
}
