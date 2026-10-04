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
/** Pinned, so a tag cut short is refused rather than checked against fewer bytes. */
const AUTH_TAG_LENGTH = 16;

/**
 * The key, decoded. **Unset** is a deploy mistake and throws through `requireEnv`; **the wrong length**
 * throws here, which encrypting surfaces and decrypting turns into "will not decrypt".
 */
function decodeKey(base64: string): Buffer {
  const key = Buffer.from(base64, "base64");
  if (key.length !== 32) {
    throw new Error(
      `DRIVE_TOKEN_KEY must be 32 bytes, base64-encoded (\`openssl rand -base64 32\`); it decodes to ${key.length}.`,
    );
  }
  return key;
}

export function encryptRefreshToken(refreshToken: string): EncryptedRefreshToken {
  const iv = randomBytes(12);
  const key = decodeKey(requireEnv("DRIVE_TOKEN_KEY"));
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  const ciphertext = Buffer.concat([cipher.update(refreshToken, "utf8"), cipher.final()]);
  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
  };
}

/**
 * The plaintext token, or `null` when it will not decrypt under the current key — a different key,
 * a key of the wrong length, or a tampered row alike. The caller marks the connection broken.
 */
export function decryptRefreshToken(encrypted: EncryptedRefreshToken): string | null {
  const base64Key = requireEnv("DRIVE_TOKEN_KEY");
  try {
    const iv = Buffer.from(encrypted.iv, "base64");
    const decipher = createDecipheriv(ALGORITHM, decodeKey(base64Key), iv, {
      authTagLength: AUTH_TAG_LENGTH,
    });
    decipher.setAuthTag(Buffer.from(encrypted.tag, "base64"));
    return Buffer.concat([
      decipher.update(Buffer.from(encrypted.ciphertext, "base64")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return null;
  }
}
