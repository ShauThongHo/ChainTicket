-- ChainTicket vault ledger (Web2.5). Wallet address is identity.

create table if not exists platform_settings (
  id integer primary key,
  royalty_bps integer not null default 1000,
  updated_at timestamptz not null default now()
);
insert into platform_settings (id, royalty_bps) values (1, 1000)
  on conflict (id) do nothing;

create table if not exists admins (
  wallet text primary key,
  created_at timestamptz not null default now()
);

create table if not exists organizers (
  wallet text primary key,
  name text not null,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

create table if not exists kyc (
  wallet text primary key,
  full_name text not null,
  id_number text not null,
  verified_at timestamptz not null default now()
);

create table if not exists accounts (
  wallet text primary key,
  spendable_cents integer not null default 0,
  faucet_claimed boolean not null default false
);

create table if not exists events (
  id serial primary key,
  organizer_wallet text not null,
  name text not null,
  description text not null default '',
  venue text not null default '',
  category text not null default 'Concert',
  poster_url text not null default '',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  cancelled_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists ticket_tiers (
  id serial primary key,
  event_id integer not null references events (id) on delete cascade,
  name text not null,
  face_cents integer not null,
  supply integer not null,
  contract_address text not null
);

create table if not exists tickets (
  id serial primary key,
  event_id integer not null references events (id) on delete cascade,
  tier_id integer not null references ticket_tiers (id) on delete cascade,
  serial integer not null,
  token_id text not null unique,
  owner_wallet text not null,
  status text not null,
  face_cents integer not null,
  created_at timestamptz not null default now()
);

create table if not exists listings (
  id serial primary key,
  ticket_id integer not null references tickets (id) on delete cascade,
  event_id integer not null,
  tier_id integer not null,
  seller_wallet text not null,
  price_cents integer not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists event_vaults (
  event_id integer primary key references events (id) on delete cascade,
  locked_cents integer not null default 0,
  withdrawn boolean not null default false
);

create table if not exists ledger (
  id serial primary key,
  event_id integer,
  ticket_id integer,
  kind text not null,
  from_wallet text,
  to_wallet text,
  amount_cents integer not null default 0,
  ref text not null,
  created_at timestamptz not null default now()
);

create table if not exists login_nonces (
  nonce text primary key,
  created_at timestamptz not null default now()
);

create index if not exists tickets_owner_idx on tickets (owner_wallet);
create index if not exists tickets_event_idx on tickets (event_id);
create index if not exists listings_tier_active_idx on listings (tier_id, active, price_cents);
create index if not exists listings_ticket_idx on listings (ticket_id);
create index if not exists events_starts_idx on events (starts_at);
