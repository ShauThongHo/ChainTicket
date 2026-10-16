import { createHmac } from "node:crypto";
import { qrSecret } from "@/lib/session.server";

const WINDOW_SEC = 30;

export function qrBucket(at = Date.now()) {
  return Math.floor(at / 1000 / WINDOW_SEC);
}

export function buildQrPayload(ticketId: number, bucket = qrBucket()) {
  const hmac = createHmac("sha256", qrSecret())
    .update(`${ticketId}:${bucket}`)
    .digest("hex")
    .slice(0, 20);
  return `CT1.${ticketId}.${bucket}.${hmac}`;
}

export function parseQrPayload(payload: string): { ticketId: number; bucket: number } {
  const parts = payload.trim().split(".");
  if (parts.length !== 4 || parts[0] !== "CT1") {
    throw new Error("Not a ChainTicket QR payload.");
  }
  const ticketId = Number(parts[1]);
  const bucket = Number(parts[2]);
  const hmac = parts[3];
  if (!Number.isInteger(ticketId) || !Number.isInteger(bucket)) {
    throw new Error("Malformed QR payload.");
  }
  const now = qrBucket();
  if (Math.abs(now - bucket) > 1) {
    throw new Error("QR expired. Ask the attendee to refresh.");
  }
  const expect = createHmac("sha256", qrSecret())
    .update(`${ticketId}:${bucket}`)
    .digest("hex")
    .slice(0, 20);
  if (expect !== hmac) throw new Error("QR signature invalid.");
  return { ticketId, bucket };
}

export const QR_WINDOW_MS = WINDOW_SEC * 1000;
export const QR_UNLOCK_MS = 2 * 60 * 60 * 1000;
