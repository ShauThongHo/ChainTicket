import { r as __exportAll } from "../_runtime.mjs";
import { t as __exportAll$1 } from "./rolldown-runtime-D7D4PA-g.mjs";
import { d as isAddress, f as getAddress, s as recoverMessageAddress } from "../_libs/viem.mjs";
import { createHmac, randomBytes } from "node:crypto";
//#region node_modules/.nitro/vite/services/ssr/assets/session.server-U8N3VQgv.js
var session_server_U8N3VQgv_exports = /* @__PURE__ */ __exportAll({
	i: () => session_server_exports,
	n: () => normalizeWallet,
	r: () => qrSecret,
	t: () => makeTxRef
});
var session_server_exports = /* @__PURE__ */ __exportAll$1({
	consumeNonce: () => consumeNonce,
	issueNonce: () => issueNonce,
	loginMessage: () => loginMessage,
	makeTxRef: () => makeTxRef,
	normalizeWallet: () => normalizeWallet,
	parseSessionToken: () => parseSessionToken,
	qrSecret: () => qrSecret,
	signSessionToken: () => signSessionToken,
	verifyLoginSignature: () => verifyLoginSignature
});
var SECRET = "chainticket-chiado-session-v1";
var TOKEN_TTL_SEC = 604800;
function normalizeWallet(addr) {
	if (!isAddress(addr)) throw new Error("Invalid wallet address.");
	return getAddress(addr).toLowerCase();
}
function loginMessage(nonce) {
	return ["ChainTicket wants you to sign in.", `Nonce: ${nonce}`].join("\n");
}
function signSessionToken(wallet) {
	const exp = Math.floor(Date.now() / 1e3) + TOKEN_TTL_SEC;
	const body = `${wallet.toLowerCase()}.${exp}`;
	return `${body}.${createHmac("sha256", SECRET).update(body).digest("hex")}`;
}
function parseSessionToken(token) {
	if (!token) return null;
	const parts = token.split(".");
	if (parts.length !== 3) return null;
	const [wallet, expStr, hmac] = parts;
	const body = `${wallet}.${expStr}`;
	if (createHmac("sha256", SECRET).update(body).digest("hex") !== hmac) return null;
	const exp = Number(expStr);
	if (!Number.isFinite(exp) || exp * 1e3 < Date.now()) return null;
	try {
		return normalizeWallet(wallet);
	} catch {
		return null;
	}
}
async function issueNonce(sql) {
	const nonce = randomBytes(16).toString("hex");
	await sql`insert into login_nonces (nonce) values (${nonce})`;
	return nonce;
}
async function consumeNonce(sql, nonce) {
	if (!(await sql`
    select nonce from login_nonces
    where nonce = ${nonce}
      and created_at > now() - interval '10 minutes'
  `)[0]) throw new Error("Login nonce expired. Request a new one.");
	await sql`delete from login_nonces where nonce = ${nonce}`;
}
async function verifyLoginSignature(opts) {
	const wallet = normalizeWallet(opts.address);
	if ((await recoverMessageAddress({
		message: loginMessage(opts.nonce),
		signature: opts.signature
	})).toLowerCase() !== wallet) throw new Error("Signature does not match this wallet.");
	return wallet;
}
function qrSecret() {
	return `${SECRET}:qr`;
}
function makeTxRef(kind) {
	return `ct1:${kind}:${createHmac("sha256", SECRET).update(`${kind}:${Date.now()}:${Math.random()}`).digest("hex").slice(0, 24)}`;
}
//#endregion
export { session_server_U8N3VQgv_exports as i, normalizeWallet as n, qrSecret as r, makeTxRef as t };
