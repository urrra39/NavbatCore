/**
 * Envelope encryption + compression for the Cold Archive.
 *
 * Pipeline (write):  JSON.stringify -> gzip -> AES-256-GCM(key, iv, aad)
 * Pipeline (read) :  AES-256-GCM-verify -> gunzip -> JSON.parse
 *
 * Why this shape:
 *   * AES-256-GCM is AEAD — the auth tag detects any tampering with either
 *     the ciphertext or the AAD (clinicId|ticketCode|keyId). A successful
 *     decryption is therefore a tenancy proof; you cannot serve clinic A's
 *     archive bytes to clinic B even if a query is mis-scoped.
 *   * IV is a 12-byte CSPRNG output, never reused with the same key.
 *   * Compression first, encryption last. Compressing ciphertext is useless
 *     because AES output is indistinguishable from random.
 */

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { gzipSync, gunzipSync } from "node:zlib";

import { env } from "@/env";

const ALGO = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

const masterKey: Buffer = (() => {
  const buf = Buffer.from(env.ARCHIVE_ENCRYPTION_KEY, "base64");
  if (buf.length !== 32) {
    throw new Error("ARCHIVE_ENCRYPTION_KEY must decode to 32 bytes");
  }
  return buf;
})();

export interface EncryptedBundle {
  cipher: Buffer;
  iv: Buffer;
  authTag: Buffer;
  aad: Buffer;
  keyId: string;
  rawSize: number;
  compressedSize: number;
}

export interface ArchiveBindings {
  clinicId: string;
  ticketCode: string;
}

const buildAad = (b: ArchiveBindings, keyId: string): Buffer =>
  Buffer.from(`${b.clinicId}|${b.ticketCode}|${keyId}`, "utf8");

/**
 * Compress + encrypt a JSON-serializable payload.
 *
 * @param payload     Any JSON-serializable structure (HotTicket snapshot).
 * @param bindings    Tenant identifiers — bound into AAD, NOT into the body.
 * @returns           Bundle ready to be persisted into ColdTicketArchive.
 */
export const encryptArchivePayload = (
  payload: unknown,
  bindings: ArchiveBindings,
): EncryptedBundle => {
  const raw = Buffer.from(JSON.stringify(payload), "utf8");
  const compressed = gzipSync(raw, { level: 9 });

  const iv = randomBytes(IV_LENGTH);
  const aad = buildAad(bindings, env.ARCHIVE_KEY_ID);

  const cipher = createCipheriv(ALGO, masterKey, iv, { authTagLength: TAG_LENGTH });
  cipher.setAAD(aad, { plaintextLength: compressed.length });

  const ciphertext = Buffer.concat([cipher.update(compressed), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    cipher: ciphertext,
    iv,
    authTag,
    aad,
    keyId: env.ARCHIVE_KEY_ID,
    rawSize: raw.length,
    compressedSize: compressed.length,
  };
};

/**
 * Decrypt + decompress, then JSON.parse. Throws on tag mismatch (tamper),
 * compression error, or unparseable JSON. The caller is expected to also
 * verify that `bindings` matches the ColdTicketArchive header columns
 * before exposing the payload to a user.
 */
export const decryptArchivePayload = <T = unknown>(
  bundle: Pick<EncryptedBundle, "cipher" | "iv" | "authTag" | "aad"> & {
    keyId?: string;
  },
  bindings: ArchiveBindings,
): T => {
  const expectedAad = buildAad(bindings, bundle.keyId ?? env.ARCHIVE_KEY_ID);
  if (
    expectedAad.length !== bundle.aad.length ||
    !timingSafeEqual(expectedAad, bundle.aad)
  ) {
    throw new Error("archive_aad_mismatch");
  }

  const decipher = createDecipheriv(ALGO, masterKey, bundle.iv, {
    authTagLength: TAG_LENGTH,
  });
  decipher.setAAD(bundle.aad);
  decipher.setAuthTag(bundle.authTag);

  const compressed = Buffer.concat([decipher.update(bundle.cipher), decipher.final()]);
  const raw = gunzipSync(compressed);
  return JSON.parse(raw.toString("utf8")) as T;
};

/**
 * Diagnostic helper used by tests and ops scripts. Returns
 * compression ratio (0..1) — lower is better.
 */
export const compressionRatio = (bundle: EncryptedBundle): number =>
  bundle.rawSize === 0 ? 1 : bundle.compressedSize / bundle.rawSize;
