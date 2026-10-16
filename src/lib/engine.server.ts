import type { Sql } from "@/lib/db";
import { Buffer } from "node:buffer";
import { makeTxRef, normalizeWallet } from "@/lib/session.server";
import { configuredAdmin } from "@/lib/platform";
import { buildQrPayload, parseQrPayload, QR_UNLOCK_MS, QR_WINDOW_MS } from "@/lib/qr.server";
import { redactSecrets } from "@/lib/chain-errors";
import { priceBounds, eventPhase } from "@/lib/utils";
import { cancellationIsOpen, objectionRequiresAdminReview, objectionWindowPasses } from "@/lib/payout-rules";
import { assertKycApproved, kycInfraSummary, migrateLegacyKyc, readOwnerKyc, submitKycRecord } from "@/lib/kyc-store.server";
import type {
  BuyQuote,
  EventDetail,
  EventListItem,
  InfraStatus,
  LedgerRow,
  MyTicket,
  OrganizerEvent,
  OrganizerRow,
  PendingIndexRow,
  QrPayload,
  SessionMe,
  TicketStatus,
  TierView,
  WithdrawRequest,
} from "@/lib/types";

type EventRow = {
  id: number;
  organizer_wallet: string;
  name: string;
  description: string;
  venue: string;
  category: string;
  poster_url: string;
  starts_at: string;
  ends_at: string;
  cancelled_at: string | null;
  vault_address: string | null;
  marketplace_address: string | null;
  deploy_tx: string | null;
  engine_version: number | null;
  frozen_at: string | null;
  collection_address: string | null;
};

function asTime(v: string | Date) {
  return new Date(v).getTime();
}

async function writeLedger(
  sql: Sql,
  row: {
    eventId?: number | null;
    ticketId?: number | null;
    kind: string;
    from?: string | null;
    to?: string | null;
    amount: number;
    tx?: string | null;
  },
) {
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

function parsePayload(raw: unknown): Record<string, unknown> {
  if (raw == null) return {};
  if (typeof raw === "object" && !Array.isArray(raw)) return raw as Record<string, unknown>;
  if (typeof raw === "string") {
    try {
      return parsePayload(JSON.parse(raw) as unknown);
    } catch {
      return {};
    }
  }
  return {};
}

async function markPending(
  sql: Sql,
  kind: string,
  txHash: string,
  payload: Record<string, unknown>,
  error: string,
) {
  const encoded = JSON.stringify(payload);
  try {
    await sql`
      insert into pending_index (kind, tx_hash, payload, error)
      values (${kind}, ${txHash}, ${encoded}, ${error})
      on conflict (tx_hash) do update
        set kind = ${kind}, payload = ${encoded}, error = ${error}, resolved_at = null
    `;
  } catch {
    // index-lag row is best-effort; never hide the original write error
  }
}

async function resolvePending(sql: Sql, txHash: string) {
  await sql`
    update pending_index
    set resolved_at = now(), error = null
    where tx_hash = ${txHash} and resolved_at is null
  `;
}

async function syncPlatformAdmin(sql: Sql) {
  const admin = configuredAdmin();
  if (!admin) return;
  await sql`
    insert into admins (wallet) values (${admin})
    on conflict (wallet) do nothing
  `;
}

export async function boot(sql: Sql) {
  const gen = globalRefBoot().__ctBootGen__ ?? 0;
  const slot = globalRefBoot().__ctBoot__;
  if (slot && slot.gen === gen) return slot.promise;
  const promise = runBoot(sql).catch((err) => {
    if (globalRefBoot().__ctBoot__?.promise === promise) globalRefBoot().__ctBoot__ = undefined;
    throw err;
  });
  globalRefBoot().__ctBoot__ = { gen, promise };
  return promise;
}

function globalRefBoot() {
  return globalThis as typeof globalThis & {
    __ctBootGen__?: number;
    __ctBoot__?: { gen: number; promise: Promise<void> };
  };
}

async function runBoot(sql: Sql) {
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
  } catch {
    // already present
  }
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
  } catch {
    // exists
  }
  await sql`update events set engine_version = 1 where engine_version is null`;
  await syncPlatformAdmin(sql);
  await sql`delete from events where vault_address is null or vault_address = ''`;
  await sql`delete from organizers where wallet = ${"0x1111111111111111111111111111111111111111"}`;
  await migrateLegacyKyc(sql);
}

