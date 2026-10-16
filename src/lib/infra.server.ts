import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import {
  describeDatabaseUrl,
  envDatabaseUrlSet,
  getDbSource,
  probePostgres,
  reconnectDatabase,
  resolveDatabaseUrl,
  type Sql,
} from "@/lib/db";
import { readPlatform } from "@/lib/platform";
import { normalizeWallet } from "@/lib/session.server";
import { assertNetworkChangeAllowed, isGnosisMainnet } from "@/lib/network-config";

const DB_POINTER = "/workspace/.data/db-pointer.json";
const LEGACY_INFRA_PATH = "/workspace/.data/infra.json";

export type InfraFile = {
  databaseUrl?: string;
  rpcUrl?: string;
  chainId?: number;
  chainName?: string;
  nativeSymbol?: string;
  explorerUrl?: string;
  operatorPk?: string;
  pinataJwt?: string;
  demoBank?: string;
  devMode?: boolean;
  databaseUrlKyc?: string;
  kycAutoApprove?: boolean;
};

function readJsonFile(path: string): InfraFile {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as InfraFile;
  } catch {
    return {};
  }
}

function readFileConfig(): InfraFile {
  const pointer = readJsonFile(DB_POINTER);
  const legacy = readJsonFile(LEGACY_INFRA_PATH);
  return { ...legacy, ...pointer };
}

/** Local reconnect pointer only. Never write operator keys or Pinata JWTs here. */
function writeDbPointer(databaseUrl: string) {
  mkdirSync(dirname(DB_POINTER), { recursive: true });
  if (!databaseUrl) return;
  writeFileSync(DB_POINTER, `${JSON.stringify({ databaseUrl }, null, 2)}\n`);
}

export async function loadInfra(sql: Sql) {
  const file = readFileConfig();
  const plat = readPlatform();
  let map: Map<string, string> | null = null;
  try {
    const rows = await sql<{ key: string; value: string }>`select key, value from infra_settings`;
    map = new Map(rows.map((r) => [r.key, r.value]));
  } catch {
    map = null;
  }
  const get = (key: string, fallback = "") => (map && map.has(key) ? (map.get(key) ?? "") : fallback);
  const chainId = Number(get("chain_id") || file.chainId || plat.chainId) || plat.chainId;
  const mainnet = isGnosisMainnet(chainId);
  const devMode = !mainnet && (map?.has("dev_mode") ? map.get("dev_mode") === "true" : file.devMode === true);
  const demoBank = mainnet ? "" : (map?.has("demo_bank") ? (map.get("demo_bank") ?? "").trim() : (file.demoBank || "").trim());
  return {
    databaseUrl: (get("database_url") || file.databaseUrl || "").trim(),
    rpcUrl: (get("rpc_url") || file.rpcUrl || plat.rpcUrl).trim(),
    chainId,
    chainName: (get("chain_name") || file.chainName || plat.chainName).trim(),
    nativeSymbol: (get("native_symbol") || file.nativeSymbol || plat.nativeSymbol).trim(),
    explorerUrl: (get("explorer_url") || file.explorerUrl || plat.explorerUrl).trim(),
    operatorPk: (get("operator_pk") || file.operatorPk || "").trim(),
    pinataJwt: (get("pinata_jwt") || file.pinataJwt || "").trim(),
    demoBank,
    devMode,
    databaseUrlKyc: (get("database_url_kyc") || "").trim(),
    kycAutoApprove: !mainnet && devMode && get("kyc_auto_approve") === "true",
  };
}

