import sharp from "sharp";

export const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const ALLOWED_AVATAR_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export class AvatarValidationError extends Error {}

export async function processAvatarImage(input: Buffer, contentType: string) {
  if (!input.length || input.length > MAX_AVATAR_BYTES || !ALLOWED_AVATAR_TYPES.has(contentType)) {
    throw new AvatarValidationError("invalid_file");
  }

  try {
    const image = sharp(input, { failOn: "error", limitInputPixels: 16_000_000 });
    const metadata = await image.metadata();
    if (!metadata.width || !metadata.height || metadata.width < 64 || metadata.height < 64 || (metadata.pages || 1) > 1) {
      throw new AvatarValidationError("invalid_dimensions");
    }

    const output = await image
      .rotate()
      .resize(192, 192, { fit: "cover", position: "attention" })
      .webp({ quality: 78, effort: 4 })
      .toBuffer();

    if (output.length > 60_000) throw new AvatarValidationError("output_too_large");
    return output;
  } catch (error) {
    if (error instanceof AvatarValidationError) throw error;
    throw new AvatarValidationError("decode_failed");
  }
}
