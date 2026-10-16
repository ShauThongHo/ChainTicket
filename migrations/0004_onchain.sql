alter table events add column if not exists vault_address text;
alter table events add column if not exists marketplace_address text;
alter table events add column if not exists deploy_tx text;

alter table tickets add column if not exists chain_id integer;

create table if not exists deployed_contracts (
  id serial primary key,
  kind text not null,
  event_id integer,
  address text not null,
  tx_hash text not null default '',
  created_at timestamptz not null default now()
);

insert into infra_settings (key, value) values
  ('pinata_jwt', ''),
  ('demo_bank', ''),
  ('dev_mode', 'false')
on conflict (key) do nothing;
