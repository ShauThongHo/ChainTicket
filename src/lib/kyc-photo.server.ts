import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const MAX_BYTES = 4_000_000;

function dir() {
  return join(process.cwd(), ".data", "kyc-photos");
}

function stripJpegExif(buf: Buffer) {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return buf;
  const parts: Buffer[] = [buf.subarray(0, 2)];
  let i = 2;
  while (i + 4 < buf.length) {
    if (buf[i] !== 0xff) {
      parts.push(buf.subarray(i));
      break;
    }
    const marker = buf[i + 1]!;
    if (marker === 0xd8) {
      i += 2;
      continue;
    }
    if (marker === 0xd9 || marker === 0xda) {
      parts.push(buf.subarray(i));
      break;
    }
    const len = buf.readUInt16BE(i + 2);
    if (len < 2 || i + 2 + len > buf.length) break;
    if (marker !== 0xe1) parts.push(buf.subarray(i, i + 2 + len));
    i += 2 + len;
  }
  return Buffer.concat(parts);
}

function stripPngMeta(buf: Buffer) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (buf.length < 8 || !buf.subarray(0, 8).equals(sig)) return buf;
  const parts: Buffer[] = [sig];
  let i = 8;
  const drop = new Set(["eXIf", "tEXt", "zTXt", "iTXt", "tIME"]);
  while (i + 12 <= buf.length) {
    const len = buf.readUInt32BE(i);
    const type = buf.subarray(i + 4, i + 8).toString("ascii");
    const end = i + 12 + len;
    if (end > buf.length) break;
    if (!drop.has(type)) parts.push(buf.subarray(i, end));
    i = end;
    if (type === "IEND") break;
  }
  return Buffer.concat(parts);
}

export function storeKycPhoto(ref: string, raw: Buffer, type: "image/jpeg" | "image/png") {
  if (!/^[a-f0-9]{32}$/.test(ref)) throw new Error("Could not store the document photo.");
  const jpeg = raw.length >= 3 && raw[0] === 0xff && raw[1] === 0xd8 && raw[2] === 0xff;
  const png = raw.length >= 8 && raw[0] === 0x89 && raw[1] === 0x50 && raw[2] === 0x4e && raw[3] === 0x47;
  if (type === "image/jpeg" && !jpeg) throw new Error("Photo must be a JPEG file.");
  if (type === "image/png" && !png) throw new Error("Photo must be a PNG file.");
  const stripped = type === "image/jpeg" ? stripJpegExif(raw) : stripPngMeta(raw);
  if (stripped.length < 32 || stripped.length > MAX_BYTES) {
    throw new Error("Photo must be under 4MB.");
  }
  mkdirSync(dir(), { recursive: true });
  for (const ext of ["jpg", "png"]) {
    try {
      unlinkSync(join(dir(), `${ref}.${ext}`));
    } catch {
      // no previous file
    }
  }
  const key = `${ref}.${type === "image/jpeg" ? "jpg" : "png"}`;
  writeFileSync(join(dir(), key), stripped, { mode: 0o600 });
  return { key, sha256: createHash("sha256").update(stripped).digest("hex") };
}

export function readKycPhoto(key: string) {
  if (!/^[a-f0-9]{32}\.(jpg|png)$/.test(key)) throw new Error("Photo not found.");
  const bytes = readFileSync(join(dir(), key));
  return {
    bytes,
    contentType: key.endsWith(".png") ? ("image/png" as const) : ("image/jpeg" as const),
  };
}
