create table if not exists mint_jobs (
  id text primary key,
  organizer_wallet text not null,
  current_step integer not null default 0,
  status text not null default 'pending',
  error text,
  event_id integer,
  updated_at timestamptz not null default now()
);
create index if not exists mint_jobs_wallet_updated_idx on mint_jobs (organizer_wallet, updated_at desc);
