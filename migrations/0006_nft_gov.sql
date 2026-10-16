alter table events add column if not exists collection_address text;
alter table tickets add column if not exists token_uri text;

alter table withdraw_requests add column if not exists yes_weight integer not null default 0;
alter table withdraw_requests add column if not exists sold_weight integer not null default 0;
alter table withdraw_requests add column if not exists deadline timestamptz;
alter table withdraw_requests add column if not exists materials_uri text;
alter table withdraw_requests add column if not exists proposal_id integer;

create table if not exists withdraw_votes (
  id serial primary key,
  request_id integer not null references withdraw_requests (id) on delete cascade,
  ticket_id integer not null,
  chain_id integer not null,
  voter text not null,
  tx_hash text not null default '',
  created_at timestamptz not null default now()
);

create unique index if not exists withdraw_votes_req_token on withdraw_votes (request_id, chain_id);
