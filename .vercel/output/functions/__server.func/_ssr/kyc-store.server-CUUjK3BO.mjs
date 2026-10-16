import { n as describeDatabaseUrl } from "./db-6MgyDrQq.mjs";
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
//#region node_modules/.nitro/vite/services/ssr/assets/kyc-store.server-CUUjK3BO.js
/** Trim, uppercase, drop internal whitespace. Not logged. */
function normalizeId(id) {
	return id.trim().toUpperCase().replace(/\s+/g, "");
}
function idLast4(id) {
	return normalizeId(id).replace(/[^A-Z0-9]/g, "").slice(-4);
}
function newKycRef() {
	return randomBytes(16).toString("hex");
}
/** 64 hex chars or standard base64 that decodes to 32 bytes. */
function decodeAesKey(raw) {
	const v = raw.trim();
	if (/^[0-9a-fA-F]{64}$/.test(v)) return Buffer.from(v, "hex");
	const buf = Buffer.from(v, "base64");
	if (buf.length === 32) return buf;
	throw new Error("KYC_AES_KEY must be 32 bytes (64 hex characters or base64).");
}
/** Pack iv.tag.ciphertext as base64url. AES-256-GCM, fresh IV per value. */
function seal(plain, key) {
	const iv = randomBytes(12);
	const cipher = createCipheriv("aes-256-gcm", key, iv);
	const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
	const tag = cipher.getAuthTag();
	return `${iv.toString("base64url")}.${tag.toString("base64url")}.${ct.toString("base64url")}`;
}
function openSeal(packed, key) {
	const [ivB, tagB, ctB] = packed.split(".");
	if (!ivB || !tagB || !ctB) throw new Error("Could not read this KYC record.");
	const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivB, "base64url"));
	decipher.setAuthTag(Buffer.from(tagB, "base64url"));
	return Buffer.concat([decipher.update(Buffer.from(ctB, "base64url")), decipher.final()]).toString("utf8");
}
function idHash(normalizedId, pepper) {
	return createHmac("sha256", pepper).update(normalizedId).digest("hex");
}
var MAX_BYTES = 4e6;
function dir() {
	return join(process.cwd(), ".data", "kyc-photos");
}
function stripJpegExif(buf) {
	if (buf.length < 4 || buf[0] !== 255 || buf[1] !== 216) return buf;
	const parts = [buf.subarray(0, 2)];
	let i = 2;
	while (i + 4 < buf.length) {
		if (buf[i] !== 255) {
			parts.push(buf.subarray(i));
			break;
		}
		const marker = buf[i + 1];
		if (marker === 216) {
			i += 2;
			continue;
		}
		if (marker === 217 || marker === 218) {
			parts.push(buf.subarray(i));
			break;
		}
		const len = buf.readUInt16BE(i + 2);
		if (len < 2 || i + 2 + len > buf.length) break;
		if (marker !== 225) parts.push(buf.subarray(i, i + 2 + len));
		i += 2 + len;
	}
	return Buffer.concat(parts);
}
function stripPngMeta(buf) {
	const sig = Buffer.from([
		137,
		80,
		78,
		71,
		13,
		10,
		26,
		10
	]);
	if (buf.length < 8 || !buf.subarray(0, 8).equals(sig)) return buf;
	const parts = [sig];
	let i = 8;
	const drop = /* @__PURE__ */ new Set([
		"eXIf",
		"tEXt",
		"zTXt",
		"iTXt",
		"tIME"
	]);
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
function storeKycPhoto(ref, raw, type) {
	if (!/^[a-f0-9]{32}$/.test(ref)) throw new Error("Could not store the document photo.");
	const jpeg = raw.length >= 3 && raw[0] === 255 && raw[1] === 216 && raw[2] === 255;
	const png = raw.length >= 8 && raw[0] === 137 && raw[1] === 80 && raw[2] === 78 && raw[3] === 71;
	if (type === "image/jpeg" && !jpeg) throw new Error("Photo must be a JPEG file.");
	if (type === "image/png" && !png) throw new Error("Photo must be a PNG file.");
	const stripped = type === "image/jpeg" ? stripJpegExif(raw) : stripPngMeta(raw);
	if (stripped.length < 32 || stripped.length > MAX_BYTES) throw new Error("Photo must be under 4MB.");
	mkdirSync(dir(), { recursive: true });
	for (const ext of ["jpg", "png"]) try {
		unlinkSync(join(dir(), `${ref}.${ext}`));
	} catch {}
	const key = `${ref}.${type === "image/jpeg" ? "jpg" : "png"}`;
	writeFileSync(join(dir(), key), stripped, { mode: 384 });
	return {
		key,
		sha256: createHash("sha256").update(stripped).digest("hex")
	};
}
function readKycPhoto(key) {
	if (!/^[a-f0-9]{32}\.(jpg|png)$/.test(key)) throw new Error("Photo not found.");
	return {
		bytes: readFileSync(join(dir(), key)),
		contentType: key.endsWith(".png") ? "image/png" : "image/jpeg"
	};
}
/**
* Identity store.
* Env (preferred, never returned to the client):
*   DATABASE_URL_KYC  — second Neon project. If unset, ciphertext stays in the
*                       business database table kyc_private (not kyc_public).
*   KYC_AES_KEY       — 32-byte AES-256-GCM key (64 hex or base64). Required in production.
*   KYC_HMAC_PEPPER   — HMAC-SHA256 pepper for ID dedupe. Required with the AES key.
*   KYC_REQUIRE_ENV_KEYS — "true" refuses keys stored in the business database.
*   KYC_AUTO_APPROVE  — "true" approves on submit; otherwise pending for admin.
* Demo only: if the key env vars are unset and KYC_REQUIRE_ENV_KEYS is not set,
* one pair is generated into infra_settings and never sent to the browser.
*/
var PRIVATE_TABLE = `
create table if not exists kyc_private (
  kyc_ref text primary key,
  wallet text not null,
  full_name_enc text not null,
  id_number_enc text not null,
  nationality_enc text not null,
  id_number_hash text not null unique,
  id_last4 text,
  photo_object_key text,
  photo_sha256 text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
)`;
var PRIVATE_INDEX = `create index if not exists kyc_private_wallet_idx on kyc_private (wallet)`;
function slotRef() {
	return globalThis;
}
function toSql(run) {
	const sql = (async (strings, ...values) => {
		let text = strings[0] ?? "";
		for (let i = 0; i < values.length; i += 1) text += `$${i + 1}${strings[i + 1] ?? ""}`;
		return run(text, values);
	});
	sql.query = ((text, params = []) => run(text, params));
	return sql;
}
function envKeysRequired() {
	const flag = (process.env.KYC_REQUIRE_ENV_KEYS || "").trim().toLowerCase();
	return flag === "true" || flag === "1";
}
async function kycPrivateTarget(sql) {
	const env = process.env.DATABASE_URL_KYC?.trim() || "";
	if (env) return {
		url: env,
		source: "env"
	};
	const saved = (await sql`select value from infra_settings where key = ${"database_url_kyc"}`)[0]?.value?.trim() || "";
	if (saved) return {
		url: saved,
		source: "database"
	};
	return {
		url: "",
		source: "shared"
	};
}
async function getKycSql(publicSql) {
	const target = await kycPrivateTarget(publicSql);
	const g = slotRef();
	if (!target.url) {
		if (g.__ctKycPool__) {
			await g.__ctKycPool__.end().catch(() => void 0);
			g.__ctKycPool__ = void 0;
		}
		await ensurePrivateSchema(publicSql);
		return {
			sql: publicSql,
			source: "shared"
		};
	}
	if (g.__ctKycPool__ && g.__ctKycPool__.url !== target.url) {
		await g.__ctKycPool__.end().catch(() => void 0);
		g.__ctKycPool__ = void 0;
	}
	if (!g.__ctKycPool__) {
		const { Pool, types } = await import("../_libs/pg.mjs").then((n) => n.t);
		types.setTypeParser(20, Number);
		const pool = new Pool({
			connectionString: target.url,
			max: 3,
			connectionTimeoutMillis: 8e3
		});
		try {
			(await pool.connect()).release();
		} catch (err) {
			await pool.end().catch(() => void 0);
			const msg = err instanceof Error ? err.message : "connect failed";
			if (/postgres(?:ql)?:\/\//i.test(msg)) throw new Error("KYC private database is unreachable.");
			throw new Error("KYC private database is unreachable.");
		}
		g.__ctKycPool__ = {
			url: target.url,
			ready: false,
			end: () => pool.end(),
			sql: toSql(async (text, params) => {
				return (await pool.query(text, params)).rows;
			})
		};
	}
	if (!g.__ctKycPool__.ready) {
		await ensurePrivateSchema(g.__ctKycPool__.sql);
		g.__ctKycPool__.ready = true;
	}
	return {
		sql: g.__ctKycPool__.sql,
		source: target.source
	};
}
async function ensurePrivateSchema(sql) {
	await sql.query(PRIVATE_TABLE);
	await sql.query(PRIVATE_INDEX);
	await sql.query(`alter table kyc_private add column if not exists document_expires_at timestamptz`);
}
async function ensureKycPublic(sql) {
	await sql`
    create table if not exists kyc_public (
      wallet text primary key,
      kyc_ref text not null unique,
      status text not null,
      submitted_at timestamptz not null default now(),
      verified_at timestamptz,
      reviewed_by text,
      reject_reason text
    )
  `;
	await sql`create index if not exists kyc_public_status_idx on kyc_public (status, submitted_at desc)`;
	await sql`
    create table if not exists kyc_audit (
      id serial primary key,
      admin_wallet text not null,
      kyc_ref text not null,
      wallet text not null,
      action text not null,
      created_at timestamptz not null default now()
    )
  `;
	await sql`create index if not exists kyc_audit_ref_idx on kyc_audit (kyc_ref, created_at desc)`;
	await sql`alter table kyc_public add column if not exists document_expires_at timestamptz`;
	try {
		await sql`alter table kyc add column if not exists migrated_ref text`;
	} catch {}
}
async function keyMaterial(sql) {
	const envKey = process.env.KYC_AES_KEY?.trim() || "";
	const envPepper = process.env.KYC_HMAC_PEPPER?.trim() || "";
	if (envKey || envPepper) {
		if (!envKey || !envPepper) throw new Error("Set both KYC_AES_KEY and KYC_HMAC_PEPPER, or neither.");
		return {
			aes: decodeAesKey(envKey),
			pepper: envPepper,
			source: "env"
		};
	}
	if (envKeysRequired()) throw new Error("Set KYC_AES_KEY and KYC_HMAC_PEPPER. Database-generated keys are disabled.");
	const rows = await sql`
    select key, value from infra_settings where key in ('kyc_aes_key', 'kyc_hmac_pepper')
  `;
	const map = new Map(rows.map((r) => [r.key, r.value.trim()]));
	let aesRaw = map.get("kyc_aes_key") || "";
	let pepper = map.get("kyc_hmac_pepper") || "";
	if (!aesRaw || !pepper) {
		aesRaw = randomBytes(32).toString("hex");
		pepper = randomBytes(32).toString("hex");
		for (const [key, value] of [["kyc_aes_key", aesRaw], ["kyc_hmac_pepper", pepper]]) await sql`
        insert into infra_settings (key, value, updated_at)
        values (${key}, ${value}, now())
        on conflict (key) do update set value = ${value}, updated_at = now()
      `;
	}
	return {
		aes: decodeAesKey(aesRaw),
		pepper,
		source: "database"
	};
}
async function kycAutoApprove(sql) {
	const flags = await sql`
    select key, value from infra_settings where key in ('dev_mode', 'kyc_auto_approve')
  `;
	const settings = new Map(flags.map((r) => [r.key, r.value]));
	if (settings.get("dev_mode") !== "true") return false;
	const env = process.env.KYC_AUTO_APPROVE?.trim().toLowerCase();
	if (env === "true" || env === "1") return true;
	if (env === "false" || env === "0") return false;
	return settings.get("kyc_auto_approve") === "true";
}
async function kycInfraSummary(sql) {
	const target = await kycPrivateTarget(sql);
	let keySource = "missing";
	let keyError = null;
	try {
		keySource = (await keyMaterial(sql)).source;
	} catch (err) {
		keyError = err instanceof Error ? err.message : "KYC keys are not configured.";
	}
	const host = target.url ? describeDatabaseUrl(target.url).host : "same database";
	return {
		privateSource: target.source,
		privateHost: host,
		keySource,
		keyError,
		autoApprove: await kycAutoApprove(sql),
		requireEnvKeys: envKeysRequired(),
		sharedWarning: target.source === "shared"
	};
}
function iso(v) {
	if (!v) return null;
	const d = v instanceof Date ? v : new Date(v);
	return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
function utcToday() {
	return (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
}
function expiryDay(v) {
	return iso(v)?.slice(0, 10) ?? null;
}
function asStatus(v) {
	if (v === "approved" || v === "rejected" || v === "pending" || v === "expired") return v;
	return "pending";
}
async function markExpired(sql, wallet) {
	const today = `${utcToday()}T00:00:00.000Z`;
	if (wallet) {
		await sql`
      update kyc_public
      set status = 'expired'
      where wallet = ${wallet}
        and status = 'approved'
        and document_expires_at is not null
        and document_expires_at < ${today}::timestamptz
    `;
		return;
	}
	await sql`
    update kyc_public
    set status = 'expired'
    where status = 'approved'
      and document_expires_at is not null
      and document_expires_at < ${today}::timestamptz
  `;
}
async function readOwnerKyc(sql, wallet) {
	await markExpired(sql, wallet);
	const row = (await sql`
      select status, submitted_at, verified_at, reject_reason, document_expires_at
      from kyc_public where wallet = ${wallet}
    `)[0];
	if (!row) return null;
	let last4 = null;
	try {
		last4 = (await (await getKycSql(sql)).sql`
        select id_last4 from kyc_private where wallet = ${wallet}
      `)[0]?.id_last4 ?? null;
	} catch {
		last4 = null;
	}
	return {
		status: asStatus(row.status),
		submittedAt: iso(row.submitted_at) ?? (/* @__PURE__ */ new Date(0)).toISOString(),
		verifiedAt: iso(row.verified_at),
		idLast4: last4,
		rejectReason: row.reject_reason,
		documentExpiresAt: expiryDay(row.document_expires_at)
	};
}
async function assertKycApproved(sql, wallet) {
	await markExpired(sql, wallet);
	const row = (await sql`select status from kyc_public where wallet = ${wallet}`)[0];
	if (!row) throw new Error("Complete KYC before buying.");
	if (row.status === "pending") throw new Error("KYC is waiting for admin approval.");
	if (row.status === "rejected") throw new Error("KYC was rejected. Submit it again.");
	if (row.status === "expired") throw new Error("This ID document has expired. Submit KYC again.");
	if (row.status !== "approved") throw new Error("KYC must be approved before buying.");
}
async function writePrivate(sql, row) {
	const keys = await keyMaterial(sql);
	const hash = idHash(normalizeId(row.idNumber), keys.pepper);
	const priv = await getKycSql(sql);
	const taken = (await priv.sql`
      select wallet from kyc_private where id_number_hash = ${hash}
    `)[0];
	if (taken && taken.wallet !== row.wallet) throw new Error("This ID is already registered to another wallet.");
	const nameEnc = seal(row.name, keys.aes);
	const idEnc = seal(row.idNumber.trim(), keys.aes);
	const natEnc = seal(row.nationality, keys.aes);
	const last4 = idLast4(row.idNumber);
	try {
		await priv.sql`
      insert into kyc_private (
        kyc_ref, wallet, full_name_enc, id_number_enc, nationality_enc,
        id_number_hash, id_last4, photo_object_key, photo_sha256, document_expires_at, updated_at
      ) values (
        ${row.ref}, ${row.wallet}, ${nameEnc}, ${idEnc}, ${natEnc},
        ${hash}, ${last4}, ${row.photoKey ?? null}, ${row.photoSha ?? null}, ${row.expiresAt ?? null}, now()
      )
      on conflict (kyc_ref) do update set
        wallet = ${row.wallet},
        full_name_enc = ${nameEnc},
        id_number_enc = ${idEnc},
        nationality_enc = ${natEnc},
        id_number_hash = ${hash},
        id_last4 = ${last4},
        photo_object_key = coalesce(${row.photoKey ?? null}, kyc_private.photo_object_key),
        photo_sha256 = coalesce(${row.photoSha ?? null}, kyc_private.photo_sha256),
        document_expires_at = coalesce(${row.expiresAt ?? null}::timestamptz, kyc_private.document_expires_at),
        updated_at = now()
    `;
	} catch (err) {
		if ((err && typeof err === "object" && "code" in err ? String(err.code) : "") === "23505") throw new Error("This ID is already registered to another wallet.");
		throw new Error("Could not store KYC.");
	}
	return last4;
}
async function submitKycRecord(sql, wallet, fullName, idNumber, nationality, documentExpiresAt, photo) {
	const name = fullName.trim();
	const id = idNumber.trim();
	const nation = nationality.trim();
	if (name.length < 2) throw new Error("Enter a full name.");
	if (normalizeId(id).length < 4) throw new Error("Enter an ID number.");
	if (nation.length < 2) throw new Error("Enter a nationality.");
	if (!photo?.bytes?.length) throw new Error("A JPEG or PNG of the document is required.");
	const day = documentExpiresAt.trim().slice(0, 10);
	if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error("Enter a document expiry date.");
	if (day < utcToday()) throw new Error("Document expiry must be today or later.");
	const expiresAt = `${day}T00:00:00.000Z`;
	const ref = (await sql`select kyc_ref from kyc_public where wallet = ${wallet}`)[0]?.kyc_ref || newKycRef();
	const stored = storeKycPhoto(ref, photo.bytes, photo.type);
	const last4 = await writePrivate(sql, {
		ref,
		wallet,
		name,
		idNumber: id,
		nationality: nation,
		expiresAt,
		photoKey: stored.key,
		photoSha: stored.sha256
	});
	const auto = await kycAutoApprove(sql);
	const status = auto ? "approved" : "pending";
	await sql`
    insert into kyc_public (
      wallet, kyc_ref, status, submitted_at, verified_at, reviewed_by, reject_reason, document_expires_at
    ) values (
      ${wallet}, ${ref}, ${status}, now(),
      ${auto ? (/* @__PURE__ */ new Date()).toISOString() : null},
      ${auto ? "auto" : null},
      ${null},
      ${expiresAt}
    )
    on conflict (wallet) do update set
      kyc_ref = ${ref},
      status = ${status},
      submitted_at = now(),
      verified_at = ${auto ? (/* @__PURE__ */ new Date()).toISOString() : null},
      reviewed_by = ${auto ? "auto" : null},
      reject_reason = null,
      document_expires_at = ${expiresAt}
  `;
	return {
		status,
		kycRef: ref,
		idLast4: last4,
		documentExpiresAt: day
	};
}
async function migrateLegacyKyc(sql) {
	await ensureKycPublic(sql);
	if (!(await sql`
    select column_name from information_schema.columns
    where table_schema = 'public' and table_name = 'kyc' and column_name = 'id_number'
  `).length) return;
	const rows = await sql`
    select wallet, full_name, id_number from kyc
    where id_number is not null and btrim(id_number) <> ''
  `;
	let failed = 0;
	const priv = rows.length ? await getKycSql(sql) : null;
	for (const row of rows) {
		if ((await sql`select wallet from kyc_public where wallet = ${row.wallet}`)[0]) continue;
		try {
			const ref = (priv ? (await priv.sql`
              select kyc_ref from kyc_private where wallet = ${row.wallet}
            `)[0] : void 0)?.kyc_ref || newKycRef();
			await writePrivate(sql, {
				ref,
				wallet: row.wallet,
				name: row.full_name?.trim() || "Unknown",
				idNumber: row.id_number,
				nationality: "Unknown"
			});
			await sql`
        insert into kyc_public (wallet, kyc_ref, status, submitted_at, verified_at, reviewed_by)
        values (${row.wallet}, ${ref}, 'approved', now(), now(), 'legacy')
        on conflict (wallet) do nothing
      `;
			await sql`update kyc set migrated_ref = ${ref} where wallet = ${row.wallet}`;
		} catch {
			failed += 1;
		}
	}
	if (failed > 0) return;
	if (((await sql`
      select count(*)::int as n from kyc
      where id_number is not null and btrim(id_number) <> ''
        and wallet not in (select wallet from kyc_public)
    `)[0]?.n ?? 0) > 0) return;
	await sql`alter table kyc drop column if exists id_number`;
	await sql`alter table kyc drop column if exists full_name`;
}
async function listKyc(sql, filter) {
	const q = (filter.q ?? "").trim().toLowerCase();
	const status = filter.status === "pending" || filter.status === "approved" || filter.status === "rejected" || filter.status === "expired" ? filter.status : "";
	await markExpired(sql);
	const from = filter.from && !Number.isNaN(new Date(filter.from).getTime()) ? new Date(filter.from).toISOString() : null;
	const to = filter.to && !Number.isNaN(new Date(filter.to).getTime()) ? new Date(filter.to).toISOString() : null;
	const like = q ? `%${q.replace(/[\\%_]/g, "")}%` : "";
	return (await sql`
    select wallet, kyc_ref, status, submitted_at, verified_at, reviewed_by, reject_reason, document_expires_at
    from kyc_public
    where (${like} = '' or wallet ilike ${like} or kyc_ref = ${q})
      and (${status} = '' or status = ${status})
      and (${from}::timestamptz is null or submitted_at >= ${from}::timestamptz)
      and (${to}::timestamptz is null or submitted_at <= ${to}::timestamptz)
    order by submitted_at desc
    limit 80
  `).map((r) => ({
		wallet: r.wallet,
		kycRef: r.kyc_ref,
		status: asStatus(r.status),
		submittedAt: iso(r.submitted_at) ?? "",
		verifiedAt: iso(r.verified_at),
		reviewedBy: r.reviewed_by,
		rejectReason: r.reject_reason,
		documentExpiresAt: expiryDay(r.document_expires_at)
	}));
}
async function audit(sql, admin, ref, wallet, action) {
	await sql`
    insert into kyc_audit (admin_wallet, kyc_ref, wallet, action)
    values (${admin}, ${ref}, ${wallet}, ${action})
  `;
}
async function kycDetail(sql, admin, kycRef) {
	const pub = (await sql`
      select wallet, kyc_ref, status, submitted_at, verified_at, reviewed_by, reject_reason, document_expires_at
      from kyc_public where kyc_ref = ${kycRef}
    `)[0];
	if (!pub) throw new Error("KYC record not found.");
	const secret = (await (await getKycSql(sql)).sql`
      select full_name_enc, id_number_enc, nationality_enc, id_last4, photo_object_key
      from kyc_private where kyc_ref = ${kycRef}
    `)[0];
	if (!secret) throw new Error("Private KYC record is missing.");
	const keys = await keyMaterial(sql);
	let fullName = "";
	let idNumber = "";
	let nationality = "";
	try {
		fullName = openSeal(secret.full_name_enc, keys.aes);
		idNumber = openSeal(secret.id_number_enc, keys.aes);
		nationality = openSeal(secret.nationality_enc, keys.aes);
	} catch {
		throw new Error("Could not decrypt this KYC record. Check KYC_AES_KEY.");
	}
	await audit(sql, admin, pub.kyc_ref, pub.wallet, "view");
	return {
		wallet: pub.wallet,
		kycRef: pub.kyc_ref,
		status: asStatus(pub.status),
		submittedAt: iso(pub.submitted_at) ?? "",
		verifiedAt: iso(pub.verified_at),
		reviewedBy: pub.reviewed_by,
		rejectReason: pub.reject_reason,
		fullName,
		nationality,
		idNumber,
		idLast4: secret.id_last4,
		documentExpiresAt: expiryDay(pub.document_expires_at),
		hasPhoto: Boolean(secret.photo_object_key)
	};
}
async function reviewKyc(sql, admin, kycRef, approve, reason) {
	const pub = (await sql`
      select wallet, status, document_expires_at from kyc_public where kyc_ref = ${kycRef}
    `)[0];
	if (!pub) throw new Error("KYC record not found.");
	if (approve) {
		const day = expiryDay(pub.document_expires_at);
		if (day && day < utcToday()) {
			await sql`update kyc_public set status = 'expired' where kyc_ref = ${kycRef}`;
			throw new Error("This document is already expired. Ask the holder to submit again.");
		}
		await sql`
      update kyc_public
      set status = 'approved', verified_at = now(), reviewed_by = ${admin}, reject_reason = null
      where kyc_ref = ${kycRef}
    `;
		await audit(sql, admin, kycRef, pub.wallet, "approve");
		return { status: "approved" };
	}
	const note = reason.trim().slice(0, 240);
	if (!note) throw new Error("A reject reason is required.");
	await sql`
    update kyc_public
    set status = 'rejected', verified_at = null, reviewed_by = ${admin}, reject_reason = ${note}
    where kyc_ref = ${kycRef}
  `;
	await audit(sql, admin, kycRef, pub.wallet, "reject");
	return { status: "rejected" };
}
async function kycPhoto(sql, admin, kycRef) {
	const pub = (await sql`select wallet from kyc_public where kyc_ref = ${kycRef}`)[0];
	if (!pub) throw new Error("KYC record not found.");
	const secret = (await (await getKycSql(sql)).sql`
      select photo_object_key from kyc_private where kyc_ref = ${kycRef}
    `)[0];
	if (!secret?.photo_object_key) throw new Error("No document photo is stored.");
	const file = readKycPhoto(secret.photo_object_key);
	await audit(sql, admin, kycRef, pub.wallet, "photo");
	return {
		contentType: file.contentType,
		base64: file.bytes.toString("base64")
	};
}
//#endregion
export { assertKycApproved, kycDetail, kycInfraSummary, kycPhoto, listKyc, migrateLegacyKyc, readOwnerKyc, reviewKyc, submitKycRecord };