export async function getMe(sql: Sql, wallet: string): Promise<SessionMe> {
  await boot(sql);
  const w = wallet.toLowerCase();
  const [admin, org, kyc, acc] = await Promise.all([
    sql<{ wallet: string }>`select wallet from admins where wallet = ${w}`,
    sql<{ name: string; status: string }>`select name, status from organizers where wallet = ${w}`,
    readOwnerKyc(sql, w),
    sql<{ spendable_cents: number; faucet_claimed: boolean }>`
      select spendable_cents, faucet_claimed from accounts where wallet = ${w}
    `,
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
    role: isAdmin ? "admin" : isOrganizer ? "organizer" : "attendee",
  };
}

const BAL_TTL_MS = 45_000;
const balCache = new Map<string, { cents: number; at: number }>();

/** DxDAI / indexed balance. Not on the login path — callers cache for ~45s. */
export async function spendableBalance(sql: Sql, wallet: string, fresh = false) {
  await boot(sql);
  const w = wallet.toLowerCase();
  const hit = balCache.get(w);
  if (!fresh && hit && Date.now() - hit.at < BAL_TTL_MS) return { cents: hit.cents };
  const acc = await sql<{ spendable_cents: number }>`
    select spendable_cents from accounts where wallet = ${w}
  `;
  let cents = acc[0]?.spendable_cents ?? 0;
  try {
    const { loadInfra } = await import("@/lib/infra.server");
    const infra = await loadInfra(sql);
    if (infra.devMode && infra.demoBank) {
      const { demoStatus } = await import("@/lib/chain.server");
      const st = await demoStatus(infra.demoBank as `0x${string}`, w as `0x${string}`);
      cents = st.cents;
    }
  } catch {
    // indexed balance if Chiado is slow
  }
  balCache.set(w, { cents, at: Date.now() });
  return { cents };
}

type EventCardRow = EventRow & {
  locked_cents: number | null;
  vault_withdrawn: boolean | null;
  sold: number | null;
  supply: number | null;
  checked_in: number | null;
  available: number | null;
  min_cents: number | null;
  max_cents: number | null;
  wr_status: string | null;
  yes_weight: number | null;
  sold_weight: number | null;
  wr_deadline: string | null;
  materials_uri: string | null;
};

const EVENT_CARDS = `
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

function toListItem(e: EventCardRow): EventListItem {
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
    phase: eventPhase({ cancelled: Boolean(e.cancelled_at), endsAt: e.ends_at }),
    engineVersion: e.engine_version ?? 1,
    frozen: Boolean(e.frozen_at),
    collectionAddress: e.collection_address,
  };
}

function toOrganizer(e: EventCardRow): OrganizerEvent {
  const sold = Number(e.sold ?? 0);
  const checked = Number(e.checked_in ?? 0);
  const status = e.wr_status as OrganizerEvent["withdrawRequest"];
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
    phase: eventPhase({ cancelled: Boolean(e.cancelled_at), endsAt: e.ends_at }),
    engineVersion: e.engine_version ?? 1,
    frozen: Boolean(e.frozen_at),
    withdrawRequest: status ?? null,
    proposalYes: Number(e.yes_weight ?? 0),
    proposalSold: Number(e.sold_weight ?? 0),
    proposalDeadline: e.wr_deadline ? new Date(e.wr_deadline).toISOString() : null,
    materialsUri: e.materials_uri,
  };
}

export async function listEvents(sql: Sql, q = "", wallet: string | null = null): Promise<EventListItem[]> {
  await boot(sql);
  const like = `%${q.trim().toLowerCase()}%`;
  const holder = wallet?.toLowerCase() ?? "";
  const rows = await sql.query<EventCardRow>(
    `${EVENT_CARDS}
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
     order by e.starts_at asc`,
    [like, holder],
  );
  return rows.map(toListItem);
}

export async function getEvent(sql: Sql, eventId: number): Promise<EventDetail> {
  await boot(sql);
  const e = (await sql<EventRow>`select * from events where id = ${eventId}`)[0];
  if (!e) throw new Error("Event not found.");
  const org = await sql<{ name: string }>`
    select name from organizers where wallet = ${e.organizer_wallet}
  `;
  const royalty = (await sql<{ royalty_bps: number }>`select royalty_bps from platform_settings where id = 1`)[0];
  const tiers = await sql<{
    id: number;
    name: string;
    engine_version: number | null;
    face_cents: number;
    supply: number;
    contract_address: string;
  }>`select * from ticket_tiers where event_id = ${eventId} order by face_cents desc`;
  const views: TierView[] = [];
  for (const t of tiers) {
    const st = (
      await sql<{ min: number | null; max: number | null; available: number }>`
        select
          min(price_cents) as min,
          max(price_cents) as max,
          count(*)::int as available
        from listings where tier_id = ${t.id} and active = true
      `
    )[0];
    views.push({
      id: t.id,
      name: t.name,
      faceCents: t.face_cents,
      supply: t.supply,
      available: st.available,
      minCents: st.min,
      maxCents: st.max,
      contractAddress: t.contract_address,
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
    phase: eventPhase({ cancelled: Boolean(e.cancelled_at), endsAt: e.ends_at }),
    engineVersion: e.engine_version ?? 1,
    frozen: Boolean(e.frozen_at),
  };
}

export async function submitKyc(
  sql: Sql,
  wallet: string,
  input: {
    fullName: string;
    idNumber: string;
    nationality: string;
    documentExpiresAt: string;
    photoBase64: string;
    contentType: "image/jpeg" | "image/png";
  },
) {
  await boot(sql);
  const raw = input.photoBase64.replace(/^data:image\/[a-z0-9.+-]+;base64,/i, "").replace(/\s/g, "");
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(raw) && !/^[A-Za-z0-9_-]+$/.test(raw)) {
    throw new Error("Photo must be a JPEG or PNG.");
  }
  const bytes = Buffer.from(raw, "base64");
  if (!bytes.length || bytes.length > 4_000_000) throw new Error("Photo must be under 4MB.");
  return submitKycRecord(sql, wallet.toLowerCase(), input.fullName, input.idNumber, input.nationality, input.documentExpiresAt, {
    bytes,
    type: input.contentType,
  });
}

export async function quoteBuy(sql: Sql, wallet: string, tierId: number): Promise<BuyQuote> {
  await boot(sql);
  await assertKycApproved(sql, wallet);
  const listing = await cheapestListing(sql, wallet, tierId);
  if (listing.engineVersion < 2) {
    throw new Error(
      "This event was minted with the old buyWithSig contract. The organizer must mint a new event — your wallet now sends buy() itself.",
    );
  }
  if (listing.frozen) throw new Error("This event is frozen by the platform admin.");
  const { centsToWei, ensureNativeGas, bankBalance, marketPullAllowed } = await import("@/lib/chain.server");
  const { loadInfra } = await import("@/lib/infra.server");
  const infra = await loadInfra(sql);
  try {
    await ensureNativeGas(wallet as `0x${string}`);
  } catch {
    // buyer or operator may still have gas
  }
  const priceWei = centsToWei(listing.priceCents);
  const payNative = !(infra.devMode && infra.demoBank);
  let dxdaiWei: string | null = null;
  let marketPull: boolean | null = null;
  if (!payNative && infra.demoBank) {
    try {
      const [bal, allowed] = await Promise.all([
        bankBalance(infra.demoBank as `0x${string}`, wallet as `0x${string}`),
        marketPullAllowed(infra.demoBank as `0x${string}`, listing.marketplace as `0x${string}`),
      ]);
      dxdaiWei = bal.toString();
      marketPull = allowed;
    } catch {
      throw new Error("Could not read DxDAI balance or marketplace pull permission. Retry in a moment.");
    }
    if (!marketPull) {
      throw new Error(
        "This marketplace is not authorized to pull DxDAI. Recast Dev mode and remint the event. DxDAI has no buyer approve — the bank allow-lists the marketplace.",
      );
    }
    if (BigInt(dxdaiWei) < priceWei) {
      throw new Error("Insufficient DxDAI for this ticket. Claim 100 DxDAI on the marketplace, then retry.");
    }
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
    marketPull,
  };
}

async function cheapestListing(sql: Sql, wallet: string, tierId: number) {
  const tier = (
    await sql<{ id: number; event_id: number; name: string; face_cents: number }>`
      select * from ticket_tiers where id = ${tierId}
    `
  )[0];
  if (!tier) throw new Error("Tier not found.");
  const ev = (await sql<EventRow>`select * from events where id = ${tier.event_id}`)[0];
  if (!ev.marketplace_address) throw new Error("This event has no marketplace contract.");
  if (ev.cancelled_at) throw new Error("Event cancelled.");
  if (ev.frozen_at) throw new Error("This event is frozen by the platform admin.");
  if (asTime(ev.ends_at) < Date.now()) throw new Error("Event has ended.");
  const held = await sql`
    select id from tickets
    where event_id = ${tier.event_id}
      and owner_wallet = ${wallet}
      and status in ('owned','listed','used')
  `;
  if (held.length) throw new Error("Limit: 1 ticket per wallet per event.");
  const listing = (
    await sql<{
      id: number;
      ticket_id: number;
      seller_wallet: string;
      price_cents: number;
    }>`
      select * from listings
      where tier_id = ${tierId} and active = true
      order by price_cents asc, id asc
      limit 1
    `
  )[0];
  if (!listing) throw new Error("Sold out for this tier.");
  const ticket = (
    await sql<{ chain_id: number | null }>`select chain_id from tickets where id = ${listing.ticket_id}`
  )[0];
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
    frozen: Boolean(ev.frozen_at),
  };
}

export async function confirmBuy(
  sql: Sql,
  wallet: string,
  tierId: number,
  txHash: `0x${string}`,
  chainId: number,
) {
  await boot(sql);
  await assertKycApproved(sql, wallet);
  const tier = (
    await sql<{ id: number; event_id: number; name: string }>`
      select * from ticket_tiers where id = ${tierId}
    `
  )[0];
  if (!tier) throw new Error("Tier not found.");
  const ev = (await sql<EventRow>`select * from events where id = ${tier.event_id}`)[0];
  if (!ev?.marketplace_address) throw new Error("This event has no marketplace contract.");
  const ticket = (
    await sql<{
      id: number;
      chain_id: number | null;
      owner_wallet: string;
      status: string;
      face_cents: number;
      token_uri: string | null;
    }>`
      select id, chain_id, owner_wallet, status, face_cents, token_uri
      from tickets
      where event_id = ${ev.id} and chain_id = ${chainId}
    `
  )[0];
  if (!ticket) throw new Error("On-chain ticket not found in the index.");

  if (ticket.owner_wallet === wallet && ticket.status === "owned") {
    const existing = (
      await sql<{ ref: string; amount_cents: number }>`
        select ref, amount_cents from ledger
        where ticket_id = ${ticket.id} and kind in ('buy_primary','buy_resale')
        order by id desc limit 1
      `
    )[0];
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
      tokenUri: ticket.token_uri,
    };
  }

  const { verifyUserBuy } = await import("@/lib/chain.server");
  const bought = await verifyUserBuy({
    txHash,
    buyer: wallet as `0x${string}`,
    marketplace: ev.marketplace_address as `0x${string}`,
    ticketId: chainId,
  });

  const listing = (
    await sql<{ id: number; seller_wallet: string }>`
      select id, seller_wallet from listings where ticket_id = ${ticket.id} and active = true
    `
  )[0];
  const isPrimary = bought.primary;
  const priceCents = bought.priceCents || ticket.face_cents;

  if (ev.collection_address) {
    const { readOwnerOf } = await import("@/lib/chain.server");
    const owner = await readOwnerOf(ev.collection_address as `0x${string}`, chainId);
    if (owner.toLowerCase() !== wallet.toLowerCase()) {
      throw new Error("On-chain NFT owner does not match this wallet.");
    }
  }

  try {
    if (isPrimary) {
      await sql`
        update event_vaults set locked_cents = locked_cents + ${priceCents}
        where event_id = ${ev.id}
      `;
    } else {
      const royaltyBps = (
        await sql<{ royalty_bps: number }>`select royalty_bps from platform_settings where id = 1`
      )[0].royalty_bps;
      const royalty = Math.floor((priceCents * royaltyBps) / 10000);
      await sql`
        update event_vaults set locked_cents = locked_cents + ${royalty}
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
      tx: bought.hash,
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
      tokenUri: ticket.token_uri,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "index failed";
    await markPending(
      sql,
      "buy",
      bought.hash,
      { wallet, tierId, chainId, ticketId: ticket.id, priceCents, primary: isPrimary },
      message,
    );
    throw new Error(
      "On-chain buy confirmed. Index lagged — retry Buy Now on this event to finish syncing.",
    );
  }
}

