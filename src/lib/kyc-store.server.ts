import { randomBytes } from "node:crypto";
import type { Sql } from "@/lib/db";
import { describeDatabaseUrl } from "@/lib/db";
import { decodeAesKey, idHash, idLast4, newKycRef, normalizeId, openSeal, seal } from "@/lib/kyc-crypto";
import { readKycPhoto, storeKycPhoto } from "@/lib/kyc-photo.server";
import type { KycDetail, KycListRow, KycStatus } from "@/lib/types";
import { isGnosisMainnet } from "@/lib/network-config";

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

const PRIVATE_TABLE = `
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

const PRIVATE_INDEX = `create index if not exists kyc_private_wallet_idx on kyc_private (wallet)`;

type PoolSlot = { url: string; sql: Sql; end: () => Promise<void>; ready: boolean };

function slotRef() {
  return globalThis as typeof globalThis & { __ctKycPool__?: PoolSlot };
}

function toSql(run: (text: string, params: unknown[]) => Promise<unknown[]>): Sql {
  const sql = (async (strings: TemplateStringsArray, ...values: unknown[]) => {
    let text = strings[0] ?? "";
    for (let i = 0; i < values.length; i += 1) text += `$${i + 1}${strings[i + 1] ?? ""}`;
    return run(text, values);
  }) as unknown as Sql;
  sql.query = ((text: string, params: unknown[] = []) => run(text, params)) as Sql["query"];
  return sql;
}

export type KycPrivateSource = "env" | "database" | "shared";
export type KycKeySource = "env" | "database" | "missing";

function envKeysRequired() {
  const flag = (process.env.KYC_REQUIRE_ENV_KEYS || "").trim().toLowerCase();
  return flag === "true" || flag === "1";
}

export async function kycPrivateTarget(sql: Sql): Promise<{ url: string; source: KycPrivateSource }> {
  const env = process.env.DATABASE_URL_KYC?.trim() || "";
  if (env) return { url: env, source: "env" };
  const row = (
    await sql<{ value: string }>`select value from infra_settings where key = ${"database_url_kyc"}`
  )[0];
  const saved = row?.value?.trim() || "";
  if (saved) return { url: saved, source: "database" };
  return { url: "", source: "shared" };
}

async function getKycSql(publicSql: Sql): Promise<{ sql: Sql; source: KycPrivateSource }> {
  const target = await kycPrivateTarget(publicSql);
  const g = slotRef();
  if (!target.url) {
    if (g.__ctKycPool__) {
      await g.__ctKycPool__.end().catch(() => undefined);
      g.__ctKycPool__ = undefined;
    }
    await ensurePrivateSchema(publicSql);
    return { sql: publicSql, source: "shared" };
  }
  if (g.__ctKycPool__ && g.__ctKycPool__.url !== target.url) {
    await g.__ctKycPool__.end().catch(() => undefined);
    g.__ctKycPool__ = undefined;
  }
  if (!g.__ctKycPool__) {
    const { Pool, types } = await import("pg");
    types.setTypeParser(20, Number);
    const pool = new Pool({
      connectionString: target.url,
      max: 3,
      connectionTimeoutMillis: 8000,
    });
    try {
      const client = await pool.connect();
      client.release();
    } catch (err) {
      await pool.end().catch(() => undefined);
      const msg = err instanceof Error ? err.message : "connect failed";
      if (/postgres(?:ql)?:\/\//i.test(msg)) {
        throw new Error("KYC private database is unreachable.");
      }
      throw new Error("KYC private database is unreachable.");
    }
    g.__ctKycPool__ = {
      url: target.url,
      ready: false,
      end: () => pool.end(),
      sql: toSql(async (text, params) => {
        const res = await pool.query(text, params);
        return res.rows as unknown[];
      }),
    };
  }
  if (!g.__ctKycPool__.ready) {
    await ensurePrivateSchema(g.__ctKycPool__.sql);
    g.__ctKycPool__.ready = true;
  }
  return { sql: g.__ctKycPool__.sql, source: target.source };
}

async function ensurePrivateSchema(sql: Sql) {
  await sql.query(PRIVATE_TABLE);
  await sql.query(PRIVATE_INDEX);
  await sql.query(`alter table kyc_private add column if not exists document_expires_at timestamptz`);
}

export async function ensureKycPublic(sql: Sql) {
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
  } catch {
    // legacy table may not exist yet
  }
}

type KeyMaterial = { aes: Buffer; pepper: string; source: KycKeySource };

async function keyMaterial(sql: Sql): Promise<KeyMaterial> {
  const envKey = process.env.KYC_AES_KEY?.trim() || "";
  const envPepper = process.env.KYC_HMAC_PEPPER?.trim() || "";
  if (envKey || envPepper) {
    if (!envKey || !envPepper) {
      throw new Error("Set both KYC_AES_KEY and KYC_HMAC_PEPPER, or neither.");
    }
    return { aes: decodeAesKey(envKey), pepper: envPepper, source: "env" as const };
  }
  if (envKeysRequired()) {
    throw new Error("Set KYC_AES_KEY and KYC_HMAC_PEPPER. Database-generated keys are disabled.");
  }
  const rows = await sql<{ key: string; value: string }>`
    select key, value from infra_settings where key in ('kyc_aes_key', 'kyc_hmac_pepper')
  `;
  const map = new Map(rows.map((r) => [r.key, r.value.trim()]));
  let aesRaw = map.get("kyc_aes_key") || "";
  let pepper = map.get("kyc_hmac_pepper") || "";
  if (!aesRaw || !pepper) {
    aesRaw = randomBytes(32).toString("hex");
    pepper = randomBytes(32).toString("hex");
    for (const [key, value] of [
      ["kyc_aes_key", aesRaw],
      ["kyc_hmac_pepper", pepper],
    ] as const) {
      await sql`
        insert into infra_settings (key, value, updated_at)
        values (${key}, ${value}, now())
        on conflict (key) do update set value = ${value}, updated_at = now()
      `;
    }
  }
  return { aes: decodeAesKey(aesRaw), pepper, source: "database" };
}

export async function kycAutoApprove(sql: Sql) {
  const { loadInfra } = await import("@/lib/infra.server");
  if (isGnosisMainnet((await loadInfra(sql)).chainId)) return false;
  const flags = await sql<{ key: string; value: string }>`
    select key, value from infra_settings where key in ('dev_mode', 'kyc_auto_approve')
  `;
  const settings = new Map(flags.map((r) => [r.key, r.value]));
  if (settings.get("dev_mode") !== "true") return false;
  const env = process.env.KYC_AUTO_APPROVE?.trim().toLowerCase();
  if (env === "true" || env === "1") return true;
  if (env === "false" || env === "0") return false;
  return settings.get("kyc_auto_approve") === "true";
}

export async function kycInfraSummary(sql: Sql) {
  const target = await kycPrivateTarget(sql);
  let keySource: KycKeySource = "missing";
  let keyError: string | null = null;
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
    sharedWarning: target.source === "shared",
  };
}

export type OwnerKyc = {
  status: KycStatus;
  submittedAt: string;
  verifiedAt: string | null;
  idLast4: string | null;
  rejectReason: string | null;
  documentExpiresAt: string | null;
};

function iso(v: string | Date | null | undefined) {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function utcToday() {
  return new Date().toISOString().slice(0, 10);
}

function expiryDay(v: string | Date | null | undefined) {
  return iso(v)?.slice(0, 10) ?? null;
}

function asStatus(v: string): KycStatus {
  if (v === "approved" || v === "rejected" || v === "pending" || v === "expired") return v;
  return "pending";
}

async function markExpired(sql: Sql, wallet?: string) {
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

export async function readOwnerKyc(sql: Sql, wallet: string): Promise<OwnerKyc | null> {
  await markExpired(sql, wallet);
  const row = (
    await sql<{
      status: string;
      submitted_at: string | Date;
      verified_at: string | Date | null;
      reject_reason: string | null;
      document_expires_at: string | Date | null;
    }>`
      select status, submitted_at, verified_at, reject_reason, document_expires_at
      from kyc_public where wallet = ${wallet}
    `
  )[0];
  if (!row) return null;
  let last4: string | null = null;
  try {
    const priv = await getKycSql(sql);
    const p = (
      await priv.sql<{ id_last4: string | null }>`
        select id_last4 from kyc_private where wallet = ${wallet}
      `
    )[0];
    last4 = p?.id_last4 ?? null;
  } catch {
    last4 = null;
  }
  return {
    status: asStatus(row.status),
    submittedAt: iso(row.submitted_at) ?? new Date(0).toISOString(),
    verifiedAt: iso(row.verified_at),
    idLast4: last4,
    rejectReason: row.reject_reason,
    documentExpiresAt: expiryDay(row.document_expires_at),
  };
}

export async function assertKycApproved(sql: Sql, wallet: string) {
  await markExpired(sql, wallet);
  const row = (
    await sql<{ status: string }>`select status from kyc_public where wallet = ${wallet}`
  )[0];
  if (!row) throw new Error("Complete KYC before buying.");
  if (row.status === "pending") throw new Error("KYC is waiting for admin approval.");
  if (row.status === "rejected") throw new Error("KYC was rejected. Submit it again.");
  if (row.status === "expired") throw new Error("This ID document has expired. Submit KYC again.");
  if (row.status !== "approved") throw new Error("KYC must be approved before buying.");
}

async function writePrivate(
  sql: Sql,
  row: {
    ref: string;
    wallet: string;
    name: string;
    idNumber: string;
    nationality: string;
    expiresAt?: string | null;
    photoKey?: string | null;
    photoSha?: string | null;
  },
) {
  const keys = await keyMaterial(sql);
  const normalized = normalizeId(row.idNumber);
  const hash = idHash(normalized, keys.pepper);
  const priv = await getKycSql(sql);
  const taken = (
    await priv.sql<{ wallet: string }>`
      select wallet from kyc_private where id_number_hash = ${hash}
    `
  )[0];
  if (taken && taken.wallet !== row.wallet) {
    throw new Error("This ID is already registered to another wallet.");
  }
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
    const code = err && typeof err === "object" && "code" in err ? String((err as { code: unknown }).code) : "";
    if (code === "23505") throw new Error("This ID is already registered to another wallet.");
    throw new Error("Could not store KYC.");
  }
  return last4;
}

export async function submitKycRecord(
  sql: Sql,
  wallet: string,
  fullName: string,
  idNumber: string,
  nationality: string,
  documentExpiresAt: string,
  photo: { bytes: Buffer; type: "image/jpeg" | "image/png" },
) {
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
  const existing = (
    await sql<{ kyc_ref: string }>`select kyc_ref from kyc_public where wallet = ${wallet}`
  )[0];
  const ref = existing?.kyc_ref || newKycRef();
  const stored = storeKycPhoto(ref, photo.bytes, photo.type);
  const last4 = await writePrivate(sql, {
    ref,
    wallet,
    name,
    idNumber: id,
    nationality: nation,
    expiresAt,
    photoKey: stored.key,
    photoSha: stored.sha256,
  });
  const auto = await kycAutoApprove(sql);
  const status: KycStatus = auto ? "approved" : "pending";
  await sql`
    insert into kyc_public (
      wallet, kyc_ref, status, submitted_at, verified_at, reviewed_by, reject_reason, document_expires_at
    ) values (
      ${wallet}, ${ref}, ${status}, now(),
      ${auto ? new Date().toISOString() : null},
      ${auto ? "auto" : null},
      ${null},
      ${expiresAt}
    )
    on conflict (wallet) do update set
      kyc_ref = ${ref},
      status = ${status},
      submitted_at = now(),
      verified_at = ${auto ? new Date().toISOString() : null},
      reviewed_by = ${auto ? "auto" : null},
      reject_reason = null,
      document_expires_at = ${expiresAt}
  `;
  return { status, kycRef: ref, idLast4: last4, documentExpiresAt: day };
}

export async function migrateLegacyKyc(sql: Sql) {
  await ensureKycPublic(sql);
  const cols = await sql<{ column_name: string }>`
    select column_name from information_schema.columns
    where table_schema = 'public' and table_name = 'kyc' and column_name = 'id_number'
  `;
  if (!cols.length) return;
  const rows = await sql<{ wallet: string; full_name: string; id_number: string }>`
    select wallet, full_name, id_number from kyc
    where id_number is not null and btrim(id_number) <> ''
  `;
  let failed = 0;
  const priv = rows.length ? await getKycSql(sql) : null;
  for (const row of rows) {
    const already = (
      await sql<{ wallet: string }>`select wallet from kyc_public where wallet = ${row.wallet}`
    )[0];
    if (already) continue;
    try {
      const prev = priv
        ? (
            await priv.sql<{ kyc_ref: string }>`
              select kyc_ref from kyc_private where wallet = ${row.wallet}
            `
          )[0]
        : undefined;
      const ref = prev?.kyc_ref || newKycRef();
      await writePrivate(sql, {
        ref,
        wallet: row.wallet,
        name: row.full_name?.trim() || "Unknown",
        idNumber: row.id_number,
        nationality: "Unknown",
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
  const left = (
    await sql<{ n: number }>`
      select count(*)::int as n from kyc
      where id_number is not null and btrim(id_number) <> ''
        and wallet not in (select wallet from kyc_public)
    `
  )[0];
  if ((left?.n ?? 0) > 0) return;
  await sql`alter table kyc drop column if exists id_number`;
  await sql`alter table kyc drop column if exists full_name`;
}

export async function listKyc(
  sql: Sql,
  filter: { q?: string; status?: string; from?: string; to?: string },
): Promise<KycListRow[]> {
  const q = (filter.q ?? "").trim().toLowerCase();
  const status =
    filter.status === "pending" ||
    filter.status === "approved" ||
    filter.status === "rejected" ||
    filter.status === "expired"
      ? filter.status
      : "";
  await markExpired(sql);
  const from = filter.from && !Number.isNaN(new Date(filter.from).getTime()) ? new Date(filter.from).toISOString() : null;
  const to = filter.to && !Number.isNaN(new Date(filter.to).getTime()) ? new Date(filter.to).toISOString() : null;
  const like = q ? `%${q.replace(/[\\%_]/g, "")}%` : "";
  const rows = await sql<{
    wallet: string;
    kyc_ref: string;
    status: string;
    submitted_at: string | Date;
    verified_at: string | Date | null;
    reviewed_by: string | null;
    reject_reason: string | null;
    document_expires_at: string | Date | null;
  }>`
    select wallet, kyc_ref, status, submitted_at, verified_at, reviewed_by, reject_reason, document_expires_at
    from kyc_public
    where (${like} = '' or wallet ilike ${like} or kyc_ref = ${q})
      and (${status} = '' or status = ${status})
      and (${from}::timestamptz is null or submitted_at >= ${from}::timestamptz)
      and (${to}::timestamptz is null or submitted_at <= ${to}::timestamptz)
    order by submitted_at desc
    limit 80
  `;
  return rows.map((r) => ({
    wallet: r.wallet,
    kycRef: r.kyc_ref,
    status: asStatus(r.status),
    submittedAt: iso(r.submitted_at) ?? "",
    verifiedAt: iso(r.verified_at),
    reviewedBy: r.reviewed_by,
    rejectReason: r.reject_reason,
    documentExpiresAt: expiryDay(r.document_expires_at),
  }));
}

async function audit(sql: Sql, admin: string, ref: string, wallet: string, action: string) {
  await sql`
    insert into kyc_audit (admin_wallet, kyc_ref, wallet, action)
    values (${admin}, ${ref}, ${wallet}, ${action})
  `;
}

export async function kycDetail(sql: Sql, admin: string, kycRef: string): Promise<KycDetail> {
  const pub = (
    await sql<{
      wallet: string;
      kyc_ref: string;
      status: string;
      submitted_at: string | Date;
      verified_at: string | Date | null;
      reviewed_by: string | null;
      reject_reason: string | null;
      document_expires_at: string | Date | null;
    }>`
      select wallet, kyc_ref, status, submitted_at, verified_at, reviewed_by, reject_reason, document_expires_at
      from kyc_public where kyc_ref = ${kycRef}
    `
  )[0];
  if (!pub) throw new Error("KYC record not found.");
  const priv = await getKycSql(sql);
  const secret = (
    await priv.sql<{
      full_name_enc: string;
      id_number_enc: string;
      nationality_enc: string;
      id_last4: string | null;
      photo_object_key: string | null;
    }>`
      select full_name_enc, id_number_enc, nationality_enc, id_last4, photo_object_key
      from kyc_private where kyc_ref = ${kycRef}
    `
  )[0];
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
    hasPhoto: Boolean(secret.photo_object_key),
  };
}

export async function reviewKyc(sql: Sql, admin: string, kycRef: string, approve: boolean, reason: string) {
  const pub = (
    await sql<{ wallet: string; status: string; document_expires_at: string | Date | null }>`
      select wallet, status, document_expires_at from kyc_public where kyc_ref = ${kycRef}
    `
  )[0];
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
    return { status: "approved" as const };
  }
  const note = reason.trim().slice(0, 240);
  if (!note) throw new Error("A reject reason is required.");
  await sql`
    update kyc_public
    set status = 'rejected', verified_at = null, reviewed_by = ${admin}, reject_reason = ${note}
    where kyc_ref = ${kycRef}
  `;
  await audit(sql, admin, kycRef, pub.wallet, "reject");
  return { status: "rejected" as const };
}

export async function kycPhoto(sql: Sql, admin: string, kycRef: string) {
  const pub = (
    await sql<{ wallet: string }>`select wallet from kyc_public where kyc_ref = ${kycRef}`
  )[0];
  if (!pub) throw new Error("KYC record not found.");
  const priv = await getKycSql(sql);
  const secret = (
    await priv.sql<{ photo_object_key: string | null }>`
      select photo_object_key from kyc_private where kyc_ref = ${kycRef}
    `
  )[0];
  if (!secret?.photo_object_key) throw new Error("No document photo is stored.");
  const file = readKycPhoto(secret.photo_object_key);
  await audit(sql, admin, kycRef, pub.wallet, "photo");
  return {
    contentType: file.contentType,
    base64: file.bytes.toString("base64"),
  };
}
