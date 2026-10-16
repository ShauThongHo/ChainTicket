import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "node:crypto";

/** Trim, uppercase, drop internal whitespace. Not logged. */
export function normalizeId(id: string) {
  return id.trim().toUpperCase().replace(/\s+/g, "");
}

export function idLast4(id: string) {
  const compact = normalizeId(id).replace(/[^A-Z0-9]/g, "");
  return compact.slice(-4);
}

export function newKycRef() {
  return randomBytes(16).toString("hex");
}

/** 64 hex chars or standard base64 that decodes to 32 bytes. */
export function decodeAesKey(raw: string) {
  const v = raw.trim();
  if (/^[0-9a-fA-F]{64}$/.test(v)) return Buffer.from(v, "hex");
  const buf = Buffer.from(v, "base64");
  if (buf.length === 32) return buf;
  throw new Error("KYC_AES_KEY must be 32 bytes (64 hex characters or base64).");
}

/** Pack iv.tag.ciphertext as base64url. AES-256-GCM, fresh IV per value. */
export function seal(plain: string, key: Buffer) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64url")}.${tag.toString("base64url")}.${ct.toString("base64url")}`;
}

export function openSeal(packed: string, key: Buffer) {
  const [ivB, tagB, ctB] = packed.split(".");
  if (!ivB || !tagB || !ctB) throw new Error("Could not read this KYC record.");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivB, "base64url"));
  decipher.setAuthTag(Buffer.from(tagB, "base64url"));
  const plain = Buffer.concat([decipher.update(Buffer.from(ctB, "base64url")), decipher.final()]);
  return plain.toString("utf8");
}

export function idHash(normalizedId: string, pepper: string) {
  return createHmac("sha256", pepper).update(normalizedId).digest("hex");
}
