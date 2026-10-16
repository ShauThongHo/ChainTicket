import { r as __exportAll } from "../_runtime.mjs";
import { t as __exportAll$1 } from "./rolldown-runtime-D7D4PA-g.mjs";
import { d as isAddress, f as getAddress } from "../_libs/viem.mjs";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
//#region node_modules/.nitro/vite/services/ssr/assets/platform-ITGl4Pv_.js
var platform_ITGl4Pv__exports = /* @__PURE__ */ __exportAll({
	n: () => platform_exports,
	r: () => readPlatform,
	t: () => configuredAdmin
});
var platform_exports = /* @__PURE__ */ __exportAll$1({
	DEFAULT_SECRETS_PATH: () => DEFAULT_SECRETS_PATH,
	configuredAdmin: () => configuredAdmin,
	readPlatform: () => readPlatform,
	resolvePlatformPath: () => resolvePlatformPath,
	writePlatform: () => writePlatform
});
var DEFAULT_SECRETS_PATH = ".data/operator-secrets.json";
/** Project config next to the process, with the sandbox file as a fallback. */
function resolvePlatformPath() {
	const fromCwd = join(process.cwd(), "config", "platform.json");
	const workspace = join("/workspace", "config", "platform.json");
	if (existsSync(fromCwd)) return fromCwd;
	if (fromCwd !== workspace && existsSync(workspace)) return workspace;
	return fromCwd;
}
resolvePlatformPath();
var FALLBACK = {
	adminWallet: "",
	chainName: "Testnet",
	nativeSymbol: "xDAI",
	rpcUrl: "https://rpc.chiadochain.net",
	chainId: 10200,
	explorerUrl: "https://gnosis-chiado.blockscout.com",
	secretsPath: DEFAULT_SECRETS_PATH
};
function readPlatform() {
	const path = resolvePlatformPath();
	try {
		const parsed = JSON.parse(readFileSync(path, "utf8"));
		return {
			adminWallet: (parsed.adminWallet ?? "").trim(),
			chainName: (parsed.chainName ?? FALLBACK.chainName).trim() || FALLBACK.chainName,
			nativeSymbol: (parsed.nativeSymbol ?? FALLBACK.nativeSymbol).trim() || FALLBACK.nativeSymbol,
			rpcUrl: (parsed.rpcUrl ?? FALLBACK.rpcUrl).trim(),
			chainId: Number(parsed.chainId) || FALLBACK.chainId,
			explorerUrl: (parsed.explorerUrl ?? FALLBACK.explorerUrl).trim(),
			secretsPath: (parsed.secretsPath ?? FALLBACK.secretsPath).trim() || FALLBACK.secretsPath
		};
	} catch {
		return { ...FALLBACK };
	}
}
var SECRET_FIELDS = [
	"operatorPk",
	"pinataJwt",
	"databaseUrl",
	"databaseUrlKyc",
	"operator_pk",
	"pinata_jwt",
	"privateKey",
	"kycAesKey",
	"kycHmacPepper",
	"KYC_AES_KEY",
	"KYC_HMAC_PEPPER",
	"DATABASE_URL_KYC"
];
function writePlatform(patch) {
	const clean = { ...patch };
	for (const key of SECRET_FIELDS) delete clean[key];
	const next = {
		...readPlatform(),
		...clean
	};
	for (const key of SECRET_FIELDS) delete next[key];
	if (next.adminWallet && !isAddress(next.adminWallet)) throw new Error("Admin wallet is not a valid address.");
	if (next.adminWallet) next.adminWallet = getAddress(next.adminWallet);
	if (next.secretsPath) next.secretsPath = next.secretsPath.trim() || ".data/operator-secrets.json";
	const path = resolvePlatformPath();
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, `${JSON.stringify(next, null, 2)}\n`);
	return next;
}
function configuredAdmin() {
	const w = readPlatform().adminWallet;
	return w ? w.toLowerCase() : "";
}
//#endregion
export { platform_ITGl4Pv__exports as n, readPlatform as r, configuredAdmin as t };
