import { createHmac, randomBytes } from "node:crypto";
import { getAddress, isAddress, recoverMessageAddress } from "viem";
import type { Sql } from "@/lib/db";

const SECRET = "chainticket-chiado-session-v1";
const TOKEN_TTL_SEC = 60 * 60 * 24 * 7;

export function normalizeWallet(addr: string) {
  if (!isAddress(addr)) throw new Error("Invalid wallet address.");
  return getAddress(addr).toLowerCase();
}

export function loginMessage(nonce: string) {
  return ["ChainTicket wants you to sign in.", `Nonce: ${nonce}`].join("\n");
}

export function signSessionToken(wallet: string) {
  const exp = Math.floor(Date.now() / 1000) + TOKEN_TTL_SEC;
  const body = `${wallet.toLowerCase()}.${exp}`;
  const hmac = createHmac("sha256", SECRET).update(body).digest("hex");
  return `${body}.${hmac}`;
}

export function parseSessionToken(token: string | null | undefined): string | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [wallet, expStr, hmac] = parts;
  const body = `${wallet}.${expStr}`;
  const expect = createHmac("sha256", SECRET).update(body).digest("hex");
  if (expect !== hmac) return null;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp * 1000 < Date.now()) return null;
  try {
    return normalizeWallet(wallet);
  } catch {
    return null;
  }
}

export function displayAddress(token: string | null | undefined): string | null {
  if (!token) return null;
  const wallet = token.split(".")[0];
  if (!wallet) return null;
  try {
    return getAddress(wallet);
  } catch {
    return wallet;
  }
}

export async function issueNonce(sql: Sql) {
  const nonce = randomBytes(16).toString("hex");
  await sql`insert into login_nonces (nonce) values (${nonce})`;
  return nonce;
}

export async function consumeNonce(sql: Sql, nonce: string) {
  const rows = await sql<{ nonce: string }>`
    select nonce from login_nonces
    where nonce = ${nonce}
      and created_at > now() - interval '10 minutes'
  `;
  if (!rows[0]) throw new Error("Login nonce expired. Request a new one.");
  await sql`delete from login_nonces where nonce = ${nonce}`;
}

export async function verifyLoginSignature(opts: {
  address: string;
  signature: `0x${string}`;
  nonce: string;
}) {
  const wallet = normalizeWallet(opts.address);
  const recovered = await recoverMessageAddress({
    message: loginMessage(opts.nonce),
    signature: opts.signature,
  });
  if (recovered.toLowerCase() !== wallet) {
    throw new Error("Signature does not match this wallet.");
  }
  return wallet;
}

export function qrSecret() {
  return `${SECRET}:qr`;
}

export function makeTxRef(kind: string) {
  return `ct1:${kind}:${createHmac("sha256", SECRET)
    .update(`${kind}:${Date.now()}:${Math.random()}`)
    .digest("hex")
    .slice(0, 24)}`;
}