export async function listResale(
  sql: Sql,
  wallet: string,
  ticketId: number,
  priceCents: number,
  txHash: `0x${string}`,
) {
  const ticket = (
    await sql<{
      id: number;
      event_id: number;
      tier_id: number;
      owner_wallet: string;
      status: string;
      face_cents: number;
      chain_id: number | null;
    }>`select * from tickets where id = ${ticketId}`
  )[0];
  if (!ticket || ticket.owner_wallet !== wallet) throw new Error("You do not own this ticket.");
  if (ticket.status === "used") throw new Error("Checked-in tickets cannot be resold.");
  if (ticket.status === "refunded") throw new Error("Refunded ticket.");
  if (!ticket.chain_id) throw new Error("Ticket is not on-chain.");
  const ev = (await sql<EventRow>`select * from events where id = ${ticket.event_id}`)[0];
  if (!ev.marketplace_address) throw new Error("No marketplace contract.");
  if (ev.cancelled_at) throw new Error("Event cancelled.");
  if (ev.frozen_at) throw new Error("This event is frozen by the platform admin.");
  if (asTime(ev.ends_at) < Date.now()) throw new Error("Event ended.");
  const { min, max } = priceBounds(ticket.face_cents);
  if (priceCents < min || priceCents > max) {
    throw new Error(`Resale must be between ${(min / 100).toFixed(2)} and ${(max / 100).toFixed(2)}.`);
  }
  const { verifyUserList } = await import("@/lib/chain.server");
  const hash = await verifyUserList({
    txHash,
    seller: wallet as `0x${string}`,
    marketplace: ev.marketplace_address as `0x${string}`,
    ticketId: ticket.chain_id,
  });
  if (ticket.status === "listed") {
    const live = await sql`select id from listings where ticket_id = ${ticketId} and active = true`;
    if (live.length) {
      await resolvePending(sql, hash);
      return { ref: hash, tx: hash };
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
      tx: hash,
    });
    await resolvePending(sql, hash);
    return { ref, tx: hash };
  } catch (err) {
    const message = err instanceof Error ? err.message : "index failed";
    await markPending(sql, "list", hash, { wallet, ticketId, priceCents }, message);
    throw new Error("On-chain list confirmed. Index lagged — retry from Admin → Chain index.");
  }
}

export async function quoteList(sql: Sql, wallet: string, ticketId: number, priceCents: number) {
  const ticket = (
    await sql<{
      owner_wallet: string;
      status: string;
      face_cents: number;
      chain_id: number | null;
      event_id: number;
    }>`select * from tickets where id = ${ticketId}`
  )[0];
  if (!ticket || ticket.owner_wallet !== wallet) throw new Error("You do not own this ticket.");
  if (!ticket.chain_id) throw new Error("Ticket is not on-chain.");
  const ev = (await sql<EventRow>`select * from events where id = ${ticket.event_id}`)[0];
  const { centsToWei } = await import("@/lib/chain.server");
  return {
    digest: "",
    marketplace: ev.marketplace_address,
    chainId: ticket.chain_id,
    priceWei: centsToWei(priceCents).toString(),
  };
}

export async function delistTicket(sql: Sql, wallet: string, ticketId: number, txHash?: `0x${string}`) {
  const ticket = (
    await sql<{
      owner_wallet: string;
      status: string;
      chain_id: number | null;
      event_id: number;
    }>`select owner_wallet, status, chain_id, event_id from tickets where id = ${ticketId}`
  )[0];
  if (!ticket || ticket.owner_wallet !== wallet) throw new Error("You do not own this ticket.");
  const ev = (await sql<EventRow>`select * from events where id = ${ticket.event_id}`)[0];
  if (txHash && ticket.chain_id && ev?.marketplace_address) {
    const { verifyUserDelist } = await import("@/lib/chain.server");
    await verifyUserDelist({
      txHash,
      owner: wallet as `0x${string}`,
      marketplace: ev.marketplace_address as `0x${string}`,
      ticketId: ticket.chain_id,
    });
  }
  if (ticket.status === "owned") {
    if (txHash) await resolvePending(sql, txHash);
    return;
  }
  try {
    await sql`update listings set active = false where ticket_id = ${ticketId} and active = true`;
    if (ticket.status === "listed") {
      await sql`update tickets set status = 'owned' where id = ${ticketId}`;
    }
    if (txHash) await resolvePending(sql, txHash);
  } catch (err) {
    if (!txHash) throw err;
    const message = err instanceof Error ? err.message : "index failed";
    await markPending(sql, "delist", txHash, { wallet, ticketId }, message);
    throw new Error("On-chain delist confirmed. Index lagged — retry from Admin → Chain index.");
  }
}

