import "server-only";

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const LEGACY_PREFIX = "enc:v1";

function legacySecret() {
  return process.env.SOCIAL_TOKEN_ENCRYPTION_KEY?.trim();
}

function keyring() {
  const configured = String(process.env.SOCIAL_TOKEN_ENCRYPTION_KEYS || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const separator = entry.indexOf(":");
      return separator > 0 ? [entry.slice(0, separator), entry.slice(separator + 1)] as const : null;
    })
    .filter((entry): entry is readonly [string, string] => Boolean(entry && entry[0] && entry[1].length >= 32));
  if (configured.length) return configured;
  const secret = legacySecret();
  return secret && secret.length >= 32 ? [["legacy-v1", secret] as const] : [];
}

function encryptionKey(secret: string) {
  if (!secret || secret.length < 32) {
    throw new Error("SOCIAL_TOKEN_ENCRYPTION_KEY must contain at least 32 characters");
  }
  return createHash("sha256").update(secret, "utf8").digest();
}

export function socialTokenEncryptionReady() {
  return keyring().length > 0;
}

export function activeSocialEncryptionKeyId() {
  return keyring()[0]?.[0] || "";
}

export function encryptSecret(value: string, context = "social-token") {
  const active = keyring()[0];
  if (!active) throw new Error("Social token encryption is not configured");
  const [keyId, secret] = active;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(secret), iv);
  cipher.setAAD(Buffer.from(context, "utf8"));
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["enc", "v2", keyId, iv.toString("base64url"), tag.toString("base64url"), ciphertext.toString("base64url")].join(":");
}

export function decryptSecret(value: string, context = "social-token") {
  const parts = value.split(":");
  if (parts.slice(0, 2).join(":") === LEGACY_PREFIX) {
    const [, , ivValue, tagValue, ciphertextValue] = parts;
    const secret = legacySecret() || keyring().find(([id]) => id === "legacy-v1")?.[1];
    if (!secret || !ivValue || !tagValue || !ciphertextValue) throw new Error("Legacy encryption key is unavailable");
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(secret), Buffer.from(ivValue, "base64url"));
    decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(ciphertextValue, "base64url")), decipher.final()]).toString("utf8");
  }
  const [enc, version, keyId, ivValue, tagValue, ciphertextValue] = parts;
  const secret = keyring().find(([id]) => id === keyId)?.[1];
  if (enc !== "enc" || version !== "v2" || !secret || !ivValue || !tagValue || !ciphertextValue) {
    throw new Error("Encrypted secret has an unsupported key or format");
  }
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(secret), Buffer.from(ivValue, "base64url"));
  decipher.setAAD(Buffer.from(context, "utf8"));
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextValue, "base64url")),
    decipher.final()
  ]).toString("utf8");
}
