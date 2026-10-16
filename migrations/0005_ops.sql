alter table events add column if not exists frozen_at timestamptz;
alter table events add column if not exists engine_version integer;

create table if not exists withdraw_requests (
  id serial primary key,
  event_id integer not null references events(id) on delete cascade,
  organizer_wallet text not null,
  amount_cents integer not null default 0,
  status text not null default 'pending',
  decided_by text,
  decided_at timestamptz,
  tx_hash text,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists pending_index (
  id serial primary key,
  kind text not null,
  tx_hash text not null,
  payload jsonb not null default '{}',
  error text,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists pending_index_tx on pending_index (tx_hash);