export async function myTickets(sql: Sql, wallet: string): Promise<MyTicket[]> {
  await boot(sql);
  const rows = await sql<{
    id: number;
    token_id: string;
    serial: number;
    status: TicketStatus;
    face_cents: number;
    event_id: number;
    name: string;
    venue: string;
    poster_url: string;
    starts_at: string;
    ends_at: string;
    cancelled_at: string | null;
    tier_name: string;
    contract_address: string;
    list_price: number | null;
    chain_id: number | null;
    token_uri: string | null;
    collection_address: string | null;
    marketplace_address: string | null;
    engine_version: number | null;
  }>`
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
  const proposals = await sql<{
    id: number;
    event_id: number;
    status: string;
    yes_weight: number;
    sold_weight: number;
    deadline: string | null;
  }>`
    select id, event_id, status, coalesce(yes_weight,0)::int as yes_weight, coalesce(sold_weight,0)::int as sold_weight, deadline
    from withdraw_requests
    where status in ('pending_vote','passed','escalated')
    order by id desc
  `;
  const votes = await sql<{ request_id: number; chain_id: number }>`
    select request_id, chain_id from withdraw_votes where voter = ${wallet}
  `;
  const voted = new Set(votes.map((v) => `${v.request_id}:${v.chain_id}`));
  const latest = new Map<number, (typeof proposals)[number]>();
  for (const p of proposals) {
    if (!latest.has(p.event_id)) latest.set(p.event_id, p);
  }
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
      phase: eventPhase({ cancelled: Boolean(r.cancelled_at), endsAt: r.ends_at }),
      engineVersion: r.engine_version ?? 1,
      proposal: p
        ? {
            status: p.status,
            yesWeight: p.yes_weight,
            soldWeight: p.sold_weight,
            deadline: p.deadline,
            hasVoted: Boolean(r.chain_id && voted.has(`${p.id}:${r.chain_id}`)),
          }
        : null,
    };
  });
}

export async function issueQr(sql: Sql, wallet: string, ticketId: number): Promise<QrPayload> {
  const ticket = (
    await sql<{
      id: number;
      owner_wallet: string;
      status: string;
      event_id: number;
    }>`select * from tickets where id = ${ticketId}`
  )[0];
  if (!ticket || ticket.owner_wallet !== wallet) {
    return { locked: true, unlocksAt: null, reason: "You do not own this ticket." };
  }
  if (ticket.status === "used") {
    return { locked: true, unlocksAt: null, reason: "Already checked in." };
  }
  if (ticket.status === "refunded") {
    return { locked: true, unlocksAt: null, reason: "Ticket was refunded." };
  }
  const ev = (await sql<EventRow>`select * from events where id = ${ticket.event_id}`)[0];
  if (ev.cancelled_at) return { locked: true, unlocksAt: null, reason: "Event cancelled." };
  const start = asTime(ev.starts_at);
  const end = asTime(ev.ends_at);
  const now = Date.now();
  if (now > end) return { locked: true, unlocksAt: null, reason: "Event has ended." };
  const unlocks = start - QR_UNLOCK_MS;
  if (now < unlocks) {
    return { locked: true, unlocksAt: new Date(unlocks).toISOString(), reason: "QR unlocks 2 hours before doors." };
  }
  const payload = buildQrPayload(ticket.id);
  return {
    locked: false,
    unlocksAt: new Date(unlocks).toISOString(),
    payload,
    expiresAt: new Date(Date.now() + QR_WINDOW_MS).toISOString(),
  };
}

export async function checkIn(sql: Sql, staffWallet: string, payload: string) {
  await boot(sql);
  const me = await getMe(sql, staffWallet);
  if (!me.isOrganizer && !me.isAdmin) throw new Error("Gate access is limited to approved organizers.");
  const { ticketId } = parseQrPayload(payload);
  const ticket = (
    await sql<{
      id: number;
      event_id: number;
      owner_wallet: string;
      status: string;
      token_id: string;
      serial: number;
      chain_id: number | null;
    }>`select * from tickets where id = ${ticketId}`
  )[0];
  if (!ticket) throw new Error("Unknown ticket.");
  if (ticket.status === "used") throw new Error("Already checked in.");
  if (ticket.status === "refunded" || ticket.status === "vault") throw new Error("Ticket is not valid for entry.");
  const ev = (await sql<EventRow>`select * from events where id = ${ticket.event_id}`)[0];
  if (ev.cancelled_at) throw new Error("Event cancelled.");
  const now = Date.now();
  if (now < asTime(ev.starts_at) - QR_UNLOCK_MS) throw new Error("Too early for this event.");
  if (now > asTime(ev.ends_at)) throw new Error("Event has ended.");
  if (!ev.marketplace_address || !ticket.chain_id) throw new Error("Ticket is not on-chain.");
  const { submitCheckIn } = await import("@/lib/chain.server");
  const hash = await submitCheckIn({
    marketplace: ev.marketplace_address as `0x${string}`,
    id: ticket.chain_id,
  });
  try {
    return await applyCheckInIndex(sql, {
      ticketId: ticket.id,
      eventId: ticket.event_id,
      owner: ticket.owner_wallet,
      tokenId: ticket.token_id,
      serial: ticket.serial,
      eventName: ev.name,
      txHash: hash,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "index failed";
    await markPending(
      sql,
      "checkin",
      hash,
      {
        ticketId: ticket.id,
        chainId: ticket.chain_id,
        marketplace: ev.marketplace_address,
        owner: ticket.owner_wallet,
        eventId: ticket.event_id,
        tokenId: ticket.token_id,
        serial: ticket.serial,
        eventName: ev.name,
      },
      message,
    );
    throw new Error("On-chain check-in confirmed. Index lagged — retry from Admin → Chain index.");
  }
}

async function applyCheckInIndex(
  sql: Sql,
  row: {
    ticketId: number;
    eventId: number;
    owner: string;
    tokenId: string;
    serial: number;
    eventName: string;
    txHash: string;
  },
) {
  await sql`update listings set active = false where ticket_id = ${row.ticketId} and active = true`;
  await sql`update tickets set status = 'used' where id = ${row.ticketId}`;
  const ref = await writeLedger(sql, {
    eventId: row.eventId,
    ticketId: row.ticketId,
    kind: "checkin",
    from: "server",
    to: row.owner,
    amount: 0,
    tx: row.txHash,
  });
  await resolvePending(sql, row.txHash);
  return {
    ref,
    tx: row.txHash,
    tokenId: row.tokenId,
    serial: row.serial,
    eventName: row.eventName,
    owner: row.owner,
  };
}

export async function mintEvent(
  sql: Sql,
  wallet: string,
  input: {
    name: string;
    description: string;
    venue: string;
    category: string;
    posterUrl: string;
    startsAt: string;
    endsAt: string;
    tiers: { name: string; faceCents: number; supply: number }[];
  },
  jobId?: string,
) {
  await boot(sql);
  const markStep = async (index: number) => {
    if (!jobId) return;
    await sql`update mint_jobs set current_step = ${index}, status = 'running', error = null, updated_at = now() where id = ${jobId} and organizer_wallet = ${wallet}`;
  };
  const me = await getMe(sql, wallet);
  if (!me.isOrganizer) throw new Error("Only approved organizers can mint.");
  if (!input.name.trim()) throw new Error("Event name required.");
  if (!input.tiers.length) throw new Error("Add at least one ticket tier.");
  const start = new Date(input.startsAt).getTime();
  const end = new Date(input.endsAt).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    throw new Error("Event end must be after start.");
  }
  for (const t of input.tiers) {
    if (!t.name.trim()) throw new Error("Each tier needs a name.");
    if (t.faceCents < 100) throw new Error("Face value must be at least 1.00.");
    if (t.supply < 1 || t.supply > 200) throw new Error("Supply must be 1–200 per tier.");
  }

  const { loadInfra, recordContract } = await import("@/lib/infra.server");
  const infra = await loadInfra(sql);
  if (!infra.pinataJwt) {
    throw new Error("Pinata JWT is required so each tier gets a non-empty tokenURI.");
  }
  const { pinTicketMetadata } = await import("@/lib/pinata.server");
  const metas: { uri: string; url: string }[] = [];
  await markStep(0);
  for (const t of input.tiers) {
    const meta = await pinTicketMetadata({
      eventName: input.name.trim(),
      description: input.description,
      venue: input.venue.trim(),
      tierName: t.name.trim(),
      faceCents: t.faceCents,
      imageUrl: input.posterUrl.trim(),
    });
    if (!meta.url && !meta.uri) throw new Error("Pinata returned an empty token URI.");
    metas.push(meta);
  }
  const { deployEventContracts, mintTierOnChain, setTierUriOnChain } = await import("@/lib/chain.server");
  const royalty = (await sql<{ royalty_bps: number }>`select royalty_bps from platform_settings where id = 1`)[0];
  const bank = infra.devMode && infra.demoBank ? (infra.demoBank as `0x${string}`) : null;
  const deployed = await deployEventContracts({
    organizer: wallet as `0x${string}`,
    endsAtSec: Math.floor(end / 1000),
    royaltyBps: royalty.royalty_bps,
    bank,
    name: input.name.trim(),
    onStep: markStep,
  });

  const ev = (
    await sql<{ id: number }>`
      insert into events (
        organizer_wallet, name, description, venue, category, poster_url, starts_at, ends_at,
        vault_address, marketplace_address, collection_address, deploy_tx, engine_version
      ) values (
        ${wallet}, ${input.name.trim()}, ${input.description.trim()}, ${input.venue.trim()},
        ${input.category.trim() || "Concert"}, ${input.posterUrl.trim()},
        ${new Date(input.startsAt).toISOString()}, ${new Date(input.endsAt).toISOString()},
        ${deployed.vault}, ${deployed.marketplace}, ${deployed.collection}, ${deployed.marketTx}, ${4}
      ) returning id
    `
  )[0];
  await sql`insert into event_vaults (event_id, locked_cents) values (${ev.id}, 0)`;
  await recordContract(sql, {
    kind: "vault",
    eventId: ev.id,
    address: deployed.vault,
    tx: deployed.vaultTx,
  });
  await recordContract(sql, {
    kind: "marketplace",
    eventId: ev.id,
    address: deployed.marketplace,
    tx: deployed.marketTx,
  });
  await recordContract(sql, {
    kind: "collection",
    eventId: ev.id,
    address: deployed.collection,
    tx: deployed.collectionTx,
  });

  let chainId = 0;
  const ticketMetadata: { tierName: string; tokenUri: string; tokenId: number }[] = [];
  for (let i = 0; i < input.tiers.length; i += 1) {
    const t = input.tiers[i]!;
    const meta = metas[i]!;
    const tierOnChain = chainId + 1;
    const tokenUri = meta.url || meta.uri;
    ticketMetadata.push({ tierName: t.name.trim(), tokenUri, tokenId: chainId + 1 });
    const stageOffset = bank ? 7 : 6;
    await markStep(stageOffset + i * 2);
    await setTierUriOnChain({
      marketplace: deployed.marketplace,
      tierId: tierOnChain,
      uri: tokenUri,
    });
    await markStep(stageOffset + i * 2 + 1);
    const mintTx = await mintTierOnChain({
      marketplace: deployed.marketplace,
      tierId: tierOnChain,
      supply: t.supply,
      faceCents: t.faceCents,
    });
    const tier = (
      await sql<{ id: number }>`
        insert into ticket_tiers (event_id, name, face_cents, supply, contract_address)
        values (
          ${ev.id}, ${t.name.trim()}, ${t.faceCents}, ${t.supply},
          ${deployed.collection}
        ) returning id
      `
    )[0];
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
      const ticket = (
        await sql<{ id: number }>`select id from tickets where token_id = ${tokenId}`
      )[0];
      await sql`
        insert into listings (ticket_id, event_id, tier_id, seller_wallet, price_cents, active)
        values (${ticket.id}, ${ev.id}, ${tier.id}, 'vault', ${t.faceCents}, true)
      `;
    }
    void mintTx;
  }
  if (jobId) {
    await sql`update mint_jobs set status = 'done', current_step = ${input.tiers.length * 2 + (bank ? 7 : 6)}, event_id = ${ev.id}, updated_at = now() where id = ${jobId} and organizer_wallet = ${wallet}`;
  }
  await writeLedger(sql, {
    eventId: ev.id,
    kind: "mint",
    from: wallet,
    amount: 0,
    tx: deployed.marketTx,
  });
  return {
    eventId: ev.id,
    vault: deployed.vault,
    marketplace: deployed.marketplace,
    collection: deployed.collection,
    tx: deployed.marketTx,
    metadata: ticketMetadata,
  };
}

export async function mintJobProgress(sql: Sql, wallet: string, jobId: string) {
  const row = (await sql<{ current_step: number; status: string; error: string | null; event_id: number | null }>`
    select current_step, status, error, event_id from mint_jobs where id = ${jobId} and organizer_wallet = ${wallet}
  `)[0];
  if (!row) return { currentStep: 0, status: "pending", error: null, eventId: null };
  return { currentStep: row.current_step, status: row.status, error: row.error, eventId: row.event_id };
}

export async function failMintJob(sql: Sql, wallet: string, jobId: string, error: string) {
  await sql`update mint_jobs set status = 'failed', error = ${error.slice(0, 500)}, updated_at = now() where id = ${jobId} and organizer_wallet = ${wallet}`;
}

export async function organizerEvents(sql: Sql, wallet: string): Promise<OrganizerEvent[]> {
  await boot(sql);
  const rows = await sql.query<EventCardRow>(
    `${EVENT_CARDS} where e.organizer_wallet = $1 order by e.starts_at desc`,
    [wallet],
  );
  return rows.map(toOrganizer);
}

export async function adminAllEvents(sql: Sql) {
  await boot(sql);
  const rows = await sql.query<EventCardRow>(`${EVENT_CARDS} order by e.starts_at desc`);
  return rows.map(toOrganizer);
}

export async function listAllEvents(sql: Sql, wallet: string) {
  const me = await getMe(sql, wallet);
  if (!me.isAdmin) throw new Error("Admin only.");
  return adminAllEvents(sql);
}

export async function cancelEvent(sql: Sql, wallet: string, eventId: number) {
  const ev = (await sql<EventRow>`select * from events where id = ${eventId}`)[0];
  if (!ev) throw new Error("Event not found.");
  if (ev.organizer_wallet !== wallet) throw new Error("Not your event.");
  if (ev.cancelled_at) throw new Error("Already cancelled.");
  if (!cancellationIsOpen(Date.now(), asTime(ev.ends_at))) throw new Error("This event has ended. Cancellation and refunds are closed.");
  const vault = (
    await sql<{ locked_cents: number; withdrawn: boolean }>`
      select locked_cents, withdrawn from event_vaults where event_id = ${eventId}
    `
  )[0];
  if (vault.withdrawn) throw new Error("Proceeds already withdrawn.");
  const holders = await sql<{ id: number; owner_wallet: string; face_cents: number; chain_id: number | null }>`
    select id, owner_wallet, face_cents, chain_id from tickets
    where event_id = ${eventId} and status in ('owned','listed','used')
  `;
  if (ev.marketplace_address) {
    const { submitCancel } = await import("@/lib/chain.server");
    const ids = holders.map((h) => h.chain_id).filter((id): id is number => Boolean(id));
    const hashes = await submitCancel({ marketplace: ev.marketplace_address as `0x${string}`, ids });
    let locked = vault.locked_cents;
    for (let i = 0; i < holders.length; i += 1) {
      const h = holders[i]!;
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
        tx: hashes[i + 1] ?? hashes[0],
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
      amount: h.face_cents,
    });
  }
  await sql`update event_vaults set locked_cents = ${locked} where event_id = ${eventId}`;
  await sql`update events set cancelled_at = now() where id = ${eventId}`;
  await sql`update listings set active = false where event_id = ${eventId} and seller_wallet = 'vault'`;
}

export async function requestWithdraw(sql: Sql, wallet: string, eventId: number) {
  const ev = (await sql<EventRow>`select * from events where id = ${eventId}`)[0];
  if (!ev) throw new Error("Event not found.");
  if (ev.organizer_wallet !== wallet) throw new Error("Not your event.");
  if (ev.cancelled_at) throw new Error("Cancelled events cannot withdraw.");
  if (ev.frozen_at) throw new Error("This event is frozen.");
  if (Date.now() < asTime(ev.ends_at)) throw new Error("Vault unlocks after the event ends.");
  const vault = (
    await sql<{ locked_cents: number; withdrawn: boolean }>`
      select locked_cents, withdrawn from event_vaults where event_id = ${eventId}
    `
  )[0];
  if (vault.withdrawn) throw new Error("Already withdrawn.");
  const open = await sql`
    select id from withdraw_requests
    where event_id = ${eventId}
      and status in ('pending','pending_vote','passed','escalated')
  `;
  if (open.length) throw new Error("A withdraw request is already open.");
  if ((ev.engine_version ?? 1) >= 3) {
    if (!ev.collection_address || !ev.marketplace_address || !ev.vault_address) {
      throw new Error("This event is missing its ERC-721 collection. Remint the show.");
    }
    const { submitRequestWithdraw, readVaultGov } = await import("@/lib/chain.server");
    const hash = await submitRequestWithdraw(ev.marketplace_address as `0x${string}`);
    const gov = await readVaultGov(ev.vault_address as `0x${string}`, ev.engine_version ?? 3);
    const status = (ev.engine_version ?? 3) >= 4 ? "pending_vote" : gov.withdrawAllowed ? "passed" : "pending_vote";
    const deadline = gov.voteDeadline ? new Date(gov.voteDeadline * 1000).toISOString() : null;
    const row = (
      await sql<{ id: number }>`
        insert into withdraw_requests (
          event_id, organizer_wallet, amount_cents, status, yes_weight, sold_weight, deadline, tx_hash
        ) values (
          ${eventId}, ${wallet}, ${vault.locked_cents}, ${status},
          ${gov.yesWeight}, ${gov.soldWeight}, ${deadline}, ${hash}
        ) returning id
      `
    )[0];
    return { id: row.id, tx: hash, status };
  }
  const row = (
    await sql<{ id: number }>`
      insert into withdraw_requests (event_id, organizer_wallet, amount_cents, status)
      values (${eventId}, ${wallet}, ${vault.locked_cents}, 'pending')
      returning id
    `
  )[0];
  return { id: row.id };
}

export async function decideWithdraw(
  sql: Sql,
  adminWallet: string,
  requestId: number,
  approve: boolean,
) {
  const me = await getMe(sql, adminWallet);
  if (!me.isAdmin) throw new Error("Admin only.");
  const req = (
    await sql<{
      id: number;
      event_id: number;
      organizer_wallet: string;
      amount_cents: number;
      status: string;
    }>`select * from withdraw_requests where id = ${requestId}`
  )[0];
  if (!req) throw new Error("Request not found.");
  const ev = (await sql<EventRow>`select * from events where id = ${req.event_id}`)[0];
  if ((ev?.engine_version ?? 1) >= 3) {
    if (req.status !== "escalated") {
      throw new Error("Holder vote is still open. Admin can only decide after the organizer escalates.");
    }
    if (!ev?.vault_address) throw new Error("Event has no vault.");
    const { loadInfra } = await import("@/lib/infra.server");
    const { submitAdminDecide } = await import("@/lib/chain.server");
    const infra = await loadInfra(sql);
    const token = infra.devMode && infra.demoBank ? (infra.demoBank as `0x${string}`) : null;
    const txs = await submitAdminDecide({ vault: ev.vault_address as `0x${string}`, approve, token });
    if (!approve) {
      await sql`
        update withdraw_requests
        set status = 'rejected', decided_by = ${adminWallet}, decided_at = now(), tx_hash = ${txs.decideTx}
        where id = ${requestId}
      `;
      return { ok: true as const, status: "rejected" as const, tx: txs.decideTx };
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
      tx: txs.withdrawTx ?? txs.decideTx,
    });
    return { ok: true as const, status: "done" as const, tx: txs.withdrawTx ?? txs.decideTx };
  }
  if (req.status !== "pending") throw new Error("Already decided.");
  if (!approve) {
    await sql`
      update withdraw_requests
      set status = 'rejected', decided_by = ${adminWallet}, decided_at = now()
      where id = ${requestId}
    `;
    return { ok: true as const, status: "rejected" as const };
  }
  const hash = await executeWithdraw(sql, req.event_id);
  await sql`
    update withdraw_requests
    set status = 'done', decided_by = ${adminWallet}, decided_at = now(), tx_hash = ${hash}
    where id = ${requestId}
  `;
  return { ok: true as const, status: "done" as const, tx: hash };
}

async function executeWithdraw(sql: Sql, eventId: number) {
  const ev = (await sql<EventRow>`select * from events where id = ${eventId}`)[0];
  if (!ev) throw new Error("Event not found.");
  if (ev.cancelled_at) throw new Error("Cancelled events cannot withdraw.");
  if (ev.frozen_at) throw new Error("This event is frozen.");
  if (Date.now() < asTime(ev.ends_at)) throw new Error("Vault unlocks after the event ends.");
  const vault = (
    await sql<{ locked_cents: number; withdrawn: boolean }>`
      select locked_cents, withdrawn from event_vaults where event_id = ${eventId}
    `
  )[0];
  if (vault.withdrawn) throw new Error("Already withdrawn.");
  if (!ev.vault_address) throw new Error("This event has no vault contract.");
  const { loadInfra } = await import("@/lib/infra.server");
  const { submitWithdraw } = await import("@/lib/chain.server");
  const infra = await loadInfra(sql);
  const token = infra.devMode && infra.demoBank ? (infra.demoBank as `0x${string}`) : null;
  const hash = await submitWithdraw(ev.vault_address as `0x${string}`, token);
  await sql`update event_vaults set locked_cents = 0, withdrawn = true where event_id = ${eventId}`;
  await writeLedger(sql, {
    eventId,
    kind: "withdraw",
    from: "vault",
    to: ev.organizer_wallet,
    amount: vault.locked_cents,
    tx: hash,
  });
  return hash;
}

export async function freezeEvent(sql: Sql, adminWallet: string, eventId: number, on: boolean) {
  const me = await getMe(sql, adminWallet);
  if (!me.isAdmin) throw new Error("Admin only.");
  const ev = (await sql<EventRow>`select * from events where id = ${eventId}`)[0];
  if (!ev) throw new Error("Event not found.");
  if (!ev.marketplace_address || !ev.vault_address) throw new Error("Event has no contracts.");
  if ((ev.engine_version ?? 1) >= 3 && !ev.collection_address) {
    throw new Error("This event is missing its ERC-721 collection. Remint before freezing.");
  }
  try {
    const { submitFrozen } = await import("@/lib/chain.server");
    const txs = await submitFrozen({
      marketplace: ev.marketplace_address as `0x${string}`,
      vault: ev.vault_address as `0x${string}`,
      collection: ev.collection_address as `0x${string}` | null,
      on,
    });
    if (on) await sql`update events set frozen_at = now() where id = ${eventId}`;
    else await sql`update events set frozen_at = null where id = ${eventId}`;
    await writeLedger(sql, {
      eventId,
      kind: on ? "freeze" : "unfreeze",
      from: adminWallet,
      amount: 0,
      tx: txs.vaultTx,
    });
  } catch (err) {
    if ((ev.engine_version ?? 1) >= 3) throw err;
    if (on) await sql`update events set frozen_at = now() where id = ${eventId}`;
    else await sql`update events set frozen_at = null where id = ${eventId}`;
    await writeLedger(sql, {
      eventId,
      kind: on ? "freeze" : "unfreeze",
      from: adminWallet,
      amount: 0,
    });
  }
  return { frozen: on };
}

export async function listWithdrawRequests(sql: Sql, adminWallet: string) {
  const me = await getMe(sql, adminWallet);
  if (!me.isAdmin) throw new Error("Admin only.");
  const rows = await sql<{
    id: number;
    event_id: number;
    organizer_wallet: string;
    amount_cents: number;
    status: WithdrawRequest["status"];
    tx_hash: string | null;
    created_at: string;
    name: string;
    engine_version: number | null;
    yes_weight: number | null;
    sold_weight: number | null;
    deadline: string | null;
    materials_uri: string | null;
  }>`
    select r.id, r.event_id, r.organizer_wallet, r.amount_cents, r.status, r.tx_hash, r.created_at, e.name, e.engine_version,
      r.yes_weight, r.sold_weight, r.deadline, r.materials_uri
    from withdraw_requests r
    join events e on e.id = r.event_id
    order by r.id desc
    limit 40
  `;
  return rows.map((r) => ({
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
    engineVersion: r.engine_version ?? 1,
  }));
}

export async function adminSignerOps(sql: Sql, adminWallet: string): Promise<LedgerRow[]> {
  const me = await getMe(sql, adminWallet);
  if (!me.isAdmin) throw new Error("Admin only.");
  const rows = await sql<{
    id: number;
    kind: string;
    amount_cents: number;
    ref: string;
    created_at: string;
    event_name: string | null;
  }>`
    select l.id, l.kind, l.amount_cents, l.ref, l.created_at, e.name as event_name
    from ledger l
    left join events e on e.id = l.event_id
    where l.kind in ('mint','checkin','refund','withdraw','freeze','unfreeze','buy_primary','buy_resale','list')
    order by l.id desc
    limit 40
  `;
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    amountCents: r.amount_cents,
    ref: r.ref,
    createdAt: r.created_at,
    eventName: r.event_name,
    onChain: /^0x[0-9a-fA-F]{64}$/.test(r.ref),
  }));
}

export async function listPendingIndex(sql: Sql, adminWallet: string): Promise<PendingIndexRow[]> {
  const me = await getMe(sql, adminWallet);
  if (!me.isAdmin) throw new Error("Admin only.");
  await boot(sql);
  const rows = await sql<{
    id: number;
    kind: string;
    tx_hash: string;
    error: string | null;
    created_at: string;
  }>`
    select id, kind, tx_hash, error, created_at
    from pending_index
    where resolved_at is null
    order by created_at desc
    limit 50
  `;
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    txHash: r.tx_hash,
    error: r.error,
    createdAt: r.created_at,
  }));
}

export async function dismissPendingIndex(sql: Sql, adminWallet: string, id: number) {
  const me = await getMe(sql, adminWallet);
  if (!me.isAdmin) throw new Error("Admin only.");
  const row = (await sql<{ id: number }>`select id from pending_index where id = ${id}`)[0];
  if (!row) throw new Error("Pending row not found.");
  await sql`update pending_index set resolved_at = now() where id = ${id}`;
  return { ok: true as const };
}

export async function replayPendingIndex(sql: Sql, adminWallet: string, id: number) {
  const me = await getMe(sql, adminWallet);
  if (!me.isAdmin) throw new Error("Admin only.");
  const row = (
    await sql<{
      id: number;
      kind: string;
      tx_hash: string;
      payload: unknown;
      resolved_at: string | null;
    }>`select id, kind, tx_hash, payload, resolved_at from pending_index where id = ${id}`
  )[0];
  if (!row) throw new Error("Pending row not found.");
  if (row.resolved_at) return { ok: true as const, already: true };
  const payload = parsePayload(row.payload);
  const txHash = row.tx_hash as `0x${string}`;
  try {
    if (row.kind === "buy") {
      await confirmBuy(
        sql,
        String(payload.wallet ?? ""),
        Number(payload.tierId),
        txHash,
        Number(payload.chainId),
      );
    } else if (row.kind === "list") {
      await listResale(
        sql,
        String(payload.wallet ?? ""),
        Number(payload.ticketId),
        Number(payload.priceCents),
        txHash,
      );
    } else if (row.kind === "delist") {
      await delistTicket(sql, String(payload.wallet ?? ""), Number(payload.ticketId), txHash);
    } else if (row.kind === "checkin") {
      const ticketId = Number(payload.ticketId);
      const chainId = Number(payload.chainId);
      const marketplace = String(payload.marketplace ?? "") as `0x${string}`;
      const { verifyCheckIn } = await import("@/lib/chain.server");
      await verifyCheckIn({ txHash, marketplace, ticketId: chainId });
      const ticket = (
        await sql<{ status: string }>`select status from tickets where id = ${ticketId}`
      )[0];
      if (ticket?.status === "used") {
        await resolvePending(sql, txHash);
      } else {
        await applyCheckInIndex(sql, {
          ticketId,
          eventId: Number(payload.eventId),
          owner: String(payload.owner ?? ""),
          tokenId: String(payload.tokenId ?? ""),
          serial: Number(payload.serial ?? 0),
          eventName: String(payload.eventName ?? ""),
          txHash,
        });
      }
    } else if (row.kind === "vote") {
      await confirmVote(sql, String(payload.wallet ?? ""), Number(payload.ticketId), txHash);
    } else {
      throw new Error(`Unknown pending kind: ${row.kind}`);
    }
    await resolvePending(sql, txHash);
    return { ok: true as const };
  } catch (err) {
    const message = err instanceof Error ? err.message : "replay failed";
    await sql`update pending_index set error = ${message} where id = ${id}`;
    throw err;
  }
}

export async function confirmVote(sql: Sql, wallet: string, ticketId: number, txHash: string) {
  await boot(sql);
  const voter = wallet.toLowerCase();
  const ticket = (
    await sql<{
      id: number;
      event_id: number;
      owner_wallet: string;
      status: string;
      chain_id: number | null;
    }>`select id, event_id, owner_wallet, status, chain_id from tickets where id = ${ticketId}`
  )[0];
  if (!ticket || ticket.owner_wallet.toLowerCase() !== voter) throw new Error("You do not hold this ticket.");
  if (ticket.status !== "owned" && ticket.status !== "listed" && ticket.status !== "used") {
    throw new Error("Only sold tickets can vote.");
  }
  if (!ticket.chain_id) throw new Error("Ticket is not on-chain.");
  const ev = (await sql<EventRow>`select * from events where id = ${ticket.event_id}`)[0];
  if (!ev) throw new Error("Event not found.");
  if ((ev.engine_version ?? 1) < 3) throw new Error("This event uses admin-only payout.");
  if (!ev.marketplace_address || !ev.collection_address || !ev.vault_address) {
    throw new Error("This event is missing its ERC-721 collection. Remint the show.");
  }
  const req = (
    await sql<{ id: number; status: string }>`
      select id, status from withdraw_requests
      where event_id = ${ticket.event_id} and status in ('pending_vote','passed')
      order by id desc limit 1
    `
  )[0];
  if (!req) throw new Error("No open holder vote for this event.");
  const existing = (
    await sql<{ id: number }>`
      select id from withdraw_votes where request_id = ${req.id} and chain_id = ${ticket.chain_id}
    `
  )[0];
  if (!existing) {
    const { verifyUserVote } = await import("@/lib/chain.server");
    await verifyUserVote({
      txHash: txHash as `0x${string}`,
      voter: voter as `0x${string}`,
      marketplace: ev.marketplace_address as `0x${string}`,
      ticketId: ticket.chain_id,
    });
  }
  try {
    if (!existing) {
      await sql`
        insert into withdraw_votes (request_id, ticket_id, chain_id, voter, tx_hash)
        values (${req.id}, ${ticket.id}, ${ticket.chain_id}, ${voter}, ${txHash})
        on conflict (request_id, chain_id) do nothing
      `;
    }
    const { readVaultGov } = await import("@/lib/chain.server");
    const gov = await readVaultGov(ev.vault_address as `0x${string}`, ev.engine_version ?? 3);
    const v4 = (ev.engine_version ?? 3) >= 4;
    const deadlinePassed = Date.now() >= gov.voteDeadline * 1000;
    const status = gov.escalated ? "escalated" : v4
      ? deadlinePassed && objectionWindowPasses(gov.objectionWeight, gov.soldWeight) ? "passed" : "pending_vote"
      : gov.withdrawAllowed ? "passed" : "pending_vote";
    await sql`
      update withdraw_requests
      set yes_weight = ${v4 ? gov.objectionWeight : gov.yesWeight}, sold_weight = ${gov.soldWeight}, status = ${status}
      where id = ${req.id}
    `;
    await resolvePending(sql, txHash);
    return {
      ok: true as const,
      status,
      yesWeight: v4 ? gov.objectionWeight : gov.yesWeight,
      soldWeight: gov.soldWeight,
      already: Boolean(existing),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "index failed";
    if (!existing) {
      await markPending(
        sql,
        "vote",
        txHash,
        { wallet: voter, ticketId: ticket.id, chainId: ticket.chain_id, eventId: ticket.event_id },
        message,
      );
    }
    throw new Error("Vote confirmed on-chain. Index lagged — retry from Admin → Chain index.");
  }
}

export async function escalateWithdraw(sql: Sql, wallet: string, eventId: number, materialsUri: string) {
  const uri = materialsUri.trim();
  if (!uri) throw new Error("Upload payout materials (Pinata URI) before escalating.");
  const ev = (await sql<EventRow>`select * from events where id = ${eventId}`)[0];
  if (!ev) throw new Error("Event not found.");
  if (ev.organizer_wallet !== wallet.toLowerCase() && ev.organizer_wallet !== wallet) {
    throw new Error("Not your event.");
  }
  if ((ev.engine_version ?? 1) < 3) throw new Error("Legacy events are approved by admin, not escalated.");
  if (!ev.marketplace_address || !ev.collection_address || !ev.vault_address) {
    throw new Error("This event is missing its ERC-721 collection. Remint the show.");
  }
  if (ev.frozen_at) throw new Error("This event is frozen.");
  const req = (
    await sql<{ id: number; status: string }>`
      select id, status from withdraw_requests
      where event_id = ${eventId} and status in ('pending_vote','escalated')
      order by id desc limit 1
    `
  )[0];
  if (!req) throw new Error("No open vote to escalate.");
  const { readVaultGov, submitEscalate } = await import("@/lib/chain.server");
  const version = ev.engine_version ?? 1;
  const gov = await readVaultGov(ev.vault_address as `0x${string}`, version);
  if (version >= 4) {
    if (Date.now() < gov.voteDeadline * 1000) throw new Error("The 7-day vote is still open.");
    if (!objectionRequiresAdminReview(gov.objectionWeight, gov.soldWeight)) throw new Error("Fewer than one third opposed. Execute the withdraw instead.");
  } else if (gov.withdrawAllowed) throw new Error("Vote already reached 2/3. Execute the withdraw instead.");
  let hash: string | null = null;
  if (!gov.escalated) {
    hash = await submitEscalate({ marketplace: ev.marketplace_address as `0x${string}`, uri });
  }
  await sql`
    update withdraw_requests
    set status = 'escalated', materials_uri = ${uri}, tx_hash = coalesce(${hash}, tx_hash)
    where id = ${req.id}
  `;
  return { ok: true as const, status: "escalated" as const, tx: hash };
}

export async function executeGovWithdraw(sql: Sql, wallet: string, eventId: number) {
  const ev = (await sql<EventRow>`select * from events where id = ${eventId}`)[0];
  if (!ev) throw new Error("Event not found.");
  if (ev.organizer_wallet !== wallet.toLowerCase() && ev.organizer_wallet !== wallet) {
    throw new Error("Not your event.");
  }
  if (ev.cancelled_at) throw new Error("Cancelled events cannot withdraw.");
  if (ev.frozen_at) throw new Error("This event is frozen.");
  if (Date.now() < asTime(ev.ends_at)) throw new Error("Vault unlocks after the event ends.");
  if ((ev.engine_version ?? 1) < 3) throw new Error("Legacy payouts are executed by admin.");
  if (!ev.marketplace_address || !ev.collection_address || !ev.vault_address) {
    throw new Error("This event is missing its ERC-721 collection. Remint the show.");
  }
  const vaultRow = (
    await sql<{ locked_cents: number; withdrawn: boolean }>`
      select locked_cents, withdrawn from event_vaults where event_id = ${eventId}
    `
  )[0];
  if (vaultRow?.withdrawn) throw new Error("Already withdrawn.");
  const req = (
    await sql<{ id: number; status: string }>`
      select id, status from withdraw_requests
      where event_id = ${eventId} and status in ('passed','pending_vote')
      order by id desc limit 1
    `
  )[0];
  if (!req) throw new Error("Open a holder vote before withdrawing.");
  const { loadInfra } = await import("@/lib/infra.server");
  const { readVaultGov, submitExecuteWithdraw } = await import("@/lib/chain.server");
  const infra = await loadInfra(sql);
  const token = infra.devMode && infra.demoBank ? (infra.demoBank as `0x${string}`) : null;
  const gov = await readVaultGov(ev.vault_address as `0x${string}`, ev.engine_version ?? 3);
  const v4 = (ev.engine_version ?? 3) >= 4;
  if (!gov.withdrawn && (v4
    ? Date.now() < gov.voteDeadline * 1000 || !objectionWindowPasses(gov.objectionWeight, gov.soldWeight)
    : !gov.withdrawAllowed)) {
    throw new Error(v4 ? "The vote must end with fewer than one third opposing." : "Holder vote has not reached 2/3 yet.");
  }
  let hash: string | null = null;
  if (!gov.withdrawn) {
    hash = await submitExecuteWithdraw({
      marketplace: ev.marketplace_address as `0x${string}`,
      token,
    });
  }
  await sql`update event_vaults set locked_cents = 0, withdrawn = true where event_id = ${eventId}`;
  await sql`
    update withdraw_requests
    set status = 'done', tx_hash = coalesce(${hash}, tx_hash), decided_at = now()
    where id = ${req.id}
  `;
  if (hash) {
    await writeLedger(sql, {
      eventId,
      kind: "withdraw",
      from: "vault",
      to: ev.organizer_wallet,
      amount: vaultRow?.locked_cents ?? 0,
      tx: hash,
    });
  }
  return { ok: true as const, status: "done" as const, tx: hash };
}

export async function withdrawVault(sql: Sql, wallet: string, eventId: number) {
  return requestWithdraw(sql, wallet, eventId);
}

export async function recentLedger(sql: Sql, wallet: string): Promise<LedgerRow[]> {
  const rows = await sql<{
    id: number;
    event_id: number | null;
    kind: string;
    amount_cents: number;
    ref: string;
    created_at: string;
    event_name: string | null;
  }>`
    select l.id, l.event_id, l.kind, l.amount_cents, l.ref, l.created_at, e.name as event_name
    from ledger l
    left join events e on e.id = l.event_id
    where l.from_wallet = ${wallet} or l.to_wallet = ${wallet} or e.organizer_wallet = ${wallet}
    order by l.id desc
    limit 20
  `;
  return rows.map((r) => ({
    id: r.id,
    eventId: r.event_id,
    kind: r.kind,
    amountCents: r.amount_cents,
    ref: r.ref,
    createdAt: r.created_at,
    eventName: r.event_name,
    onChain: /^0x[0-9a-fA-F]{64}$/.test(r.ref),
  }));
}

export async function organizerEventLedger(sql: Sql, wallet: string, eventId: number): Promise<LedgerRow[]> {
  const event = (await sql<{ id: number; organizer_wallet: string }>`select id, organizer_wallet from events where id = ${eventId}`)[0];
  if (!event || event.organizer_wallet.toLowerCase() !== wallet.toLowerCase()) throw new Error("Not your event.");
  const rows = await sql<{ id: number; event_id: number; kind: string; amount_cents: number; ref: string; created_at: string }>`
    select id, event_id, kind, amount_cents, ref, created_at from ledger where event_id = ${eventId} order by id desc limit 100
  `;
  return rows.map((r) => ({
    id: r.id, eventId: r.event_id, kind: r.kind, amountCents: r.amount_cents, ref: r.ref,
    createdAt: r.created_at, eventName: null, onChain: /^0x[0-9a-fA-F]{64}$/.test(r.ref),
  }));
}

export async function royaltyBps(sql: Sql) {
  await boot(sql);
  const row = (await sql<{ royalty_bps: number }>`select royalty_bps from platform_settings where id = 1`)[0];
  return row.royalty_bps;
}

export async function setRoyalty(sql: Sql, wallet: string, bps: number) {
  const me = await getMe(sql, wallet);
  if (!me.isAdmin) throw new Error("Admin only.");
  if (bps < 0 || bps > 2000) throw new Error("Royalty must be 0–20%.");
  await sql`update platform_settings set royalty_bps = ${bps}, updated_at = now() where id = 1`;
}

export async function addOrganizer(sql: Sql, adminWallet: string, walletRaw: string, name: string) {
  const me = await getMe(sql, adminWallet);
  if (!me.isAdmin) throw new Error("Admin only.");
  const wallet = normalizeWallet(walletRaw);
  const label = name.trim();
  if (!label) throw new Error("Organizer name required.");
  await sql`
    insert into organizers (wallet, name, status)
    values (${wallet}, ${label}, 'approved')
    on conflict (wallet) do update set name = ${label}, status = 'approved'
  `;
}

export async function setOrganizerStatus(
  sql: Sql,
  adminWallet: string,
  target: string,
  status: "approved" | "revoked" | "pending",
) {
  const me = await getMe(sql, adminWallet);
  if (!me.isAdmin) throw new Error("Admin only.");
  const wallet = normalizeWallet(target);
  await sql`update organizers set status = ${status} where wallet = ${wallet}`;
}

export async function listOrganizers(sql: Sql, adminWallet: string): Promise<OrganizerRow[]> {
  const me = await getMe(sql, adminWallet);
  if (!me.isAdmin) throw new Error("Admin only.");
  const rows = await sql<{
    wallet: string;
    name: string;
    status: "pending" | "approved" | "revoked";
    created_at: string;
    event_count: number;
  }>`
    select o.wallet, o.name, o.status, o.created_at,
      (select count(*)::int from events e where e.organizer_wallet = o.wallet) as event_count
    from organizers o
    order by o.created_at desc
  `;
  return rows.map((r) => ({
    wallet: r.wallet,
    name: r.name,
    status: r.status,
    eventCount: r.event_count,
    createdAt: r.created_at,
  }));
}

export async function adminCount(sql: Sql) {
  await boot(sql);
  return (await sql<{ n: number }>`select count(*)::int as n from admins`)[0].n;
}

export async function listAdmins(sql: Sql) {
  await boot(sql);
  const rows = await sql<{ wallet: string }>`select wallet from admins order by created_at asc`;
  return rows.map((r) => r.wallet);
}

function secretMask(value: string) {
  const v = value.trim();
  if (!v) return null;
  return `••••${v.slice(-4)}`;
}

export async function getInfraStatus(sql: Sql, wallet: string): Promise<InfraStatus> {
  await boot(sql);
  const me = await getMe(sql, wallet);
  if (!me.isAdmin) throw new Error("Admin only.");
  const { loadInfra, tableCounts, listContracts } = await import("@/lib/infra.server");
  const { readPlatform } = await import("@/lib/platform");
  const plat = readPlatform();
  const { describeDatabaseUrl, envDatabaseUrlSet, getDbSource, resolveDatabaseUrl } = await import("@/lib/db");
  const cfg = await loadInfra(sql);
  const url = resolveDatabaseUrl();
  const desc = describeDatabaseUrl(url);
  let tables: { name: string; n: number }[] = [];
  let dbError: string | null = null;
  let connected = false;
  try {
    tables = await tableCounts(sql);
    connected = true;
  } catch (err) {
    dbError = redactSecrets(err instanceof Error ? err.message : "Database probe failed");
  }

  let chain: InfraStatus["chain"] = {
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
    pinataMask: secretMask(cfg.pinataJwt),
  };
  try {
    const { lastAnchor, lastChainError, pingChain } = await import("@/lib/chain.server");
    const ping = await pingChain(cfg.rpcUrl, cfg.chainId);
    chain = {
      ...chain,
      connected: true,
      blockNumber: ping.blockNumber,
      chainId: ping.chainId,
      operatorAddress: ping.operatorAddress,
      operatorBalance: ping.operatorBalance,
      lastError: redactSecrets(lastChainError() ?? ""),
      lastAnchor: lastAnchor(),
    };
  } catch (err) {
    const { lastAnchor, lastChainError } = await import("@/lib/chain.server");
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
      error: dbError,
    },
    chain,
    contracts: (await listContracts(sql)).map((c) => ({
      id: c.id,
      kind: c.kind,
      eventId: c.event_id,
      address: c.address,
      txHash: c.tx_hash,
      createdAt: c.created_at,
    })),
    royaltyBps: await royaltyBps(sql),
    adminCount: await adminCount(sql),
    adminWallet: plat.adminWallet,
    setup: {
      database: connected,
      pinata: Boolean(cfg.pinataJwt),
      signer: Boolean(cfg.operatorPk),
      complete: connected && Boolean(cfg.pinataJwt) && Boolean(cfg.operatorPk),
    },
    kyc: await kycInfraSummary(sql),
  };
}

export async function applyInfra(
  sql: Sql,
  wallet: string,
  patch: {
    databaseUrl?: string;
    rpcUrl?: string;
    chainId?: number;
    explorerUrl?: string;
    operatorPk?: string;
    pinataJwt?: string;
    clearOperatorPk?: boolean;
    clearDatabaseUrl?: boolean;
    clearPinata?: boolean;
    devMode?: boolean;
    databaseUrlKyc?: string;
    clearDatabaseUrlKyc?: boolean;
    kycAutoApprove?: boolean;
  },
) {
  const me = await getMe(sql, wallet);
  if (!me.isAdmin) throw new Error("Admin only.");
  const { saveInfra } = await import("@/lib/infra.server");
  await saveInfra(sql, patch);
  invalidatePublicConfig();
  return getInfraStatus(await (await import("@/lib/db")).getSql(), wallet);
}

export async function probeDatabaseUrl(wallet: string, url: string) {
  const { getSql } = await import("@/lib/db");
  const me = await getMe(await getSql(), wallet);
  if (!me.isAdmin) throw new Error("Admin only.");
  const { probePostgres } = await import("@/lib/db");
  try {
    return await probePostgres(url);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Database connection failed.";
    throw new Error(redactSecrets(msg).slice(0, 180) || "Database connection failed.");
  }
}

const PUB_TTL_MS = 5 * 60 * 1000;
let pubCache: { gen: number; at: number; value: import("@/lib/types").PublicConfig } | null = null;

export function invalidatePublicConfig() {
  pubCache = null;
}

export async function publicConfig(): Promise<import("@/lib/types").PublicConfig> {
  const gen = globalRefBoot().__ctBootGen__ ?? 0;
  if (pubCache && pubCache.gen === gen && Date.now() - pubCache.at < PUB_TTL_MS) return pubCache.value;
  const { getSql } = await import("@/lib/db");
  const { loadInfra } = await import("@/lib/infra.server");
  const { readPlatform } = await import("@/lib/platform");
  const sql = await getSql();
  await boot(sql);
  const plat = readPlatform();
  const infra = await loadInfra(sql);
  const value: import("@/lib/types").PublicConfig = {
    chainName: plat.chainName,
    nativeSymbol: plat.nativeSymbol,
    chainId: plat.chainId,
    rpcUrl: plat.rpcUrl,
    explorerUrl: plat.explorerUrl,
    adminConfigured: Boolean(plat.adminWallet),
    devMode: Boolean(infra.devMode),
    demoBank: infra.demoBank || null,
    pinataReady: Boolean(infra.pinataJwt),
    setupComplete: Boolean(infra.pinataJwt && infra.operatorPk),
  };
  pubCache = { gen, at: Date.now(), value };
  return value;
}

export async function enableDevMode(sql: Sql, wallet: string, on: boolean) {
  const me = await getMe(sql, wallet);
  if (!me.isAdmin) throw new Error("Admin only.");
  const { saveInfra, recordContract } = await import("@/lib/infra.server");

  if (on) {
    const { deployDemoBank } = await import("@/lib/chain.server");
    const deployed = await deployDemoBank(wallet as `0x${string}`);
    await recordContract(sql, {
      kind: "demo_bank",
      address: deployed.address,
      tx: deployed.tx,
    });
    await saveInfra(sql, { devMode: true, demoBank: deployed.address });
  } else {
    await saveInfra(sql, { devMode: false, demoBank: "" });
  }
  invalidatePublicConfig();

  return getInfraStatus(await (await import("@/lib/db")).getSql(), wallet);
}

export async function setPlatformAdmin(sql: Sql, actor: string, address: string) {
  await boot(sql);
  const current = configuredAdmin();
  if (current) {
    const me = await getMe(sql, actor);
    if (!me.isAdmin) throw new Error("Admin only.");
  }
  const { writePlatform } = await import("@/lib/platform");
  const next = writePlatform({ adminWallet: address });
  invalidatePublicConfig();
  await sql`
    insert into admins (wallet) values (${next.adminWallet.toLowerCase()})
    on conflict (wallet) do nothing
  `;
  return next;
}

export async function savePlatformFile(
  sql: Sql,
  wallet: string,
  patch: {
    adminWallet?: string;
    chainName?: string;
    nativeSymbol?: string;
    rpcUrl?: string;
    chainId?: number;
    explorerUrl?: string;
    secretsPath?: string;
  },
) {
  const me = await getMe(sql, wallet);
  if (!me.isAdmin && configuredAdmin()) throw new Error("Admin only.");
  const { writePlatform } = await import("@/lib/platform");
  const next = writePlatform(patch);
  invalidatePublicConfig();
  if (next.adminWallet) {
    await sql`
      insert into admins (wallet) values (${next.adminWallet.toLowerCase()})
      on conflict (wallet) do nothing
    `;
  }
  return next;
}
