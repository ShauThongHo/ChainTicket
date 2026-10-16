-- Admin-managed infrastructure (RPC, signer, optional Neon URL pointer).
-- Secrets may also be mirrored in .data/infra.json so a DATABASE_URL override
-- survives process restart. Never expose these rows to the browser unmasked.

create table if not exists infra_settings (
  key text primary key,
  value text not null default '',
  updated_at timestamptz not null default now()
);

insert into infra_settings (key, value) values
  ('rpc_url', 'https://rpc.chiadochain.net'),
  ('chain_id', '10200'),
  ('explorer_url', 'https://gnosis-chiado.blockscout.com'),
  ('marketplace_address', ''),
  ('vault_address', ''),
  ('operator_pk', ''),
  ('database_url', '')
on conflict (key) do nothing;

create index if not exists ledger_kind_idx on ledger (kind, created_at desc);
