alter table kyc_public add column if not exists document_expires_at timestamptz;
alter table kyc_private add column if not exists document_expires_at timestamptz;
