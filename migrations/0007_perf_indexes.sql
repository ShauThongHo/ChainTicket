create index if not exists listings_event_active_idx on listings (event_id) where active = true;
create index if not exists tickets_event_status_idx on tickets (event_id, status);
create index if not exists events_organizer_idx on events (organizer_wallet);
