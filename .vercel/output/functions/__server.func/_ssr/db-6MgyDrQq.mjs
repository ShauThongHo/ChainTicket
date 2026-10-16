import { r as __exportAll } from "../_runtime.mjs";
import { t as __exportAll$1 } from "./rolldown-runtime-D7D4PA-g.mjs";
import { readFileSync } from "node:fs";
//#region node_modules/.nitro/vite/services/ssr/assets/db-6MgyDrQq.js
var db_6MgyDrQq_exports = /* @__PURE__ */ __exportAll({
	a: () => getSql,
	c: () => resolveDatabaseUrl,
	i: () => getDbSource,
	n: () => describeDatabaseUrl,
	o: () => probePostgres,
	r: () => envDatabaseUrlSet,
	s: () => reconnectDatabase,
	t: () => db_exports
});
var _0002_chainticket_default = "-- ChainTicket vault ledger (Web2.5). Wallet address is identity.\n\ncreate table if not exists platform_settings (\n  id integer primary key,\n  royalty_bps integer not null default 1000,\n  updated_at timestamptz not null default now()\n);\ninsert into platform_settings (id, royalty_bps) values (1, 1000)\n  on conflict (id) do nothing;\n\ncreate table if not exists admins (\n  wallet text primary key,\n  created_at timestamptz not null default now()\n);\n\ncreate table if not exists organizers (\n  wallet text primary key,\n  name text not null,\n  status text not null default 'pending',\n  created_at timestamptz not null default now()\n);\n\ncreate table if not exists kyc (\n  wallet text primary key,\n  full_name text not null,\n  id_number text not null,\n  verified_at timestamptz not null default now()\n);\n\ncreate table if not exists accounts (\n  wallet text primary key,\n  spendable_cents integer not null default 0,\n  faucet_claimed boolean not null default false\n);\n\ncreate table if not exists events (\n  id serial primary key,\n  organizer_wallet text not null,\n  name text not null,\n  description text not null default '',\n  venue text not null default '',\n  category text not null default 'Concert',\n  poster_url text not null default '',\n  starts_at timestamptz not null,\n  ends_at timestamptz not null,\n  cancelled_at timestamptz,\n  created_at timestamptz not null default now()\n);\n\ncreate table if not exists ticket_tiers (\n  id serial primary key,\n  event_id integer not null references events (id) on delete cascade,\n  name text not null,\n  face_cents integer not null,\n  supply integer not null,\n  contract_address text not null\n);\n\ncreate table if not exists tickets (\n  id serial primary key,\n  event_id integer not null references events (id) on delete cascade,\n  tier_id integer not null references ticket_tiers (id) on delete cascade,\n  serial integer not null,\n  token_id text not null unique,\n  owner_wallet text not null,\n  status text not null,\n  face_cents integer not null,\n  created_at timestamptz not null default now()\n);\n\ncreate table if not exists listings (\n  id serial primary key,\n  ticket_id integer not null references tickets (id) on delete cascade,\n  event_id integer not null,\n  tier_id integer not null,\n  seller_wallet text not null,\n  price_cents integer not null,\n  active boolean not null default true,\n  created_at timestamptz not null default now()\n);\n\ncreate table if not exists event_vaults (\n  event_id integer primary key references events (id) on delete cascade,\n  locked_cents integer not null default 0,\n  withdrawn boolean not null default false\n);\n\ncreate table if not exists ledger (\n  id serial primary key,\n  event_id integer,\n  ticket_id integer,\n  kind text not null,\n  from_wallet text,\n  to_wallet text,\n  amount_cents integer not null default 0,\n  ref text not null,\n  created_at timestamptz not null default now()\n);\n\ncreate table if not exists login_nonces (\n  nonce text primary key,\n  created_at timestamptz not null default now()\n);\n\ncreate index if not exists tickets_owner_idx on tickets (owner_wallet);\ncreate index if not exists tickets_event_idx on tickets (event_id);\ncreate index if not exists listings_tier_active_idx on listings (tier_id, active, price_cents);\ncreate index if not exists listings_ticket_idx on listings (ticket_id);\ncreate index if not exists events_starts_idx on events (starts_at);\n";
var _0003_infra_default = "-- Admin-managed infrastructure (RPC, signer, optional Neon URL pointer).\n-- Secrets may also be mirrored in .data/infra.json so a DATABASE_URL override\n-- survives process restart. Never expose these rows to the browser unmasked.\n\ncreate table if not exists infra_settings (\n  key text primary key,\n  value text not null default '',\n  updated_at timestamptz not null default now()\n);\n\ninsert into infra_settings (key, value) values\n  ('rpc_url', 'https://rpc.chiadochain.net'),\n  ('chain_id', '10200'),\n  ('explorer_url', 'https://gnosis-chiado.blockscout.com'),\n  ('marketplace_address', ''),\n  ('vault_address', ''),\n  ('operator_pk', ''),\n  ('database_url', '')\non conflict (key) do nothing;\n\ncreate index if not exists ledger_kind_idx on ledger (kind, created_at desc);\n";
var _0004_onchain_default = "alter table events add column if not exists vault_address text;\nalter table events add column if not exists marketplace_address text;\nalter table events add column if not exists deploy_tx text;\n\nalter table tickets add column if not exists chain_id integer;\n\ncreate table if not exists deployed_contracts (\n  id serial primary key,\n  kind text not null,\n  event_id integer,\n  address text not null,\n  tx_hash text not null default '',\n  created_at timestamptz not null default now()\n);\n\ninsert into infra_settings (key, value) values\n  ('pinata_jwt', ''),\n  ('demo_bank', ''),\n  ('dev_mode', 'false')\non conflict (key) do nothing;\n";
var _0005_ops_default = "alter table events add column if not exists frozen_at timestamptz;\nalter table events add column if not exists engine_version integer;\n\ncreate table if not exists withdraw_requests (\n  id serial primary key,\n  event_id integer not null references events(id) on delete cascade,\n  organizer_wallet text not null,\n  amount_cents integer not null default 0,\n  status text not null default 'pending',\n  decided_by text,\n  decided_at timestamptz,\n  tx_hash text,\n  note text,\n  created_at timestamptz not null default now()\n);\n\ncreate table if not exists pending_index (\n  id serial primary key,\n  kind text not null,\n  tx_hash text not null,\n  payload jsonb not null default '{}',\n  error text,\n  resolved_at timestamptz,\n  created_at timestamptz not null default now()\n);\n\ncreate unique index if not exists pending_index_tx on pending_index (tx_hash);\n";
var _0006_nft_gov_default = "alter table events add column if not exists collection_address text;\nalter table tickets add column if not exists token_uri text;\n\nalter table withdraw_requests add column if not exists yes_weight integer not null default 0;\nalter table withdraw_requests add column if not exists sold_weight integer not null default 0;\nalter table withdraw_requests add column if not exists deadline timestamptz;\nalter table withdraw_requests add column if not exists materials_uri text;\nalter table withdraw_requests add column if not exists proposal_id integer;\n\ncreate table if not exists withdraw_votes (\n  id serial primary key,\n  request_id integer not null references withdraw_requests (id) on delete cascade,\n  ticket_id integer not null,\n  chain_id integer not null,\n  voter text not null,\n  tx_hash text not null default '',\n  created_at timestamptz not null default now()\n);\n\ncreate unique index if not exists withdraw_votes_req_token on withdraw_votes (request_id, chain_id);\n";
var _0007_perf_indexes_default = "create index if not exists listings_event_active_idx on listings (event_id) where active = true;\ncreate index if not exists tickets_event_status_idx on tickets (event_id, status);\ncreate index if not exists events_organizer_idx on events (organizer_wallet);\n";
var _0008_kyc_split_default = "-- Public KYC index. Identity plaintext lives only in the private store.\n\ncreate table if not exists kyc_public (\n  wallet text primary key,\n  kyc_ref text not null unique,\n  status text not null,\n  submitted_at timestamptz not null default now(),\n  verified_at timestamptz,\n  reviewed_by text,\n  reject_reason text\n);\n\ncreate index if not exists kyc_public_status_idx on kyc_public (status, submitted_at desc);\n\ncreate table if not exists kyc_audit (\n  id serial primary key,\n  admin_wallet text not null,\n  kyc_ref text not null,\n  wallet text not null,\n  action text not null,\n  created_at timestamptz not null default now()\n);\n\ncreate index if not exists kyc_audit_ref_idx on kyc_audit (kyc_ref, created_at desc);\n\n-- Used when DATABASE_URL_KYC is unset (ciphertext still never sits on kyc_public).\ncreate table if not exists kyc_private (\n  kyc_ref text primary key,\n  wallet text not null,\n  full_name_enc text not null,\n  id_number_enc text not null,\n  nationality_enc text not null,\n  id_number_hash text not null unique,\n  id_last4 text,\n  photo_object_key text,\n  photo_sha256 text,\n  created_at timestamptz not null default now(),\n  updated_at timestamptz not null default now()\n);\n\ncreate index if not exists kyc_private_wallet_idx on kyc_private (wallet);\n\nalter table kyc add column if not exists migrated_ref text;\n";
var _0009_kyc_expiry_default = "alter table kyc_public add column if not exists document_expires_at timestamptz;\nalter table kyc_private add column if not exists document_expires_at timestamptz;\n";
var _0010_mint_jobs_default = "create table if not exists mint_jobs (\n  id text primary key,\n  organizer_wallet text not null,\n  current_step integer not null default 0,\n  status text not null default 'pending',\n  error text,\n  event_id integer,\n  updated_at timestamptz not null default now()\n);\ncreate index if not exists mint_jobs_wallet_updated_idx on mint_jobs (organizer_wallet, updated_at desc);\n";
/**
* Migration bookkeeping shared by the two appliers — `scripts/migrate.mjs`
* (deploy, `readdir`) and `src/lib/db.ts` (PGLite preview, `import.meta.glob`).
*
* Applied files are keyed by BASENAME, so the same file applies once no matter
* which directory it is globbed from. That is what makes the auth schema safe to
* copy from `migrations/auth/` into `migrations/` when an app turns sign-in on:
* a database that already has `0001_auth.sql` will not re-run it.
*
* Neither applier descends into subdirectories, so `migrations/auth/*.sql` is
* out of scope for both until it is copied up.
*/
/**
* The `_migrations` key for a migration path (or bare filename).
* @param {string} path
* @returns {string}
*/
function migrationName(path) {
	return path.split("/").pop() ?? path;
}
/**
* @param {string} path
* @returns {boolean}
*/
function isMigrationFile(path) {
	return path.endsWith(".sql");
}
/**
* Migrations in `paths` that are not yet in `applied`, in apply order.
* Non-`.sql` entries (a `readdir` also yields `migrations/auth/`) are dropped.
* @param {Iterable<string>} paths
* @param {Iterable<string>} applied
* @returns {Array<{ name: string, path: string }>}
*/
function pendingMigrations(paths, applied) {
	const done = new Set(applied);
	return [...paths].filter(isMigrationFile).map((path) => ({
		name: migrationName(path),
		path
	})).sort((a, b) => a.name.localeCompare(b.name)).filter(({ name }) => !done.has(name));
}
var db_exports = /* @__PURE__ */ __exportAll$1({
	describeDatabaseUrl: () => describeDatabaseUrl,
	ensureDbReady: () => ensureDbReady,
	envDatabaseUrlSet: () => envDatabaseUrlSet,
	getDbSource: () => getDbSource,
	getSql: () => getSql,
	probePostgres: () => probePostgres,
	reconnectDatabase: () => reconnectDatabase,
	resolveDatabaseUrl: () => resolveDatabaseUrl
});
var INFRA_PATH = "/workspace/.data/infra.json";
var DB_POINTER = "/workspace/.data/db-pointer.json";
var rawDatabaseUrl = typeof process !== "undefined" ? process.env.DATABASE_URL : void 0;
var envDatabaseUrl = rawDatabaseUrl && rawDatabaseUrl.trim() ? rawDatabaseUrl.trim() : void 0;
/**
* Init state lives on globalThis as promises: dev HMR creates new instances of
* this module, and two instances racing module-level state would open a second
* pool or run two concurrent PGLite migration passes (whose duplicate
* `_migrations` insert rejects — and would get memoized, poisoning every later
* `getSql()`). A failed init clears its slot so the next call retries.
*/
var globalRef = globalThis;
function readUrlFrom(path) {
	try {
		const parsed = JSON.parse(readFileSync(path, "utf8"));
		if (typeof parsed.databaseUrl === "string" && parsed.databaseUrl.trim()) return parsed.databaseUrl.trim();
	} catch {}
}
function readOverrideDatabaseUrl() {
	if (globalRef.__ctDbUrl__ && globalRef.__ctDbUrl__.trim()) return globalRef.__ctDbUrl__.trim();
	return readUrlFrom(DB_POINTER) || readUrlFrom(INFRA_PATH);
}
function resolveDatabaseUrl() {
	return readOverrideDatabaseUrl() || envDatabaseUrl;
}
function getDbSource() {
	return resolveDatabaseUrl() ? "neon" : "pglite";
}
function envDatabaseUrlSet() {
	return Boolean(envDatabaseUrl);
}
function describeDatabaseUrl(url) {
	if (!url) return {
		host: "embedded PGLite",
		masked: "pglite://memory"
	};
	try {
		const u = new URL(url);
		if (u.password) u.password = "••••";
		return {
			host: u.host,
			masked: u.toString()
		};
	} catch {
		return {
			host: "configured",
			masked: "postgres://••••"
		};
	}
}
/**
* Result-type parity: Postgres sends every value as text plus a type OID — the
* JS value is the DRIVER's parsing choice, and pg and PGLite disagree (pg:
* int8 -> string, date -> local-midnight Date; PGLite: int8 -> BigInt, which
* JSON.stringify rejects, date -> UTC Date). Normalize both so preview and
* production return identical, JSON-safe shapes:
*   int8/bigint (incl. count(*)) -> number (past 2^53 loses precision — cast
*                                   `::text` if you ever need huge integers)
*   date                         -> 'YYYY-MM-DD' string
*   interval                     -> Postgres interval text
* numeric already comes back as a string on both (arbitrary precision).
*/
var OID_INT8 = 20;
var OID_DATE = 1082;
var OID_INTERVAL = 1186;
var identity = (v) => v;
/** Wrap a query runner in the tagged-template + `.query()` `Sql` surface. */
function toSql(run) {
	const sql = (async (strings, ...values) => {
		let text = strings[0];
		for (let i = 0; i < values.length; i += 1) text += `$${i + 1}${strings[i + 1]}`;
		return run(text, values);
	});
	sql.query = (text, params = []) => run(text, params);
	return sql;
}
function migrationFiles() {
	return /* #__PURE__ */ Object.assign({
		"/migrations/0002_chainticket.sql": _0002_chainticket_default,
		"/migrations/0003_infra.sql": _0003_infra_default,
		"/migrations/0004_onchain.sql": _0004_onchain_default,
		"/migrations/0005_ops.sql": _0005_ops_default,
		"/migrations/0006_nft_gov.sql": _0006_nft_gov_default,
		"/migrations/0007_perf_indexes.sql": _0007_perf_indexes_default,
		"/migrations/0008_kyc_split.sql": _0008_kyc_split_default,
		"/migrations/0009_kyc_expiry.sql": _0009_kyc_expiry_default,
		"/migrations/0010_mint_jobs.sql": _0010_mint_jobs_default
	});
}
function createNeonSql(url) {
	globalRef.__pgSqlPromise__ ??= (async () => {
		const { Pool, types } = await import("../_libs/pg.mjs").then((n) => n.t);
		types.setTypeParser(OID_INT8, Number);
		types.setTypeParser(OID_DATE, identity);
		types.setTypeParser(OID_INTERVAL, identity);
		const pool = new Pool({
			connectionString: url,
			max: 4,
			connectionTimeoutMillis: 8e3
		});
		const client = await pool.connect();
		try {
			await client.query("create table if not exists _migrations (name text primary key, applied_at timestamptz not null default now())");
			const done = (await client.query("select name from _migrations")).rows.map((r) => r.name);
			const migrations = migrationFiles();
			for (const { name, path } of pendingMigrations(Object.keys(migrations), done)) {
				await client.query("BEGIN");
				try {
					await client.query(migrations[path]);
					await client.query("insert into _migrations (name) values ($1)", [name]);
					await client.query("COMMIT");
				} catch (err) {
					try {
						await client.query("ROLLBACK");
					} catch {}
					throw err;
				}
			}
		} finally {
			client.release();
		}
		return toSql(async (text, params) => {
			return (await pool.query(text, params)).rows;
		});
	})().catch((err) => {
		globalRef.__pgSqlPromise__ = void 0;
		throw err;
	});
	return globalRef.__pgSqlPromise__;
}
async function createPgliteSql() {
	globalRef.__pgliteInstance__ ??= (async () => {
		const { PGlite } = await import("../_libs/electric-sql__pglite.mjs").then((n) => n.t);
		const pg = new PGlite({ parsers: {
			[OID_INT8]: Number,
			[OID_DATE]: identity,
			[OID_INTERVAL]: identity
		} });
		await pg.waitReady;
		await pg.exec("create table if not exists _migrations (name text primary key, applied_at timestamptz not null default now())");
		return pg;
	})().catch((err) => {
		globalRef.__pgliteInstance__ = void 0;
		throw err;
	});
	const pg = await globalRef.__pgliteInstance__;
	const migrate = async () => {
		const migrations = migrationFiles();
		const done = (await pg.query("select name from _migrations")).rows.map((r) => r.name);
		for (const { name, path } of pendingMigrations(Object.keys(migrations), done)) await pg.transaction(async (tx) => {
			await tx.exec(migrations[path]);
			await tx.query("insert into _migrations (name) values ($1)", [name]);
		});
	};
	const pass = (globalRef.__pgliteMigrateChain__ ?? Promise.resolve()).catch(() => void 0).then(migrate);
	globalRef.__pgliteMigrateChain__ = pass;
	await pass;
	return toSql(async (text, params) => {
		return (await pg.query(text, params)).rows;
	});
}
var sqlPromise = null;
async function createSql() {
	if (typeof window !== "undefined") throw new Error("@/lib/db is server-only — call getSql() from a createServerFn handler or a server route loader, never from client code.");
	const url = resolveDatabaseUrl();
	return url ? createNeonSql(url) : createPgliteSql();
}
/**
* Get the shared, **server-only** SQL client. Neon when `DATABASE_URL` is set,
* otherwise the local PGLite fallback. Memoized — safe to call per request.
*
* Schema comes from `migrations/*.sql`, auto-applied before the first query on
* both backends — define tables there, never inline in server functions.
*/
function getSql() {
	sqlPromise ??= createSql().catch((err) => {
		sqlPromise = null;
		throw err;
	});
	return sqlPromise;
}
/** Probe a postgres URL without swapping the live client. */
async function probePostgres(url) {
	const { Pool, types } = await import("../_libs/pg.mjs").then((n) => n.t);
	types.setTypeParser(OID_INT8, Number);
	const pool = new Pool({
		connectionString: url,
		max: 1,
		connectionTimeoutMillis: 8e3
	});
	try {
		const res = await pool.query("select now()::text as now, version() as version");
		return {
			now: res.rows[0]?.now ?? "",
			version: res.rows[0]?.version ?? ""
		};
	} finally {
		await pool.end();
	}
}
/** Switch the live SQL client to a new URL (or back to env / PGLite). */
async function reconnectDatabase(url) {
	globalRef.__ctDbUrl__ = url && url.trim() ? url.trim() : "";
	globalRef.__ctBootGen__ = (globalRef.__ctBootGen__ ?? 0) + 1;
	globalRef.__ctBoot__ = void 0;
	sqlPromise = null;
	globalRef.__pgSqlPromise__ = void 0;
	return getSql();
}
/**
* Finish DB bootstrap before the server handles traffic.
*
* - **PGLite** (preview / no `DATABASE_URL`): open the in-memory DB and apply
*   `migrations/*.sql`. Idempotent — concurrent callers share one promise.
* - **Neon**: no-op (pool is created lazily on first query).
*
* Vite `configureServer` awaits this at dev startup; production imports of this
* module kick it off immediately (see bottom of file).
*/
function ensureDbReady() {
	if (getDbSource() !== "pglite") return Promise.resolve();
	return getSql().then(() => void 0);
}
var globalBoot = globalThis;
if (typeof window === "undefined" && getDbSource() === "pglite") globalBoot.__pgBootstrapPromise__ ??= ensureDbReady().catch((err) => {
	globalBoot.__pgBootstrapPromise__ = void 0;
	console.error("[db] PGLite bootstrap failed:", err);
	throw err;
});
//#endregion
export { reconnectDatabase as a, probePostgres as i, describeDatabaseUrl as n, resolveDatabaseUrl as o, getSql as r, db_6MgyDrQq_exports as t };
