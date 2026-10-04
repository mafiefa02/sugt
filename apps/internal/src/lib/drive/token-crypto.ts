import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

import { requireEnv } from "-/lib/env";
import type { EncryptedRefreshToken } from "@sugt/db/queries";

/**
 * **The Drive refresh token, encrypted at rest** (ADR-0040): AES-256-GCM under `DRIVE_TOKEN_KEY`
 * (32 bytes, base64), with a fresh random 12-byte IV on every write. GCM's tag makes tampering, or a
 * different key, fail to decrypt rather than decrypt to garbage.
 *
 * The key lives only in the environment, so the database alone never yields a token. Losing it means
 * connecting again — the token will not decrypt, the connection is marked broken, and an
 * Administrator reconnects. It never loses a receipt.
 */

const ALGORITHM = "aes-256-gcm";

function driveTokenKey(): Buffer {
  const key = Buffer.from(requireEnv("DRIVE_TOKEN_KEY"), "base64");
  if (key.length !== 32) {
    throw new Error(
      `DRIVE_TOKEN_KEY must be 32 bytes, base64-encoded (\`openssl rand -base64 32\`); it decodes to ${key.length}.`,
    );
  }
  return key;
}

export function encryptRefreshToken(refreshToken: string): EncryptedRefreshToken {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, driveTokenKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(refreshToken, "utf8"), cipher.final()]);
  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
  };
}

/** The plaintext token, or `null` when it will not decrypt under the current key. */
export function decryptRefreshToken(encrypted: EncryptedRefreshToken): string | null {
  const key = driveTokenKey();
  try {
    const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(encrypted.iv, "base64"));
    decipher.setAuthTag(Buffer.from(encrypted.tag, "base64"));
    return Buffer.concat([
      decipher.update(Buffer.from(encrypted.ciphertext, "base64")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return null;
  }
}
