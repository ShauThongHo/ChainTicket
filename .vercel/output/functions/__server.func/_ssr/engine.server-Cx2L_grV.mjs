import { r as redactSecrets } from "./chain-errors-Ngnean6G.mjs";
import { r as eventPhase, s as priceBounds } from "./utils-CSfacMs6.mjs";
import { t as configuredAdmin } from "./platform-ITGl4Pv_.mjs";
import { n as normalizeWallet, r as qrSecret, t as makeTxRef } from "./session.server-U8N3VQgv.mjs";
import { assertKycApproved, kycInfraSummary, migrateLegacyKyc, readOwnerKyc, submitKycRecord } from "./kyc-store.server-CUUjK3BO.mjs";
import { createHmac } from "node:crypto";
import { Buffer } from "node:buffer";
//#region node_modules/.nitro/vite/services/ssr/assets/engine.server-Cx2L_grV.js
var WINDOW_SEC = 30;
function qrBucket(at = Date.now()) {
	return Math.floor(at / 1e3 / WINDOW_SEC);
}
function buildQrPayload(ticketId, bucket = qrBucket()) {
	return `CT1.${ticketId}.${bucket}.${createHmac("sha256", qrSecret()).update(`${ticketId}:${bucket}`).digest("hex").slice(0, 20)}`;
}
function parseQrPayload(payload) {
	const parts = payload.trim().split(".");
	if (parts.length !== 4 || parts[0] !== "CT1") throw new Error("Not a ChainTicket QR payload.");
	const ticketId = Number(parts[1]);
	const bucket = Number(parts[2]);
	const hmac = parts[3];
	if (!Number.isInteger(ticketId) || !Number.isInteger(bucket)) throw new Error("Malformed QR payload.");
	const now = qrBucket();
	if (Math.abs(now - bucket) > 1) throw new Error("QR expired. Ask the attendee to refresh.");
	if (createHmac("sha256", qrSecret()).update(`${ticketId}:${bucket}`).digest("hex").slice(0, 20) !== hmac) throw new Error("QR signature invalid.");
	return {
		ticketId,
		bucket
	};
}
var QR_WINDOW_MS = WINDOW_SEC * 1e3;
var QR_UNLOCK_MS = 72e5;
function objectionRequiresAdminReview(objections, sold) {
	return sold > 0 && objections * 3 >= sold;
}
function objectionWindowPasses(objections, sold) {
	return sold === 0 || objections * 3 < sold;
}
function cancellationIsOpen(nowMs, endsAtMs) {
	return nowMs < endsAtMs;
}
function asTime(v) {
	return new Date(v).getTime();
}
async function writeLedger(sql, row) {
	const ref = row.tx && /^0x[0-9a-fA-F]{64}$/.test(row.tx) ? row.tx : makeTxRef(row.kind);
	await sql`
    insert into ledger (event_id, ticket_id, kind, from_wallet, to_wallet, amount_cents, ref)
    values (
      ${row.eventId ?? null},
      ${row.ticketId ?? null},
      ${row.kind},
      ${row.from ?? null},
      ${row.to ?? null},
      ${row.amount},
      ${ref}
    )
  `;
	return ref;
}
function parsePayload(raw) {
	if (raw == null) return {};
	if (typeof raw === "object" && !Array.isArray(raw)) return raw;
	if (typeof raw === "string") try {
		return parsePayload(JSON.parse(raw));
	} catch {
		return {};
	}
	return {};
}
async function markPending(sql, kind, txHash, payload, error) {
	const encoded = JSON.stringify(payload);
	try {
		await sql`
      insert into pending_index (kind, tx_hash, payload, error)
      values (${kind}, ${txHash}, ${encoded}, ${error})
      on conflict (tx_hash) do update
        set kind = ${kind}, payload = ${encoded}, error = ${error}, resolved_at = null
    `;
	} catch {}
}
async function resolvePending(sql, txHash) {
	await sql`
    update pending_index
    set resolved_at = now(), error = null
    where tx_hash = ${txHash} and resolved_at is null
  `;
}
async function syncPlatformAdmin(sql) {
	const admin = configuredAdmin();
	if (!admin) return;
	await sql`
    insert into admins (wallet) values (${admin})
    on conflict (wallet) do nothing
  `;
}
async function boot(sql) {
	const gen = globalRefBoot().__ctBootGen__ ?? 0;
	const slot = globalRefBoot().__ctBoot__;
	if (slot && slot.gen === gen) return slot.promise;
	const promise = runBoot(sql).catch((err) => {
		if (globalRefBoot().__ctBoot__?.promise === promise) globalRefBoot().__ctBoot__ = void 0;
		throw err;
	});
	globalRefBoot().__ctBoot__ = {
		gen,
		promise
	};
	return promise;
}
function globalRefBoot() {
	return globalThis;
}
async function runBoot(sql) {
	await sql`
    create table if not exists mint_jobs (
      id text primary key,
      organizer_wallet text not null,
      current_step integer not null default 0,
      status text not null default 'pending',
      error text,
      event_id integer,
      updated_at timestamptz not null default now()
    )
  `;
	await sql`
    create table if not exists infra_settings (
      key text primary key,
      value text not null default '',
      updated_at timestamptz not null default now()
    )
  `;
	await sql`
    create table if not exists deployed_contracts (
      id serial primary key,
      kind text not null,
      event_id integer,
      address text not null,
      tx_hash text not null default '',
      created_at timestamptz not null default now()
    )
  `;
	try {
		await sql`alter table events add column if not exists vault_address text`;
		await sql`alter table events add column if not exists marketplace_address text`;
		await sql`alter table events add column if not exists deploy_tx text`;
		await sql`alter table events add column if not exists engine_version integer`;
		await sql`alter table events add column if not exists frozen_at timestamptz`;
		await sql`alter table events add column if not exists collection_address text`;
		await sql`alter table tickets add column if not exists chain_id integer`;
		await sql`alter table tickets add column if not exists token_uri text`;
		await sql`alter table withdraw_requests add column if not exists yes_weight integer`;
		await sql`alter table withdraw_requests add column if not exists sold_weight integer`;
		await sql`alter table withdraw_requests add column if not exists deadline timestamptz`;
		await sql`alter table withdraw_requests add column if not exists materials_uri text`;
		await sql`alter table withdraw_requests add column if not exists proposal_id integer`;
	} catch {}
	await sql`
    create table if not exists withdraw_requests (
      id serial primary key,
      event_id integer not null,
      organizer_wallet text not null,
      amount_cents integer not null default 0,
      status text not null default 'pending',
      decided_by text,
      decided_at timestamptz,
      tx_hash text,
      note text,
      created_at timestamptz not null default now()
    )
  `;
	await sql`
    create table if not exists pending_index (
      id serial primary key,
      kind text not null,
      tx_hash text not null unique,
      payload jsonb not null default '{}',
      error text,
      resolved_at timestamptz,
      created_at timestamptz not null default now()
    )
  `;
	await sql`
    create table if not exists withdraw_votes (
      id serial primary key,
      request_id integer not null,
      ticket_id integer not null,
      chain_id integer not null,
      voter text not null,
      tx_hash text not null default '',
      created_at timestamptz not null default now()
    )
  `;
	try {
		await sql`create unique index if not exists withdraw_votes_req_token on withdraw_votes (request_id, chain_id)`;
		await sql`create index if not exists listings_event_active_idx on listings (event_id) where active = true`;
		await sql`create index if not exists tickets_event_status_idx on tickets (event_id, status)`;
		await sql`create index if not exists events_organizer_idx on events (organizer_wallet)`;
	} catch {}
	await sql`update events set engine_version = 1 where engine_version is null`;
	await syncPlatformAdmin(sql);
	await sql`delete from events where vault_address is null or vault_address = ''`;
	await sql`delete from organizers where wallet = ${"0x1111111111111111111111111111111111111111"}`;
	await migrateLegacyKyc(sql);
}
async function getMe(sql, wallet) {
	await boot(sql);
	const w = wallet.toLowerCase();
	const [admin, org, kyc, acc] = await Promise.all([
		sql`select wallet from admins where wallet = ${w}`,
		sql`select name, status from organizers where wallet = ${w}`,
		readOwnerKyc(sql, w),
		sql`
      select spendable_cents, faucet_claimed from accounts where wallet = ${w}
    `
	]);
	const isAdmin = admin.length > 0 || w === configuredAdmin();
	const isOrganizer = org[0]?.status === "approved";
	return {
		address: w,
		isAdmin,
		isOrganizer,
		organizerName: org[0]?.status === "approved" ? org[0].name : null,
		kyc,
		spendableCents: acc[0]?.spendable_cents ?? 0,
		faucetClaimed: acc[0]?.faucet_claimed ?? false,
		role: isAdmin ? "admin" : isOrganizer ? "organizer" : "attendee"
	};
}
var BAL_TTL_MS = 45e3;
var balCache = /* @__PURE__ */ new Map();
/** DxDAI / indexed balance. Not on the login path — callers cache for ~45s. */
async function spendableBalance(sql, wallet, fresh = false) {
	await boot(sql);
	const w = wallet.toLowerCase();
	const hit = balCache.get(w);
	if (!fresh && hit && Date.now() - hit.at < BAL_TTL_MS) return { cents: hit.cents };
	let cents = (await sql`
    select spendable_cents from accounts where wallet = ${w}
  `)[0]?.spendable_cents ?? 0;
	try {
		const { loadInfra } = await import("./infra.server-dbfo18Hy.mjs");
		const infra = await loadInfra(sql);
		if (infra.devMode && infra.demoBank) {
			const { demoStatus } = await import("./chain.server-u4NE0w9L.mjs");
			cents = (await demoStatus(infra.demoBank, w)).cents;
		}
	} catch {}
	balCache.set(w, {
		cents,
		at: Date.now()
	});
	return { cents };
}
var EVENT_CARDS = `
select
  e.id, e.organizer_wallet, e.name, e.description, e.venue, e.category,
  e.poster_url, e.starts_at, e.ends_at, e.cancelled_at,
  e.vault_address, e.marketplace_address, e.deploy_tx, e.engine_version,
  e.frozen_at, e.collection_address,
  coalesce(v.locked_cents, 0)::int as locked_cents,
  coalesce(v.withdrawn, false) as vault_withdrawn,
  coalesce(tk.sold, 0)::int as sold,
  coalesce(tk.supply, 0)::int as supply,
  coalesce(tk.checked_in, 0)::int as checked_in,
  coalesce(ls.available, 0)::int as available,
  ls.min_cents,
  ls.max_cents,
  wr.status as wr_status,
  coalesce(wr.yes_weight, 0)::int as yes_weight,
  coalesce(wr.sold_weight, 0)::int as sold_weight,
  wr.deadline as wr_deadline,
  wr.materials_uri
from events e
left join event_vaults v on v.event_id = e.id
left join (
  select event_id,
    count(*) filter (where status in ('owned','listed','used'))::int as sold,
    count(*)::int as supply,
    count(*) filter (where status = 'used')::int as checked_in
  from tickets
  group by event_id
) tk on tk.event_id = e.id
left join (
  select event_id,
    count(*) filter (where active)::int as available,
    min(price_cents) filter (where active)::int as min_cents,
    max(price_cents) filter (where active)::int as max_cents
  from listings
  group by event_id
) ls on ls.event_id = e.id
left join (
  select distinct on (event_id)
    event_id, status, yes_weight, sold_weight, deadline, materials_uri
  from withdraw_requests
  order by event_id, id desc
) wr on wr.event_id = e.id
`;
function toListItem(e) {
	return {
		id: e.id,
		name: e.name,
		venue: e.venue,
		category: e.category,
		posterUrl: e.poster_url,
		startsAt: e.starts_at,
		endsAt: e.ends_at,
		cancelled: Boolean(e.cancelled_at),
		minCents: e.min_cents,
		maxCents: e.max_cents,
		available: Number(e.available ?? 0),
		sold: Number(e.sold ?? 0),
		supply: Number(e.supply ?? 0),
		phase: eventPhase({
			cancelled: Boolean(e.cancelled_at),
			endsAt: e.ends_at
		}),
		engineVersion: e.engine_version ?? 1,
		frozen: Boolean(e.frozen_at),
		collectionAddress: e.collection_address
	};
}
function toOrganizer(e) {
	const sold = Number(e.sold ?? 0);
	const checked = Number(e.checked_in ?? 0);
	const status = e.wr_status;
	return {
		id: e.id,
		name: e.name,
		venue: e.venue,
		posterUrl: e.poster_url,
		startsAt: e.starts_at,
		endsAt: e.ends_at,
		cancelled: Boolean(e.cancelled_at),
		lockedCents: Number(e.locked_cents ?? 0),
		withdrawn: Boolean(e.vault_withdrawn),
		sold,
		available: Number(e.available ?? 0),
		supply: Number(e.supply ?? 0),
		checkedIn: checked,
		checkInRate: sold > 0 ? checked / sold : 0,
		vaultAddress: e.vault_address,
		marketplaceAddress: e.marketplace_address,
		collectionAddress: e.collection_address,
		deployTx: e.deploy_tx,
		phase: eventPhase({
			cancelled: Boolean(e.cancelled_at),
			endsAt: e.ends_at
		}),
		engineVersion: e.engine_version ?? 1,
		frozen: Boolean(e.frozen_at),
		withdrawRequest: status ?? null,
		proposalYes: Number(e.yes_weight ?? 0),
		proposalSold: Number(e.sold_weight ?? 0),
		proposalDeadline: e.wr_deadline ? new Date(e.wr_deadline).toISOString() : null,
		materialsUri: e.materials_uri
	};
}
async function listEvents(sql, q = "", wallet = null) {
	await boot(sql);
	const like = `%${q.trim().toLowerCase()}%`;
	const holder = wallet?.toLowerCase() ?? "";
	return (await sql.query(`${EVENT_CARDS}
     left join (
       select distinct event_id as held_event
       from tickets
       where owner_wallet = $2
         and status in ('owned','listed','used')
     ) held on held.held_event = e.id
     where (lower(e.name) like $1 or lower(e.venue) like $1 or lower(e.category) like $1)
       and (
         (e.cancelled_at is null and e.ends_at > now())
         or (
           e.cancelled_at is null
           and e.ends_at <= now()
           and e.ends_at > now() - interval '7 days'
           and held.held_event is null
         )
         or (
           e.cancelled_at is not null
           and e.cancelled_at > now() - interval '7 days'
         )
       )
     order by e.starts_at asc`, [like, holder])).map(toListItem);
}
async function getEvent(sql, eventId) {
	await boot(sql);
	const e = (await sql`select * from events where id = ${eventId}`)[0];
	if (!e) throw new Error("Event not found.");
	const org = await sql`
    select name from organizers where wallet = ${e.organizer_wallet}
  `;
	const royalty = (await sql`select royalty_bps from platform_settings where id = 1`)[0];
	const tiers = await sql`select * from ticket_tiers where event_id = ${eventId} order by face_cents desc`;
	const views = [];
	for (const t of tiers) {
		const st = (await sql`
        select
          min(price_cents) as min,
          max(price_cents) as max,
          count(*)::int as available
        from listings where tier_id = ${t.id} and active = true
      `)[0];
		views.push({
			id: t.id,
			name: t.name,
			faceCents: t.face_cents,
			supply: t.supply,
			available: st.available,
			minCents: st.min,
			maxCents: st.max,
			contractAddress: t.contract_address
		});
	}
	return {
		id: e.id,
		name: e.name,
		description: e.description,
		venue: e.venue,
		category: e.category,
		posterUrl: e.poster_url,
		startsAt: e.starts_at,
		endsAt: e.ends_at,
		cancelled: Boolean(e.cancelled_at),
		organizerWallet: e.organizer_wallet,
		organizerName: org[0]?.name ?? null,
		tiers: views,
		royaltyBps: royalty.royalty_bps,
		vaultAddress: e.vault_address,
		marketplaceAddress: e.marketplace_address,
		collectionAddress: e.collection_address,
		deployTx: e.deploy_tx,
		phase: eventPhase({
			cancelled: Boolean(e.cancelled_at),
			endsAt: e.ends_at
		}),
		engineVersion: e.engine_version ?? 1,
		frozen: Boolean(e.frozen_at)
	};
}
async function submitKyc(sql, wallet, input) {
	await boot(sql);
	const raw = input.photoBase64.replace(/^data:image\/[a-z0-9.+-]+;base64,/i, "").replace(/\s/g, "");
	if (!/^[A-Za-z0-9+/]+={0,2}$/.test(raw) && !/^[A-Za-z0-9_-]+$/.test(raw)) throw new Error("Photo must be a JPEG or PNG.");
	const bytes = Buffer.from(raw, "base64");
	if (!bytes.length || bytes.length > 4e6) throw new Error("Photo must be under 4MB.");
	return submitKycRecord(sql, wallet.toLowerCase(), input.fullName, input.idNumber, input.nationality, input.documentExpiresAt, {
		bytes,
		type: input.contentType
	});
}
async function quoteBuy(sql, wallet, tierId) {
	await boot(sql);
	await assertKycApproved(sql, wallet);
	const listing = await cheapestListing(sql, wallet, tierId);
	if (listing.engineVersion < 2) throw new Error("This event was minted with the old buyWithSig contract. The organizer must mint a new event — your wallet now sends buy() itself.");
	if (listing.frozen) throw new Error("This event is frozen by the platform admin.");
	const { centsToWei, ensureNativeGas, bankBalance, marketPullAllowed } = await import("./chain.server-u4NE0w9L.mjs");
	const { loadInfra } = await import("./infra.server-dbfo18Hy.mjs");
	const infra = await loadInfra(sql);
	try {
		await ensureNativeGas(wallet);
	} catch {}
	const priceWei = centsToWei(listing.priceCents);
	const payNative = !(infra.devMode && infra.demoBank);
	let dxdaiWei = null;
	let marketPull = null;
	if (!payNative && infra.demoBank) {
		try {
			const [bal, allowed] = await Promise.all([bankBalance(infra.demoBank, wallet), marketPullAllowed(infra.demoBank, listing.marketplace)]);
			dxdaiWei = bal.toString();
			marketPull = allowed;
		} catch {
			throw new Error("Could not read DxDAI balance or marketplace pull permission. Retry in a moment.");
		}
		if (!marketPull) throw new Error("This marketplace is not authorized to pull DxDAI. Recast Dev mode and remint the event. DxDAI has no buyer approve — the bank allow-lists the marketplace.");
		if (BigInt(dxdaiWei) < priceWei) throw new Error("Insufficient DxDAI for this ticket. Claim 100 DxDAI on the marketplace, then retry.");
	}
	return {
		ticketId: listing.ticketId,
		chainId: listing.chainId,
		marketplace: listing.marketplace,
		digest: "",
		priceCents: listing.priceCents,
		priceWei: priceWei.toString(),
		payNative,
		eventName: listing.eventName,
		tierName: listing.tierName,
		dxdaiWei,
		marketPull
	};
}
async function cheapestListing(sql, wallet, tierId) {
	const tier = (await sql`
      select * from ticket_tiers where id = ${tierId}
    `)[0];
	if (!tier) throw new Error("Tier not found.");
	const ev = (await sql`select * from events where id = ${tier.event_id}`)[0];
	if (!ev.marketplace_address) throw new Error("This event has no marketplace contract.");
	if (ev.cancelled_at) throw new Error("Event cancelled.");
	if (ev.frozen_at) throw new Error("This event is frozen by the platform admin.");
	if (asTime(ev.ends_at) < Date.now()) throw new Error("Event has ended.");
	if ((await sql`
    select id from tickets
    where event_id = ${tier.event_id}
      and owner_wallet = ${wallet}
      and status in ('owned','listed','used')
  `).length) throw new Error("Limit: 1 ticket per wallet per event.");
	const listing = (await sql`
      select * from listings
      where tier_id = ${tierId} and active = true
      order by price_cents asc, id asc
      limit 1
    `)[0];
	if (!listing) throw new Error("Sold out for this tier.");
	const ticket = (await sql`select chain_id from tickets where id = ${listing.ticket_id}`)[0];
	if (!ticket?.chain_id) throw new Error("Ticket is not on-chain.");
	return {
		listingId: listing.id,
		ticketId: listing.ticket_id,
		seller: listing.seller_wallet,
		priceCents: listing.price_cents,
		chainId: ticket.chain_id,
		marketplace: ev.marketplace_address,
		eventId: ev.id,
		eventName: ev.name,
		tierName: tier.name,
		faceCents: tier.face_cents,
		engineVersion: ev.engine_version ?? 1,
		frozen: Boolean(ev.frozen_at)
	};
}
async function confirmBuy(sql, wallet, tierId, txHash, chainId) {
	await boot(sql);
	await assertKycApproved(sql, wallet);
	const tier = (await sql`
      select * from ticket_tiers where id = ${tierId}
    `)[0];
	if (!tier) throw new Error("Tier not found.");
	const ev = (await sql`select * from events where id = ${tier.event_id}`)[0];
	if (!ev?.marketplace_address) throw new Error("This event has no marketplace contract.");
	const ticket = (await sql`
      select id, chain_id, owner_wallet, status, face_cents, token_uri
      from tickets
      where event_id = ${ev.id} and chain_id = ${chainId}
    `)[0];
	if (!ticket) throw new Error("On-chain ticket not found in the index.");
	if (ticket.owner_wallet === wallet && ticket.status === "owned") {
		const existing = (await sql`
        select ref, amount_cents from ledger
        where ticket_id = ${ticket.id} and kind in ('buy_primary','buy_resale')
        order by id desc limit 1
      `)[0];
		await resolvePending(sql, txHash);
		return {
			ref: existing?.ref ?? txHash,
			tx: txHash,
			tokenId: `${ev.marketplace_address}:${chainId}`,
			serial: chainId,
			priceCents: existing?.amount_cents ?? ticket.face_cents,
			primary: false,
			tierName: tier.name,
			eventName: ev.name,
			collectionAddress: ev.collection_address,
			tokenUri: ticket.token_uri
		};
	}
	const { verifyUserBuy } = await import("./chain.server-u4NE0w9L.mjs");
	const bought = await verifyUserBuy({
		txHash,
		buyer: wallet,
		marketplace: ev.marketplace_address,
		ticketId: chainId
	});
	const listing = (await sql`
      select id, seller_wallet from listings where ticket_id = ${ticket.id} and active = true
    `)[0];
	const isPrimary = bought.primary;
	const priceCents = bought.priceCents || ticket.face_cents;
	if (ev.collection_address) {
		const { readOwnerOf } = await import("./chain.server-u4NE0w9L.mjs");
		if ((await readOwnerOf(ev.collection_address, chainId)).toLowerCase() !== wallet.toLowerCase()) throw new Error("On-chain NFT owner does not match this wallet.");
	}
	try {
		if (isPrimary) await sql`
        update event_vaults set locked_cents = locked_cents + ${priceCents}
        where event_id = ${ev.id}
      `;
		else {
			const royaltyBps = (await sql`select royalty_bps from platform_settings where id = 1`)[0].royalty_bps;
			await sql`
        update event_vaults set locked_cents = locked_cents + ${Math.floor(priceCents * royaltyBps / 1e4)}
        where event_id = ${ev.id}
      `;
		}
		await sql`update listings set active = false where ticket_id = ${ticket.id} and active = true`;
		await sql`update tickets set owner_wallet = ${wallet}, status = 'owned' where id = ${ticket.id}`;
		const ref = await writeLedger(sql, {
			eventId: ev.id,
			ticketId: ticket.id,
			kind: isPrimary ? "buy_primary" : "buy_resale",
			from: wallet,
			to: isPrimary ? "vault" : listing?.seller_wallet ?? "seller",
			amount: priceCents,
			tx: bought.hash
		});
		await resolvePending(sql, bought.hash);
		return {
			ref,
			tx: bought.hash,
			tokenId: `${ev.marketplace_address}:${chainId}`,
			serial: chainId,
			priceCents,
			primary: isPrimary,
			tierName: tier.name,
			eventName: ev.name,
			collectionAddress: ev.collection_address,
			tokenUri: ticket.token_uri
		};
	} catch (err) {
		const message = err instanceof Error ? err.message : "index failed";
		await markPending(sql, "buy", bought.hash, {
			wallet,
			tierId,
			chainId,
			ticketId: ticket.id,
			priceCents,
			primary: isPrimary
		}, message);
		throw new Error("On-chain buy confirmed. Index lagged — retry Buy Now on this event to finish syncing.");
	}
}
async function listResale(sql, wallet, ticketId, priceCents, txHash) {
	const ticket = (await sql`select * from tickets where id = ${ticketId}`)[0];
	if (!ticket || ticket.owner_wallet !== wallet) throw new Error("You do not own this ticket.");
	if (ticket.status === "used") throw new Error("Checked-in tickets cannot be resold.");
	if (ticket.status === "refunded") throw new Error("Refunded ticket.");
	if (!ticket.chain_id) throw new Error("Ticket is not on-chain.");
	const ev = (await sql`select * from events where id = ${ticket.event_id}`)[0];
	if (!ev.marketplace_address) throw new Error("No marketplace contract.");
	if (ev.cancelled_at) throw new Error("Event cancelled.");
	if (ev.frozen_at) throw new Error("This event is frozen by the platform admin.");
	if (asTime(ev.ends_at) < Date.now()) throw new Error("Event ended.");
	const { min, max } = priceBounds(ticket.face_cents);
	if (priceCents < min || priceCents > max) throw new Error(`Resale must be between ${(min / 100).toFixed(2)} and ${(max / 100).toFixed(2)}.`);
	const { verifyUserList } = await import("./chain.server-u4NE0w9L.mjs");
	const hash = await verifyUserList({
		txHash,
		seller: wallet,
		marketplace: ev.marketplace_address,
		ticketId: ticket.chain_id
	});
	if (ticket.status === "listed") {
		if ((await sql`select id from listings where ticket_id = ${ticketId} and active = true`).length) {
			await resolvePending(sql, hash);
			return {
				ref: hash,
				tx: hash
			};
		}
	}
	try {
		await sql`update listings set active = false where ticket_id = ${ticketId} and active = true`;
		await sql`update tickets set status = 'listed' where id = ${ticketId}`;
		await sql`
      insert into listings (ticket_id, event_id, tier_id, seller_wallet, price_cents, active)
      values (${ticketId}, ${ticket.event_id}, ${ticket.tier_id}, ${wallet}, ${priceCents}, true)
    `;
		const ref = await writeLedger(sql, {
			eventId: ticket.event_id,
			ticketId,
			kind: "list",
			from: wallet,
			amount: priceCents,
			tx: hash
		});
		await resolvePending(sql, hash);
		return {
			ref,
			tx: hash
		};
	} catch (err) {
		const message = err instanceof Error ? err.message : "index failed";
		await markPending(sql, "list", hash, {
			wallet,
			ticketId,
			priceCents
		}, message);
		throw new Error("On-chain list confirmed. Index lagged — retry from Admin → Chain index.");
	}
}
async function quoteList(sql, wallet, ticketId, priceCents) {
	const ticket = (await sql`select * from tickets where id = ${ticketId}`)[0];
	if (!ticket || ticket.owner_wallet !== wallet) throw new Error("You do not own this ticket.");
	if (!ticket.chain_id) throw new Error("Ticket is not on-chain.");
	const ev = (await sql`select * from events where id = ${ticket.event_id}`)[0];
	const { centsToWei } = await import("./chain.server-u4NE0w9L.mjs");
	return {
		digest: "",
		marketplace: ev.marketplace_address,
		chainId: ticket.chain_id,
		priceWei: centsToWei(priceCents).toString()
	};
}
async function delistTicket(sql, wallet, ticketId, txHash) {
	const ticket = (await sql`select owner_wallet, status, chain_id, event_id from tickets where id = ${ticketId}`)[0];
	if (!ticket || ticket.owner_wallet !== wallet) throw new Error("You do not own this ticket.");
	const ev = (await sql`select * from events where id = ${ticket.event_id}`)[0];
	if (txHash && ticket.chain_id && ev?.marketplace_address) {
		const { verifyUserDelist } = await import("./chain.server-u4NE0w9L.mjs");
		await verifyUserDelist({
			txHash,
			owner: wallet,
			marketplace: ev.marketplace_address,
			ticketId: ticket.chain_id
		});
	}
	if (ticket.status === "owned") {
		if (txHash) await resolvePending(sql, txHash);
		return;
	}
	try {
		await sql`update listings set active = false where ticket_id = ${ticketId} and active = true`;
		if (ticket.status === "listed") await sql`update tickets set status = 'owned' where id = ${ticketId}`;
		if (txHash) await resolvePending(sql, txHash);
	} catch (err) {
		if (!txHash) throw err;
		const message = err instanceof Error ? err.message : "index failed";
		await markPending(sql, "delist", txHash, {
			wallet,
			ticketId
		}, message);
		throw new Error("On-chain delist confirmed. Index lagged — retry from Admin → Chain index.");
	}
}
async function myTickets(sql, wallet) {
	await boot(sql);
	const rows = await sql`
    select
      t.id, t.token_id, t.serial, t.status, t.face_cents, t.event_id, t.chain_id, t.token_uri,
      e.name, e.venue, e.poster_url, e.starts_at, e.ends_at, e.cancelled_at,
      e.collection_address, e.marketplace_address, e.engine_version,
      tr.name as tier_name, tr.contract_address,
      (select l.price_cents from listings l where l.ticket_id = t.id and l.active = true limit 1) as list_price
    from tickets t
    join events e on e.id = t.event_id
    join ticket_tiers tr on tr.id = t.tier_id
    where t.owner_wallet = ${wallet} and t.status in ('owned','listed','used','refunded')
    order by e.starts_at asc, t.id asc
  `;
	const proposals = await sql`
    select id, event_id, status, coalesce(yes_weight,0)::int as yes_weight, coalesce(sold_weight,0)::int as sold_weight, deadline
    from withdraw_requests
    where status in ('pending_vote','passed','escalated')
    order by id desc
  `;
	const votes = await sql`
    select request_id, chain_id from withdraw_votes where voter = ${wallet}
  `;
	const voted = new Set(votes.map((v) => `${v.request_id}:${v.chain_id}`));
	const latest = /* @__PURE__ */ new Map();
	for (const p of proposals) if (!latest.has(p.event_id)) latest.set(p.event_id, p);
	return rows.map((r) => {
		const p = latest.get(r.event_id);
		return {
			id: r.id,
			tokenId: r.token_id,
			serial: r.serial,
			status: r.status,
			faceCents: r.face_cents,
			eventId: r.event_id,
			eventName: r.name,
			venue: r.venue,
			posterUrl: r.poster_url,
			startsAt: r.starts_at,
			endsAt: r.ends_at,
			cancelled: Boolean(r.cancelled_at),
			tierName: r.tier_name,
			contractAddress: r.collection_address || r.contract_address,
			marketplaceAddress: r.marketplace_address,
			collectionAddress: r.collection_address,
			tokenUri: r.token_uri,
			listPriceCents: r.list_price,
			chainId: r.chain_id,
			phase: eventPhase({
				cancelled: Boolean(r.cancelled_at),
				endsAt: r.ends_at
			}),
			engineVersion: r.engine_version ?? 1,
			proposal: p ? {
				status: p.status,
				yesWeight: p.yes_weight,
				soldWeight: p.sold_weight,
				deadline: p.deadline,
				hasVoted: Boolean(r.chain_id && voted.has(`${p.id}:${r.chain_id}`))
			} : null
		};
	});
}
async function issueQr(sql, wallet, ticketId) {
	const ticket = (await sql`select * from tickets where id = ${ticketId}`)[0];
	if (!ticket || ticket.owner_wallet !== wallet) return {
		locked: true,
		unlocksAt: null,
		reason: "You do not own this ticket."
	};
	if (ticket.status === "used") return {
		locked: true,
		unlocksAt: null,
		reason: "Already checked in."
	};
	if (ticket.status === "refunded") return {
		locked: true,
		unlocksAt: null,
		reason: "Ticket was refunded."
	};
	const ev = (await sql`select * from events where id = ${ticket.event_id}`)[0];
	if (ev.cancelled_at) return {
		locked: true,
		unlocksAt: null,
		reason: "Event cancelled."
	};
	const start = asTime(ev.starts_at);
	const end = asTime(ev.ends_at);
	const now = Date.now();
	if (now > end) return {
		locked: true,
		unlocksAt: null,
		reason: "Event has ended."
	};
	const unlocks = start - QR_UNLOCK_MS;
	if (now < unlocks) return {
		locked: true,
		unlocksAt: new Date(unlocks).toISOString(),
		reason: "QR unlocks 2 hours before doors."
	};
	const payload = buildQrPayload(ticket.id);
	return {
		locked: false,
		unlocksAt: new Date(unlocks).toISOString(),
		payload,
		expiresAt: new Date(Date.now() + QR_WINDOW_MS).toISOString()
	};
}
async function checkIn(sql, staffWallet, payload) {
	await boot(sql);
	const me = await getMe(sql, staffWallet);
	if (!me.isOrganizer && !me.isAdmin) throw new Error("Gate access is limited to approved organizers.");
	const { ticketId } = parseQrPayload(payload);
	const ticket = (await sql`select * from tickets where id = ${ticketId}`)[0];
	if (!ticket) throw new Error("Unknown ticket.");
	if (ticket.status === "used") throw new Error("Already checked in.");
	if (ticket.status === "refunded" || ticket.status === "vault") throw new Error("Ticket is not valid for entry.");
	const ev = (await sql`select * from events where id = ${ticket.event_id}`)[0];
	if (ev.cancelled_at) throw new Error("Event cancelled.");
	const now = Date.now();
	if (now < asTime(ev.starts_at) - 72e5) throw new Error("Too early for this event.");
	if (now > asTime(ev.ends_at)) throw new Error("Event has ended.");
	if (!ev.marketplace_address || !ticket.chain_id) throw new Error("Ticket is not on-chain.");
	const { submitCheckIn } = await import("./chain.server-u4NE0w9L.mjs");
	const hash = await submitCheckIn({
		marketplace: ev.marketplace_address,
		id: ticket.chain_id
	});
	try {
		return await applyCheckInIndex(sql, {
			ticketId: ticket.id,
			eventId: ticket.event_id,
			owner: ticket.owner_wallet,
			tokenId: ticket.token_id,
			serial: ticket.serial,
			eventName: ev.name,
			txHash: hash
		});
	} catch (err) {
		const message = err instanceof Error ? err.message : "index failed";
		await markPending(sql, "checkin", hash, {
			ticketId: ticket.id,
			chainId: ticket.chain_id,
			marketplace: ev.marketplace_address,
			owner: ticket.owner_wallet,
			eventId: ticket.event_id,
			tokenId: ticket.token_id,
			serial: ticket.serial,
			eventName: ev.name
		}, message);
		throw new Error("On-chain check-in confirmed. Index lagged — retry from Admin → Chain index.");
	}
}
async function applyCheckInIndex(sql, row) {
	await sql`update listings set active = false where ticket_id = ${row.ticketId} and active = true`;
	await sql`update tickets set status = 'used' where id = ${row.ticketId}`;
	const ref = await writeLedger(sql, {
		eventId: row.eventId,
		ticketId: row.ticketId,
		kind: "checkin",
		from: "server",
		to: row.owner,
		amount: 0,
		tx: row.txHash
	});
	await resolvePending(sql, row.txHash);
	return {
		ref,
		tx: row.txHash,
		tokenId: row.tokenId,
		serial: row.serial,
		eventName: row.eventName,
		owner: row.owner
	};
}
async function mintEvent(sql, wallet, input, jobId) {
	await boot(sql);
	const markStep = async (index) => {
		if (!jobId) return;
		await sql`update mint_jobs set current_step = ${index}, status = 'running', error = null, updated_at = now() where id = ${jobId} and organizer_wallet = ${wallet}`;
	};
	if (!(await getMe(sql, wallet)).isOrganizer) throw new Error("Only approved organizers can mint.");
	if (!input.name.trim()) throw new Error("Event name required.");
	if (!input.tiers.length) throw new Error("Add at least one ticket tier.");
	const start = new Date(input.startsAt).getTime();
	const end = new Date(input.endsAt).getTime();
	if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) throw new Error("Event end must be after start.");
	for (const t of input.tiers) {
		if (!t.name.trim()) throw new Error("Each tier needs a name.");
		if (t.faceCents < 100) throw new Error("Face value must be at least 1.00.");
		if (t.supply < 1 || t.supply > 200) throw new Error("Supply must be 1–200 per tier.");
	}
	const { loadInfra, recordContract } = await import("./infra.server-dbfo18Hy.mjs");
	const infra = await loadInfra(sql);
	if (!infra.pinataJwt) throw new Error("Pinata JWT is required so each tier gets a non-empty tokenURI.");
	const { pinTicketMetadata } = await import("./pinata.server-BOywXToV.mjs");
	const metas = [];
	await markStep(0);
	for (const t of input.tiers) {
		const meta = await pinTicketMetadata({
			eventName: input.name.trim(),
			description: input.description,
			venue: input.venue.trim(),
			tierName: t.name.trim(),
			faceCents: t.faceCents,
			imageUrl: input.posterUrl.trim()
		});
		if (!meta.url && !meta.uri) throw new Error("Pinata returned an empty token URI.");
		metas.push(meta);
	}
	const { deployEventContracts, mintTierOnChain, setTierUriOnChain } = await import("./chain.server-u4NE0w9L.mjs");
	const royalty = (await sql`select royalty_bps from platform_settings where id = 1`)[0];
	const bank = infra.devMode && infra.demoBank ? infra.demoBank : null;
	const deployed = await deployEventContracts({
		organizer: wallet,
		endsAtSec: Math.floor(end / 1e3),
		royaltyBps: royalty.royalty_bps,
		bank,
		name: input.name.trim(),
		onStep: markStep
	});
	const ev = (await sql`
      insert into events (
        organizer_wallet, name, description, venue, category, poster_url, starts_at, ends_at,
        vault_address, marketplace_address, collection_address, deploy_tx, engine_version
      ) values (
        ${wallet}, ${input.name.trim()}, ${input.description.trim()}, ${input.venue.trim()},
        ${input.category.trim() || "Concert"}, ${input.posterUrl.trim()},
        ${new Date(input.startsAt).toISOString()}, ${new Date(input.endsAt).toISOString()},
        ${deployed.vault}, ${deployed.marketplace}, ${deployed.collection}, ${deployed.marketTx}, ${4}
      ) returning id
    `)[0];
	await sql`insert into event_vaults (event_id, locked_cents) values (${ev.id}, 0)`;
	await recordContract(sql, {
		kind: "vault",
		eventId: ev.id,
		address: deployed.vault,
		tx: deployed.vaultTx
	});
	await recordContract(sql, {
		kind: "marketplace",
		eventId: ev.id,
		address: deployed.marketplace,
		tx: deployed.marketTx
	});
	await recordContract(sql, {
		kind: "collection",
		eventId: ev.id,
		address: deployed.collection,
		tx: deployed.collectionTx
	});
	let chainId = 0;
	const ticketMetadata = [];
	for (let i = 0; i < input.tiers.length; i += 1) {
		const t = input.tiers[i];
		const meta = metas[i];
		const tierOnChain = chainId + 1;
		const tokenUri = meta.url || meta.uri;
		ticketMetadata.push({
			tierName: t.name.trim(),
			tokenUri,
			tokenId: chainId + 1
		});
		const stageOffset = bank ? 7 : 6;
		await markStep(stageOffset + i * 2);
		await setTierUriOnChain({
			marketplace: deployed.marketplace,
			tierId: tierOnChain,
			uri: tokenUri
		});
		await markStep(stageOffset + i * 2 + 1);
		await mintTierOnChain({
			marketplace: deployed.marketplace,
			tierId: tierOnChain,
			supply: t.supply,
			faceCents: t.faceCents
		});
		const tier = (await sql`
        insert into ticket_tiers (event_id, name, face_cents, supply, contract_address)
        values (
          ${ev.id}, ${t.name.trim()}, ${t.faceCents}, ${t.supply},
          ${deployed.collection}
        ) returning id
      `)[0];
		for (let serial = 1; serial <= t.supply; serial += 1) {
			chainId += 1;
			const tokenId = `${deployed.collection}:${chainId}`;
			await sql`
        insert into tickets (
          event_id, tier_id, serial, token_id, owner_wallet, status, face_cents, chain_id, token_uri
        ) values (
          ${ev.id}, ${tier.id}, ${serial}, ${tokenId}, 'vault', 'vault', ${t.faceCents}, ${chainId}, ${tokenUri}
        )
      `;
			await sql`
        insert into listings (ticket_id, event_id, tier_id, seller_wallet, price_cents, active)
        values (${(await sql`select id from tickets where token_id = ${tokenId}`)[0].id}, ${ev.id}, ${tier.id}, 'vault', ${t.faceCents}, true)
      `;
		}
	}
	if (jobId) await sql`update mint_jobs set status = 'done', current_step = ${input.tiers.length * 2 + (bank ? 7 : 6)}, event_id = ${ev.id}, updated_at = now() where id = ${jobId} and organizer_wallet = ${wallet}`;
	await writeLedger(sql, {
		eventId: ev.id,
		kind: "mint",
		from: wallet,
		amount: 0,
		tx: deployed.marketTx
	});
	return {
		eventId: ev.id,
		vault: deployed.vault,
		marketplace: deployed.marketplace,
		collection: deployed.collection,
		tx: deployed.marketTx,
		metadata: ticketMetadata
	};
}
async function mintJobProgress(sql, wallet, jobId) {
	const row = (await sql`
    select current_step, status, error, event_id from mint_jobs where id = ${jobId} and organizer_wallet = ${wallet}
  `)[0];
	if (!row) return {
		currentStep: 0,
		status: "pending",
		error: null,
		eventId: null
	};
	return {
		currentStep: row.current_step,
		status: row.status,
		error: row.error,
		eventId: row.event_id
	};
}
async function failMintJob(sql, wallet, jobId, error) {
	await sql`update mint_jobs set status = 'failed', error = ${error.slice(0, 500)}, updated_at = now() where id = ${jobId} and organizer_wallet = ${wallet}`;
}
async function organizerEvents(sql, wallet) {
	await boot(sql);
	return (await sql.query(`${EVENT_CARDS} where e.organizer_wallet = $1 order by e.starts_at desc`, [wallet])).map(toOrganizer);
}
async function adminAllEvents(sql) {
	await boot(sql);
	return (await sql.query(`${EVENT_CARDS} order by e.starts_at desc`)).map(toOrganizer);
}
async function cancelEvent(sql, wallet, eventId) {
	const ev = (await sql`select * from events where id = ${eventId}`)[0];
	if (!ev) throw new Error("Event not found.");
	if (ev.organizer_wallet !== wallet) throw new Error("Not your event.");
	if (ev.cancelled_at) throw new Error("Already cancelled.");
	if (!cancellationIsOpen(Date.now(), asTime(ev.ends_at))) throw new Error("This event has ended. Cancellation and refunds are closed.");
	const vault = (await sql`
      select locked_cents, withdrawn from event_vaults where event_id = ${eventId}
    `)[0];
	if (vault.withdrawn) throw new Error("Proceeds already withdrawn.");
	const holders = await sql`
    select id, owner_wallet, face_cents, chain_id from tickets
    where event_id = ${eventId} and status in ('owned','listed','used')
  `;
	if (ev.marketplace_address) {
		const { submitCancel } = await import("./chain.server-u4NE0w9L.mjs");
		const ids = holders.map((h) => h.chain_id).filter((id) => Boolean(id));
		const hashes = await submitCancel({
			marketplace: ev.marketplace_address,
			ids
		});
		let locked = vault.locked_cents;
		for (let i = 0; i < holders.length; i += 1) {
			const h = holders[i];
			locked = Math.max(0, locked - h.face_cents);
			await sql`update listings set active = false where ticket_id = ${h.id} and active = true`;
			await sql`update tickets set status = 'refunded' where id = ${h.id}`;
			await writeLedger(sql, {
				eventId,
				ticketId: h.id,
				kind: "refund",
				from: "vault",
				to: h.owner_wallet,
				amount: h.face_cents,
				tx: hashes[i + 1] ?? hashes[0]
			});
		}
		await sql`update event_vaults set locked_cents = ${locked} where event_id = ${eventId}`;
		await sql`update events set cancelled_at = now() where id = ${eventId}`;
		await sql`update listings set active = false where event_id = ${eventId} and seller_wallet = 'vault'`;
		return;
	}
	let locked = vault.locked_cents;
	for (const h of holders) {
		locked = Math.max(0, locked - h.face_cents);
		await sql`update listings set active = false where ticket_id = ${h.id} and active = true`;
		await sql`update tickets set status = 'refunded' where id = ${h.id}`;
		await writeLedger(sql, {
			eventId,
			ticketId: h.id,
			kind: "refund",
			from: "vault",
			to: h.owner_wallet,
			amount: h.face_cents
		});
	}
	await sql`update event_vaults set locked_cents = ${locked} where event_id = ${eventId}`;
	await sql`update events set cancelled_at = now() where id = ${eventId}`;
	await sql`update listings set active = false where event_id = ${eventId} and seller_wallet = 'vault'`;
}
async function requestWithdraw(sql, wallet, eventId) {
	const ev = (await sql`select * from events where id = ${eventId}`)[0];
	if (!ev) throw new Error("Event not found.");
	if (ev.organizer_wallet !== wallet) throw new Error("Not your event.");
	if (ev.cancelled_at) throw new Error("Cancelled events cannot withdraw.");
	if (ev.frozen_at) throw new Error("This event is frozen.");
	if (Date.now() < asTime(ev.ends_at)) throw new Error("Vault unlocks after the event ends.");
	const vault = (await sql`
      select locked_cents, withdrawn from event_vaults where event_id = ${eventId}
    `)[0];
	if (vault.withdrawn) throw new Error("Already withdrawn.");
	if ((await sql`
    select id from withdraw_requests
    where event_id = ${eventId}
      and status in ('pending','pending_vote','passed','escalated')
  `).length) throw new Error("A withdraw request is already open.");
	if ((ev.engine_version ?? 1) >= 3) {
		if (!ev.collection_address || !ev.marketplace_address || !ev.vault_address) throw new Error("This event is missing its ERC-721 collection. Remint the show.");
		const { submitRequestWithdraw, readVaultGov } = await import("./chain.server-u4NE0w9L.mjs");
		const hash = await submitRequestWithdraw(ev.marketplace_address);
		const gov = await readVaultGov(ev.vault_address, ev.engine_version ?? 3);
		const status = (ev.engine_version ?? 3) >= 4 ? "pending_vote" : gov.withdrawAllowed ? "passed" : "pending_vote";
		const deadline = gov.voteDeadline ? (/* @__PURE__ */ new Date(gov.voteDeadline * 1e3)).toISOString() : null;
		return {
			id: (await sql`
        insert into withdraw_requests (
          event_id, organizer_wallet, amount_cents, status, yes_weight, sold_weight, deadline, tx_hash
        ) values (
          ${eventId}, ${wallet}, ${vault.locked_cents}, ${status},
          ${gov.yesWeight}, ${gov.soldWeight}, ${deadline}, ${hash}
        ) returning id
      `)[0].id,
			tx: hash,
			status
		};
	}
	return { id: (await sql`
      insert into withdraw_requests (event_id, organizer_wallet, amount_cents, status)
      values (${eventId}, ${wallet}, ${vault.locked_cents}, 'pending')
      returning id
    `)[0].id };
}
async function decideWithdraw(sql, adminWallet, requestId, approve) {
	if (!(await getMe(sql, adminWallet)).isAdmin) throw new Error("Admin only.");
	const req = (await sql`select * from withdraw_requests where id = ${requestId}`)[0];
	if (!req) throw new Error("Request not found.");
	const ev = (await sql`select * from events where id = ${req.event_id}`)[0];
	if ((ev?.engine_version ?? 1) >= 3) {
		if (req.status !== "escalated") throw new Error("Holder vote is still open. Admin can only decide after the organizer escalates.");
		if (!ev?.vault_address) throw new Error("Event has no vault.");
		const { loadInfra } = await import("./infra.server-dbfo18Hy.mjs");
		const { submitAdminDecide } = await import("./chain.server-u4NE0w9L.mjs");
		const infra = await loadInfra(sql);
		const token = infra.devMode && infra.demoBank ? infra.demoBank : null;
		const txs = await submitAdminDecide({
			vault: ev.vault_address,
			approve,
			token
		});
		if (!approve) {
			await sql`
        update withdraw_requests
        set status = 'rejected', decided_by = ${adminWallet}, decided_at = now(), tx_hash = ${txs.decideTx}
        where id = ${requestId}
      `;
			return {
				ok: true,
				status: "rejected",
				tx: txs.decideTx
			};
		}
		await sql`update event_vaults set locked_cents = 0, withdrawn = true where event_id = ${req.event_id}`;
		await sql`
      update withdraw_requests
      set status = 'done', decided_by = ${adminWallet}, decided_at = now(), tx_hash = ${txs.withdrawTx ?? txs.decideTx}
      where id = ${requestId}
    `;
		await writeLedger(sql, {
			eventId: req.event_id,
			kind: "withdraw",
			from: "vault",
			to: ev.organizer_wallet,
			amount: req.amount_cents,
			tx: txs.withdrawTx ?? txs.decideTx
		});
		return {
			ok: true,
			status: "done",
			tx: txs.withdrawTx ?? txs.decideTx
		};
	}
	if (req.status !== "pending") throw new Error("Already decided.");
	if (!approve) {
		await sql`
      update withdraw_requests
      set status = 'rejected', decided_by = ${adminWallet}, decided_at = now()
      where id = ${requestId}
    `;
		return {
			ok: true,
			status: "rejected"
		};
	}
	const hash = await executeWithdraw(sql, req.event_id);
	await sql`
    update withdraw_requests
    set status = 'done', decided_by = ${adminWallet}, decided_at = now(), tx_hash = ${hash}
    where id = ${requestId}
  `;
	return {
		ok: true,
		status: "done",
		tx: hash
	};
}
async function executeWithdraw(sql, eventId) {
	const ev = (await sql`select * from events where id = ${eventId}`)[0];
	if (!ev) throw new Error("Event not found.");
	if (ev.cancelled_at) throw new Error("Cancelled events cannot withdraw.");
	if (ev.frozen_at) throw new Error("This event is frozen.");
	if (Date.now() < asTime(ev.ends_at)) throw new Error("Vault unlocks after the event ends.");
	const vault = (await sql`
      select locked_cents, withdrawn from event_vaults where event_id = ${eventId}
    `)[0];
	if (vault.withdrawn) throw new Error("Already withdrawn.");
	if (!ev.vault_address) throw new Error("This event has no vault contract.");
	const { loadInfra } = await import("./infra.server-dbfo18Hy.mjs");
	const { submitWithdraw } = await import("./chain.server-u4NE0w9L.mjs");
	const infra = await loadInfra(sql);
	const token = infra.devMode && infra.demoBank ? infra.demoBank : null;
	const hash = await submitWithdraw(ev.vault_address, token);
	await sql`update event_vaults set locked_cents = 0, withdrawn = true where event_id = ${eventId}`;
	await writeLedger(sql, {
		eventId,
		kind: "withdraw",
		from: "vault",
		to: ev.organizer_wallet,
		amount: vault.locked_cents,
		tx: hash
	});
	return hash;
}
async function freezeEvent(sql, adminWallet, eventId, on) {
	if (!(await getMe(sql, adminWallet)).isAdmin) throw new Error("Admin only.");
	const ev = (await sql`select * from events where id = ${eventId}`)[0];
	if (!ev) throw new Error("Event not found.");
	if (!ev.marketplace_address || !ev.vault_address) throw new Error("Event has no contracts.");
	if ((ev.engine_version ?? 1) >= 3 && !ev.collection_address) throw new Error("This event is missing its ERC-721 collection. Remint before freezing.");
	try {
		const { submitFrozen } = await import("./chain.server-u4NE0w9L.mjs");
		const txs = await submitFrozen({
			marketplace: ev.marketplace_address,
			vault: ev.vault_address,
			collection: ev.collection_address,
			on
		});
		if (on) await sql`update events set frozen_at = now() where id = ${eventId}`;
		else await sql`update events set frozen_at = null where id = ${eventId}`;
		await writeLedger(sql, {
			eventId,
			kind: on ? "freeze" : "unfreeze",
			from: adminWallet,
			amount: 0,
			tx: txs.vaultTx
		});
	} catch (err) {
		if ((ev.engine_version ?? 1) >= 3) throw err;
		if (on) await sql`update events set frozen_at = now() where id = ${eventId}`;
		else await sql`update events set frozen_at = null where id = ${eventId}`;
		await writeLedger(sql, {
			eventId,
			kind: on ? "freeze" : "unfreeze",
			from: adminWallet,
			amount: 0
		});
	}
	return { frozen: on };
}
async function listWithdrawRequests(sql, adminWallet) {
	if (!(await getMe(sql, adminWallet)).isAdmin) throw new Error("Admin only.");
	return (await sql`
    select r.id, r.event_id, r.organizer_wallet, r.amount_cents, r.status, r.tx_hash, r.created_at, e.name, e.engine_version,
      r.yes_weight, r.sold_weight, r.deadline, r.materials_uri
    from withdraw_requests r
    join events e on e.id = r.event_id
    order by r.id desc
    limit 40
  `).map((r) => ({
		id: r.id,
		eventId: r.event_id,
		eventName: r.name,
		organizerWallet: r.organizer_wallet,
		amountCents: r.amount_cents,
		status: r.status,
		txHash: r.tx_hash,
		createdAt: r.created_at,
		yesWeight: r.yes_weight ?? 0,
		soldWeight: r.sold_weight ?? 0,
		deadline: r.deadline,
		materialsUri: r.materials_uri,
		engineVersion: r.engine_version ?? 1
	}));
}
async function adminSignerOps(sql, adminWallet) {
	if (!(await getMe(sql, adminWallet)).isAdmin) throw new Error("Admin only.");
	return (await sql`
    select l.id, l.kind, l.amount_cents, l.ref, l.created_at, e.name as event_name
    from ledger l
    left join events e on e.id = l.event_id
    where l.kind in ('mint','checkin','refund','withdraw','freeze','unfreeze','buy_primary','buy_resale','list')
    order by l.id desc
    limit 40
  `).map((r) => ({
		id: r.id,
		kind: r.kind,
		amountCents: r.amount_cents,
		ref: r.ref,
		createdAt: r.created_at,
		eventName: r.event_name,
		onChain: /^0x[0-9a-fA-F]{64}$/.test(r.ref)
	}));
}
async function listPendingIndex(sql, adminWallet) {
	if (!(await getMe(sql, adminWallet)).isAdmin) throw new Error("Admin only.");
	await boot(sql);
	return (await sql`
    select id, kind, tx_hash, error, created_at
    from pending_index
    where resolved_at is null
    order by created_at desc
    limit 50
  `).map((r) => ({
		id: r.id,
		kind: r.kind,
		txHash: r.tx_hash,
		error: r.error,
		createdAt: r.created_at
	}));
}
async function dismissPendingIndex(sql, adminWallet, id) {
	if (!(await getMe(sql, adminWallet)).isAdmin) throw new Error("Admin only.");
	if (!(await sql`select id from pending_index where id = ${id}`)[0]) throw new Error("Pending row not found.");
	await sql`update pending_index set resolved_at = now() where id = ${id}`;
	return { ok: true };
}
async function replayPendingIndex(sql, adminWallet, id) {
	if (!(await getMe(sql, adminWallet)).isAdmin) throw new Error("Admin only.");
	const row = (await sql`select id, kind, tx_hash, payload, resolved_at from pending_index where id = ${id}`)[0];
	if (!row) throw new Error("Pending row not found.");
	if (row.resolved_at) return {
		ok: true,
		already: true
	};
	const payload = parsePayload(row.payload);
	const txHash = row.tx_hash;
	try {
		if (row.kind === "buy") await confirmBuy(sql, String(payload.wallet ?? ""), Number(payload.tierId), txHash, Number(payload.chainId));
		else if (row.kind === "list") await listResale(sql, String(payload.wallet ?? ""), Number(payload.ticketId), Number(payload.priceCents), txHash);
		else if (row.kind === "delist") await delistTicket(sql, String(payload.wallet ?? ""), Number(payload.ticketId), txHash);
		else if (row.kind === "checkin") {
			const ticketId = Number(payload.ticketId);
			const chainId = Number(payload.chainId);
			const marketplace = String(payload.marketplace ?? "");
			const { verifyCheckIn } = await import("./chain.server-u4NE0w9L.mjs");
			await verifyCheckIn({
				txHash,
				marketplace,
				ticketId: chainId
			});
			if ((await sql`select status from tickets where id = ${ticketId}`)[0]?.status === "used") await resolvePending(sql, txHash);
			else await applyCheckInIndex(sql, {
				ticketId,
				eventId: Number(payload.eventId),
				owner: String(payload.owner ?? ""),
				tokenId: String(payload.tokenId ?? ""),
				serial: Number(payload.serial ?? 0),
				eventName: String(payload.eventName ?? ""),
				txHash
			});
		} else if (row.kind === "vote") await confirmVote(sql, String(payload.wallet ?? ""), Number(payload.ticketId), txHash);
		else throw new Error(`Unknown pending kind: ${row.kind}`);
		await resolvePending(sql, txHash);
		return { ok: true };
	} catch (err) {
		await sql`update pending_index set error = ${err instanceof Error ? err.message : "replay failed"} where id = ${id}`;
		throw err;
	}
}
async function confirmVote(sql, wallet, ticketId, txHash) {
	await boot(sql);
	const voter = wallet.toLowerCase();
	const ticket = (await sql`select id, event_id, owner_wallet, status, chain_id from tickets where id = ${ticketId}`)[0];
	if (!ticket || ticket.owner_wallet.toLowerCase() !== voter) throw new Error("You do not hold this ticket.");
	if (ticket.status !== "owned" && ticket.status !== "listed" && ticket.status !== "used") throw new Error("Only sold tickets can vote.");
	if (!ticket.chain_id) throw new Error("Ticket is not on-chain.");
	const ev = (await sql`select * from events where id = ${ticket.event_id}`)[0];
	if (!ev) throw new Error("Event not found.");
	if ((ev.engine_version ?? 1) < 3) throw new Error("This event uses admin-only payout.");
	if (!ev.marketplace_address || !ev.collection_address || !ev.vault_address) throw new Error("This event is missing its ERC-721 collection. Remint the show.");
	const req = (await sql`
      select id, status from withdraw_requests
      where event_id = ${ticket.event_id} and status in ('pending_vote','passed')
      order by id desc limit 1
    `)[0];
	if (!req) throw new Error("No open holder vote for this event.");
	const existing = (await sql`
      select id from withdraw_votes where request_id = ${req.id} and chain_id = ${ticket.chain_id}
    `)[0];
	if (!existing) {
		const { verifyUserVote } = await import("./chain.server-u4NE0w9L.mjs");
		await verifyUserVote({
			txHash,
			voter,
			marketplace: ev.marketplace_address,
			ticketId: ticket.chain_id
		});
	}
	try {
		if (!existing) await sql`
        insert into withdraw_votes (request_id, ticket_id, chain_id, voter, tx_hash)
        values (${req.id}, ${ticket.id}, ${ticket.chain_id}, ${voter}, ${txHash})
        on conflict (request_id, chain_id) do nothing
      `;
		const { readVaultGov } = await import("./chain.server-u4NE0w9L.mjs");
		const gov = await readVaultGov(ev.vault_address, ev.engine_version ?? 3);
		const v4 = (ev.engine_version ?? 3) >= 4;
		const deadlinePassed = Date.now() >= gov.voteDeadline * 1e3;
		const status = gov.escalated ? "escalated" : v4 ? deadlinePassed && objectionWindowPasses(gov.objectionWeight, gov.soldWeight) ? "passed" : "pending_vote" : gov.withdrawAllowed ? "passed" : "pending_vote";
		await sql`
      update withdraw_requests
      set yes_weight = ${v4 ? gov.objectionWeight : gov.yesWeight}, sold_weight = ${gov.soldWeight}, status = ${status}
      where id = ${req.id}
    `;
		await resolvePending(sql, txHash);
		return {
			ok: true,
			status,
			yesWeight: v4 ? gov.objectionWeight : gov.yesWeight,
			soldWeight: gov.soldWeight,
			already: Boolean(existing)
		};
	} catch (err) {
		const message = err instanceof Error ? err.message : "index failed";
		if (!existing) await markPending(sql, "vote", txHash, {
			wallet: voter,
			ticketId: ticket.id,
			chainId: ticket.chain_id,
			eventId: ticket.event_id
		}, message);
		throw new Error("Vote confirmed on-chain. Index lagged — retry from Admin → Chain index.");
	}
}
async function escalateWithdraw(sql, wallet, eventId, materialsUri) {
	const uri = materialsUri.trim();
	if (!uri) throw new Error("Upload payout materials (Pinata URI) before escalating.");
	const ev = (await sql`select * from events where id = ${eventId}`)[0];
	if (!ev) throw new Error("Event not found.");
	if (ev.organizer_wallet !== wallet.toLowerCase() && ev.organizer_wallet !== wallet) throw new Error("Not your event.");
	if ((ev.engine_version ?? 1) < 3) throw new Error("Legacy events are approved by admin, not escalated.");
	if (!ev.marketplace_address || !ev.collection_address || !ev.vault_address) throw new Error("This event is missing its ERC-721 collection. Remint the show.");
	if (ev.frozen_at) throw new Error("This event is frozen.");
	const req = (await sql`
      select id, status from withdraw_requests
      where event_id = ${eventId} and status in ('pending_vote','escalated')
      order by id desc limit 1
    `)[0];
	if (!req) throw new Error("No open vote to escalate.");
	const { readVaultGov, submitEscalate } = await import("./chain.server-u4NE0w9L.mjs");
	const version = ev.engine_version ?? 1;
	const gov = await readVaultGov(ev.vault_address, version);
	if (version >= 4) {
		if (Date.now() < gov.voteDeadline * 1e3) throw new Error("The 7-day vote is still open.");
		if (!objectionRequiresAdminReview(gov.objectionWeight, gov.soldWeight)) throw new Error("Fewer than one third opposed. Execute the withdraw instead.");
	} else if (gov.withdrawAllowed) throw new Error("Vote already reached 2/3. Execute the withdraw instead.");
	let hash = null;
	if (!gov.escalated) hash = await submitEscalate({
		marketplace: ev.marketplace_address,
		uri
	});
	await sql`
    update withdraw_requests
    set status = 'escalated', materials_uri = ${uri}, tx_hash = coalesce(${hash}, tx_hash)
    where id = ${req.id}
  `;
	return {
		ok: true,
		status: "escalated",
		tx: hash
	};
}
async function executeGovWithdraw(sql, wallet, eventId) {
	const ev = (await sql`select * from events where id = ${eventId}`)[0];
	if (!ev) throw new Error("Event not found.");
	if (ev.organizer_wallet !== wallet.toLowerCase() && ev.organizer_wallet !== wallet) throw new Error("Not your event.");
	if (ev.cancelled_at) throw new Error("Cancelled events cannot withdraw.");
	if (ev.frozen_at) throw new Error("This event is frozen.");
	if (Date.now() < asTime(ev.ends_at)) throw new Error("Vault unlocks after the event ends.");
	if ((ev.engine_version ?? 1) < 3) throw new Error("Legacy payouts are executed by admin.");
	if (!ev.marketplace_address || !ev.collection_address || !ev.vault_address) throw new Error("This event is missing its ERC-721 collection. Remint the show.");
	const vaultRow = (await sql`
      select locked_cents, withdrawn from event_vaults where event_id = ${eventId}
    `)[0];
	if (vaultRow?.withdrawn) throw new Error("Already withdrawn.");
	const req = (await sql`
      select id, status from withdraw_requests
      where event_id = ${eventId} and status in ('passed','pending_vote')
      order by id desc limit 1
    `)[0];
	if (!req) throw new Error("Open a holder vote before withdrawing.");
	const { loadInfra } = await import("./infra.server-dbfo18Hy.mjs");
	const { readVaultGov, submitExecuteWithdraw } = await import("./chain.server-u4NE0w9L.mjs");
	const infra = await loadInfra(sql);
	const token = infra.devMode && infra.demoBank ? infra.demoBank : null;
	const gov = await readVaultGov(ev.vault_address, ev.engine_version ?? 3);
	const v4 = (ev.engine_version ?? 3) >= 4;
	if (!gov.withdrawn && (v4 ? Date.now() < gov.voteDeadline * 1e3 || !objectionWindowPasses(gov.objectionWeight, gov.soldWeight) : !gov.withdrawAllowed)) throw new Error(v4 ? "The vote must end with fewer than one third opposing." : "Holder vote has not reached 2/3 yet.");
	let hash = null;
	if (!gov.withdrawn) hash = await submitExecuteWithdraw({
		marketplace: ev.marketplace_address,
		token
	});
	await sql`update event_vaults set locked_cents = 0, withdrawn = true where event_id = ${eventId}`;
	await sql`
    update withdraw_requests
    set status = 'done', tx_hash = coalesce(${hash}, tx_hash), decided_at = now()
    where id = ${req.id}
  `;
	if (hash) await writeLedger(sql, {
		eventId,
		kind: "withdraw",
		from: "vault",
		to: ev.organizer_wallet,
		amount: vaultRow?.locked_cents ?? 0,
		tx: hash
	});
	return {
		ok: true,
		status: "done",
		tx: hash
	};
}
async function withdrawVault(sql, wallet, eventId) {
	return requestWithdraw(sql, wallet, eventId);
}
async function organizerEventLedger(sql, wallet, eventId) {
	const event = (await sql`select id, organizer_wallet from events where id = ${eventId}`)[0];
	if (!event || event.organizer_wallet.toLowerCase() !== wallet.toLowerCase()) throw new Error("Not your event.");
	return (await sql`
    select id, event_id, kind, amount_cents, ref, created_at from ledger where event_id = ${eventId} order by id desc limit 100
  `).map((r) => ({
		id: r.id,
		eventId: r.event_id,
		kind: r.kind,
		amountCents: r.amount_cents,
		ref: r.ref,
		createdAt: r.created_at,
		eventName: null,
		onChain: /^0x[0-9a-fA-F]{64}$/.test(r.ref)
	}));
}
async function royaltyBps(sql) {
	await boot(sql);
	return (await sql`select royalty_bps from platform_settings where id = 1`)[0].royalty_bps;
}
async function setRoyalty(sql, wallet, bps) {
	if (!(await getMe(sql, wallet)).isAdmin) throw new Error("Admin only.");
	if (bps < 0 || bps > 2e3) throw new Error("Royalty must be 0–20%.");
	await sql`update platform_settings set royalty_bps = ${bps}, updated_at = now() where id = 1`;
}
async function addOrganizer(sql, adminWallet, walletRaw, name) {
	if (!(await getMe(sql, adminWallet)).isAdmin) throw new Error("Admin only.");
	const wallet = normalizeWallet(walletRaw);
	const label = name.trim();
	if (!label) throw new Error("Organizer name required.");
	await sql`
    insert into organizers (wallet, name, status)
    values (${wallet}, ${label}, 'approved')
    on conflict (wallet) do update set name = ${label}, status = 'approved'
  `;
}
async function setOrganizerStatus(sql, adminWallet, target, status) {
	if (!(await getMe(sql, adminWallet)).isAdmin) throw new Error("Admin only.");
	await sql`update organizers set status = ${status} where wallet = ${normalizeWallet(target)}`;
}
async function listOrganizers(sql, adminWallet) {
	if (!(await getMe(sql, adminWallet)).isAdmin) throw new Error("Admin only.");
	return (await sql`
    select o.wallet, o.name, o.status, o.created_at,
      (select count(*)::int from events e where e.organizer_wallet = o.wallet) as event_count
    from organizers o
    order by o.created_at desc
  `).map((r) => ({
		wallet: r.wallet,
		name: r.name,
		status: r.status,
		eventCount: r.event_count,
		createdAt: r.created_at
	}));
}
async function adminCount(sql) {
	await boot(sql);
	return (await sql`select count(*)::int as n from admins`)[0].n;
}
async function listAdmins(sql) {
	await boot(sql);
	return (await sql`select wallet from admins order by created_at asc`).map((r) => r.wallet);
}
function secretMask(value) {
	const v = value.trim();
	if (!v) return null;
	return `••••${v.slice(-4)}`;
}
async function getInfraStatus(sql, wallet) {
	await boot(sql);
	if (!(await getMe(sql, wallet)).isAdmin) throw new Error("Admin only.");
	const { loadInfra, tableCounts, listContracts } = await import("./infra.server-dbfo18Hy.mjs");
	const { readPlatform } = await import("./platform-ITGl4Pv_.mjs").then((n) => n.n).then((n) => n.n);
	const plat = readPlatform();
	const { describeDatabaseUrl, envDatabaseUrlSet, getDbSource, resolveDatabaseUrl } = await import("./db-6MgyDrQq.mjs").then((n) => n.t).then((n) => n.t);
	const cfg = await loadInfra(sql);
	const desc = describeDatabaseUrl(resolveDatabaseUrl());
	let tables = [];
	let dbError = null;
	let connected = false;
	try {
		tables = await tableCounts(sql);
		connected = true;
	} catch (err) {
		dbError = redactSecrets(err instanceof Error ? err.message : "Database probe failed");
	}
	let chain = {
		rpcUrl: cfg.rpcUrl,
		chainId: cfg.chainId,
		chainName: plat.chainName,
		nativeSymbol: plat.nativeSymbol,
		connected: false,
		blockNumber: null,
		operatorAddress: null,
		operatorBalance: null,
		operatorKeySet: Boolean(cfg.operatorPk),
		operatorMask: secretMask(cfg.operatorPk),
		explorerUrl: cfg.explorerUrl,
		lastError: null,
		lastAnchor: null,
		error: null,
		devMode: Boolean(cfg.devMode),
		demoBank: cfg.demoBank || null,
		pinataSet: Boolean(cfg.pinataJwt),
		pinataMask: secretMask(cfg.pinataJwt)
	};
	try {
		const { lastAnchor, lastChainError, pingChain } = await import("./chain.server-u4NE0w9L.mjs");
		const ping = await pingChain(cfg.rpcUrl, cfg.chainId);
		chain = {
			...chain,
			connected: true,
			blockNumber: ping.blockNumber,
			chainId: ping.chainId,
			operatorAddress: ping.operatorAddress,
			operatorBalance: ping.operatorBalance,
			lastError: redactSecrets(lastChainError() ?? ""),
			lastAnchor: lastAnchor()
		};
	} catch (err) {
		const { lastAnchor, lastChainError } = await import("./chain.server-u4NE0w9L.mjs");
		chain.error = redactSecrets(err instanceof Error ? err.message : "RPC unreachable");
		chain.lastError = redactSecrets(lastChainError() ?? "");
		chain.lastAnchor = lastAnchor();
	}
	return {
		db: {
			source: getDbSource(),
			connected,
			host: desc.host,
			masked: desc.masked,
			envUrlSet: envDatabaseUrlSet(),
			overrideSet: Boolean(cfg.databaseUrl),
			tables,
			error: dbError
		},
		chain,
		contracts: (await listContracts(sql)).map((c) => ({
			id: c.id,
			kind: c.kind,
			eventId: c.event_id,
			address: c.address,
			txHash: c.tx_hash,
			createdAt: c.created_at
		})),
		royaltyBps: await royaltyBps(sql),
		adminCount: await adminCount(sql),
		adminWallet: plat.adminWallet,
		setup: {
			database: connected,
			pinata: Boolean(cfg.pinataJwt),
			signer: Boolean(cfg.operatorPk),
			complete: connected && Boolean(cfg.pinataJwt) && Boolean(cfg.operatorPk)
		},
		kyc: await kycInfraSummary(sql)
	};
}
async function applyInfra(sql, wallet, patch) {
	if (!(await getMe(sql, wallet)).isAdmin) throw new Error("Admin only.");
	const { saveInfra } = await import("./infra.server-dbfo18Hy.mjs");
	await saveInfra(sql, patch);
	invalidatePublicConfig();
	return getInfraStatus(await (await import("./db-6MgyDrQq.mjs").then((n) => n.t).then((n) => n.t)).getSql(), wallet);
}
async function probeDatabaseUrl(wallet, url) {
	const { getSql } = await import("./db-6MgyDrQq.mjs").then((n) => n.t).then((n) => n.t);
	if (!(await getMe(await getSql(), wallet)).isAdmin) throw new Error("Admin only.");
	const { probePostgres } = await import("./db-6MgyDrQq.mjs").then((n) => n.t).then((n) => n.t);
	try {
		return await probePostgres(url);
	} catch (err) {
		const msg = err instanceof Error ? err.message : "Database connection failed.";
		throw new Error(redactSecrets(msg).slice(0, 180) || "Database connection failed.");
	}
}
var PUB_TTL_MS = 3e5;
var pubCache = null;
function invalidatePublicConfig() {
	pubCache = null;
}
async function publicConfig() {
	const gen = globalRefBoot().__ctBootGen__ ?? 0;
	if (pubCache && pubCache.gen === gen && Date.now() - pubCache.at < PUB_TTL_MS) return pubCache.value;
	const { getSql } = await import("./db-6MgyDrQq.mjs").then((n) => n.t).then((n) => n.t);
	const { loadInfra } = await import("./infra.server-dbfo18Hy.mjs");
	const { readPlatform } = await import("./platform-ITGl4Pv_.mjs").then((n) => n.n).then((n) => n.n);
	const sql = await getSql();
	await boot(sql);
	const plat = readPlatform();
	const infra = await loadInfra(sql);
	const value = {
		chainName: plat.chainName,
		nativeSymbol: plat.nativeSymbol,
		chainId: plat.chainId,
		rpcUrl: plat.rpcUrl,
		explorerUrl: plat.explorerUrl,
		adminConfigured: Boolean(plat.adminWallet),
		devMode: Boolean(infra.devMode),
		demoBank: infra.demoBank || null,
		pinataReady: Boolean(infra.pinataJwt),
		setupComplete: Boolean(infra.pinataJwt && infra.operatorPk)
	};
	pubCache = {
		gen,
		at: Date.now(),
		value
	};
	return value;
}
async function enableDevMode(sql, wallet, on) {
	if (!(await getMe(sql, wallet)).isAdmin) throw new Error("Admin only.");
	const { saveInfra, recordContract } = await import("./infra.server-dbfo18Hy.mjs");
	if (on) {
		const { deployDemoBank } = await import("./chain.server-u4NE0w9L.mjs");
		const deployed = await deployDemoBank(wallet);
		await recordContract(sql, {
			kind: "demo_bank",
			address: deployed.address,
			tx: deployed.tx
		});
		await saveInfra(sql, {
			devMode: true,
			demoBank: deployed.address
		});
	} else await saveInfra(sql, {
		devMode: false,
		demoBank: ""
	});
	invalidatePublicConfig();
	return getInfraStatus(await (await import("./db-6MgyDrQq.mjs").then((n) => n.t).then((n) => n.t)).getSql(), wallet);
}
async function setPlatformAdmin(sql, actor, address) {
	await boot(sql);
	if (configuredAdmin()) {
		if (!(await getMe(sql, actor)).isAdmin) throw new Error("Admin only.");
	}
	const { writePlatform } = await import("./platform-ITGl4Pv_.mjs").then((n) => n.n).then((n) => n.n);
	const next = writePlatform({ adminWallet: address });
	invalidatePublicConfig();
	await sql`
    insert into admins (wallet) values (${next.adminWallet.toLowerCase()})
    on conflict (wallet) do nothing
  `;
	return next;
}
async function savePlatformFile(sql, wallet, patch) {
	if (!(await getMe(sql, wallet)).isAdmin && configuredAdmin()) throw new Error("Admin only.");
	const { writePlatform } = await import("./platform-ITGl4Pv_.mjs").then((n) => n.n).then((n) => n.n);
	const next = writePlatform(patch);
	invalidatePublicConfig();
	if (next.adminWallet) await sql`
      insert into admins (wallet) values (${next.adminWallet.toLowerCase()})
      on conflict (wallet) do nothing
    `;
	return next;
}
//#endregion
export { addOrganizer, adminAllEvents, adminCount, adminSignerOps, applyInfra, boot, cancelEvent, checkIn, confirmBuy, confirmVote, decideWithdraw, delistTicket, dismissPendingIndex, enableDevMode, escalateWithdraw, executeGovWithdraw, failMintJob, freezeEvent, getEvent, getInfraStatus, getMe, issueQr, listAdmins, listEvents, listOrganizers, listPendingIndex, listResale, listWithdrawRequests, mintEvent, mintJobProgress, myTickets, organizerEventLedger, organizerEvents, probeDatabaseUrl, publicConfig, quoteBuy, quoteList, replayPendingIndex, royaltyBps, savePlatformFile, setOrganizerStatus, setPlatformAdmin, setRoyalty, spendableBalance, submitKyc, withdrawVault };
