-- Public KYC index. Identity plaintext lives only in the private store.

create table if not exists kyc_public (
  wallet text primary key,
  kyc_ref text not null unique,
  status text not null,
  submitted_at timestamptz not null default now(),
  verified_at timestamptz,
  reviewed_by text,
  reject_reason text
);

create index if not exists kyc_public_status_idx on kyc_public (status, submitted_at desc);

create table if not exists kyc_audit (
  id serial primary key,
  admin_wallet text not null,
  kyc_ref text not null,
  wallet text not null,
  action text not null,
  created_at timestamptz not null default now()
);

create index if not exists kyc_audit_ref_idx on kyc_audit (kyc_ref, created_at desc);

-- Used when DATABASE_URL_KYC is unset (ciphertext still never sits on kyc_public).
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
);

create index if not exists kyc_private_wallet_idx on kyc_private (wallet);

alter table kyc add column if not exists migrated_ref text;
