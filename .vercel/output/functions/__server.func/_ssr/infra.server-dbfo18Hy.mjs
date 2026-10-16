import { r as readPlatform } from "./platform-ITGl4Pv_.mjs";
import { a as reconnectDatabase, i as probePostgres, o as resolveDatabaseUrl } from "./db-6MgyDrQq.mjs";
import { n as normalizeWallet } from "./session.server-U8N3VQgv.mjs";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
//#region node_modules/.nitro/vite/services/ssr/assets/infra.server-dbfo18Hy.js
var DB_POINTER = "/workspace/.data/db-pointer.json";
var LEGACY_INFRA_PATH = "/workspace/.data/infra.json";
function readJsonFile(path) {
	try {
		return JSON.parse(readFileSync(path, "utf8"));
	} catch {
		return {};
	}
}
function readFileConfig() {
	const pointer = readJsonFile(DB_POINTER);
	return {
		...readJsonFile(LEGACY_INFRA_PATH),
		...pointer
	};
}
/** Local reconnect pointer only. Never write operator keys or Pinata JWTs here. */
function writeDbPointer(databaseUrl) {
	mkdirSync(dirname(DB_POINTER), { recursive: true });
	if (!databaseUrl) return;
	writeFileSync(DB_POINTER, `${JSON.stringify({ databaseUrl }, null, 2)}\n`);
}
async function loadInfra(sql) {
	const file = readFileConfig();
	const plat = readPlatform();
	let map = null;
	try {
		const rows = await sql`select key, value from infra_settings`;
		map = new Map(rows.map((r) => [r.key, r.value]));
	} catch {
		map = null;
	}
	const get = (key, fallback = "") => map && map.has(key) ? map.get(key) ?? "" : fallback;
	const devMode = map?.has("dev_mode") ? map.get("dev_mode") === "true" : file.devMode === true;
	const demoBank = map?.has("demo_bank") ? (map.get("demo_bank") ?? "").trim() : (file.demoBank || "").trim();
	return {
		databaseUrl: (get("database_url") || file.databaseUrl || "").trim(),
		rpcUrl: (get("rpc_url") || file.rpcUrl || plat.rpcUrl).trim(),
		chainId: Number(get("chain_id") || file.chainId || plat.chainId) || plat.chainId,
		explorerUrl: (get("explorer_url") || file.explorerUrl || plat.explorerUrl).trim(),
		operatorPk: (get("operator_pk") || file.operatorPk || "").trim(),
		pinataJwt: (get("pinata_jwt") || file.pinataJwt || "").trim(),
		demoBank,
		devMode,
		databaseUrlKyc: (get("database_url_kyc") || "").trim(),
		kycAutoApprove: devMode && get("kyc_auto_approve") === "true"
	};
}
async function saveInfra(sql, patch) {
	const current = await loadInfra(sql);
	const plat = readPlatform();
	const next = {
		databaseUrl: patch.clearDatabaseUrl ? "" : patch.databaseUrl !== void 0 ? patch.databaseUrl.trim() : current.databaseUrl,
		rpcUrl: (patch.rpcUrl ?? current.rpcUrl).trim() || plat.rpcUrl,
		chainId: patch.chainId ?? current.chainId,
		explorerUrl: (patch.explorerUrl ?? current.explorerUrl).trim() || plat.explorerUrl,
		operatorPk: patch.clearOperatorPk ? "" : patch.operatorPk && patch.operatorPk.trim() ? patch.operatorPk.trim() : current.operatorPk,
		pinataJwt: patch.clearPinata ? "" : patch.pinataJwt !== void 0 ? patch.pinataJwt.trim() : current.pinataJwt,
		demoBank: patch.demoBank !== void 0 ? patch.demoBank.trim() : current.demoBank,
		devMode: patch.devMode ?? current.devMode,
		databaseUrlKyc: patch.clearDatabaseUrlKyc ? "" : patch.databaseUrlKyc !== void 0 ? patch.databaseUrlKyc.trim() : current.databaseUrlKyc,
		kycAutoApprove: (patch.devMode ?? current.devMode) && (patch.kycAutoApprove ?? current.kycAutoApprove)
	};
	if (next.operatorPk && !/^0x[0-9a-fA-F]{64}$/.test(next.operatorPk)) throw new Error("Operator private key must be 0x followed by 64 hex chars.");
	if (next.demoBank) normalizeWallet(next.demoBank);
	const liveBefore = resolveDatabaseUrl() || "";
	if (next.databaseUrl) writeDbPointer(next.databaseUrl);
	const want = next.databaseUrl || "";
	let live = sql;
	if (want !== liveBefore) {
		if (want) await probePostgres(want);
		live = await reconnectDatabase(want || null);
	}
	const pairs = [
		["rpc_url", next.rpcUrl ?? ""],
		["chain_id", String(next.chainId ?? plat.chainId)],
		["explorer_url", next.explorerUrl ?? ""],
		["operator_pk", next.operatorPk ?? ""],
		["database_url", next.databaseUrl ?? ""],
		["pinata_jwt", next.pinataJwt ?? ""],
		["demo_bank", next.demoBank ?? ""],
		["dev_mode", next.devMode ? "true" : "false"],
		["database_url_kyc", next.databaseUrlKyc ?? ""],
		["kyc_auto_approve", next.kycAutoApprove ? "true" : "false"]
	];
	for (const [key, value] of pairs) await live`
      insert into infra_settings (key, value, updated_at)
      values (${key}, ${value}, now())
      on conflict (key) do update set value = ${value}, updated_at = now()
    `;
	return loadInfra(live);
}
async function tableCounts(sql) {
	const names = [
		"events",
		"ticket_tiers",
		"tickets",
		"listings",
		"ledger",
		"organizers",
		"kyc",
		"kyc_public",
		"kyc_audit",
		"deployed_contracts",
		"admins",
		"withdraw_requests"
	];
	const out = [];
	for (const name of names) try {
		const row = (await sql.query(`select count(*)::int as n from ${name}`))[0];
		out.push({
			name,
			n: row?.n ?? 0
		});
	} catch {
		out.push({
			name,
			n: 0
		});
	}
	return out;
}
async function listContracts(sql) {
	try {
		return await sql`select * from deployed_contracts order by id desc limit 40`;
	} catch {
		return [];
	}
}
async function recordContract(sql, row) {
	await sql`
    insert into deployed_contracts (kind, event_id, address, tx_hash)
    values (${row.kind}, ${row.eventId ?? null}, ${row.address}, ${row.tx})
  `;
}
//#endregion
export { listContracts, loadInfra, recordContract, saveInfra, tableCounts };