export async function saveInfra(
  sql: Sql,
  patch: Partial<InfraFile> & {
    clearOperatorPk?: boolean;
    clearDatabaseUrl?: boolean;
    clearPinata?: boolean;
    clearDatabaseUrlKyc?: boolean;
  },
) {
  const current = await loadInfra(sql);
  const plat = readPlatform();
  const next: InfraFile = {
    databaseUrl: patch.clearDatabaseUrl
      ? ""
      : patch.databaseUrl !== undefined
        ? patch.databaseUrl.trim()
        : current.databaseUrl,
    rpcUrl: (patch.rpcUrl ?? current.rpcUrl).trim() || plat.rpcUrl,
    chainId: patch.chainId ?? current.chainId,
    chainName: (patch.chainName ?? current.chainName).trim(),
    nativeSymbol: (patch.nativeSymbol ?? current.nativeSymbol).trim(),
    explorerUrl: (patch.explorerUrl ?? current.explorerUrl).trim() || plat.explorerUrl,
    operatorPk: patch.clearOperatorPk
      ? ""
      : patch.operatorPk && patch.operatorPk.trim()
        ? patch.operatorPk.trim()
        : current.operatorPk,
    pinataJwt: patch.clearPinata
      ? ""
      : patch.pinataJwt !== undefined
        ? patch.pinataJwt.trim()
        : current.pinataJwt,
    demoBank: isGnosisMainnet(patch.chainId ?? current.chainId)
      ? ""
      : patch.demoBank !== undefined
        ? patch.demoBank.trim()
        : current.demoBank,
    devMode: isGnosisMainnet(patch.chainId ?? current.chainId) ? false : (patch.devMode ?? current.devMode),
    databaseUrlKyc: patch.clearDatabaseUrlKyc
      ? ""
      : patch.databaseUrlKyc !== undefined
        ? patch.databaseUrlKyc.trim()
        : current.databaseUrlKyc,
    kycAutoApprove: !isGnosisMainnet(patch.chainId ?? current.chainId) && (patch.devMode ?? current.devMode) && (patch.kycAutoApprove ?? current.kycAutoApprove),
  };

  if (!Number.isSafeInteger(next.chainId) || (next.chainId ?? 0) <= 0) {
    throw new Error("Chain ID must be a positive integer.");
  }

  if (isGnosisMainnet(next.chainId ?? 0) && patch.devMode === true) {
    throw new Error("Dev mode and test DxDAI are disabled on Gnosis mainnet.");
  }
  const eventCount = (await sql<{ n: number }>`select count(*)::int as n from events`)[0]?.n ?? 0;
  assertNetworkChangeAllowed(current.chainId, next.chainId ?? current.chainId, eventCount);

  if (next.operatorPk && !/^0x[0-9a-fA-F]{64}$/.test(next.operatorPk)) {
    throw new Error("Operator private key must be 0x followed by 64 hex chars.");
  }
  if (next.demoBank) normalizeWallet(next.demoBank);

  const liveBefore = resolveDatabaseUrl() || "";
  if (next.databaseUrl) writeDbPointer(next.databaseUrl);

  const want = next.databaseUrl || "";
  let live = sql;
  if (want !== liveBefore) {
    if (want) await probePostgres(want);
    live = await reconnectDatabase(want || null);
  }

  const pairs: [string, string][] = [
    ["rpc_url", next.rpcUrl ?? ""],
    ["chain_id", String(next.chainId ?? plat.chainId)],
    ["chain_name", next.chainName ?? plat.chainName],
    ["native_symbol", next.nativeSymbol ?? plat.nativeSymbol],
    ["explorer_url", next.explorerUrl ?? ""],
    ["operator_pk", next.operatorPk ?? ""],
    ["database_url", next.databaseUrl ?? ""],
    ["pinata_jwt", next.pinataJwt ?? ""],
    ["demo_bank", next.demoBank ?? ""],
    ["dev_mode", next.devMode ? "true" : "false"],
    ["database_url_kyc", next.databaseUrlKyc ?? ""],
    ["kyc_auto_approve", next.kycAutoApprove ? "true" : "false"],
  ];
  for (const [key, value] of pairs) {
    await live`
      insert into infra_settings (key, value, updated_at)
      values (${key}, ${value}, now())
      on conflict (key) do update set value = ${value}, updated_at = now()
    `;
  }

  return loadInfra(live);
}

export async function tableCounts(sql: Sql) {
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
    "withdraw_requests",
  ];
  const out: { name: string; n: number }[] = [];
  for (const name of names) {
    try {
      const row = (
        await sql.query<{ n: number }>(`select count(*)::int as n from ${name}`)
      )[0];
      out.push({ name, n: row?.n ?? 0 });
    } catch {
      out.push({ name, n: 0 });
    }
  }
  return out;
}

export async function listContracts(sql: Sql) {
  try {
    return await sql<{
      id: number;
      kind: string;
      event_id: number | null;
      address: string;
      tx_hash: string;
      created_at: string;
    }>`select * from deployed_contracts order by id desc limit 40`;
  } catch {
    return [];
  }
}

export async function recordContract(
  sql: Sql,
  row: { kind: string; eventId?: number | null; address: string; tx: string },
) {
  await sql`
    insert into deployed_contracts (kind, event_id, address, tx_hash)
    values (${row.kind}, ${row.eventId ?? null}, ${row.address}, ${row.tx})
  `;
}

export { describeDatabaseUrl, envDatabaseUrlSet, getDbSource };
