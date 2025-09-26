-- Analytics events table
create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null,
  event text not null,
  props jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Helpful indexes
create index if not exists analytics_events_event_created_at_idx
  on public.analytics_events (event, created_at desc);

-- Optional: if you want to join on auth.users later, keep it nullable for anon events
-- alter table public.analytics_events
--   add constraint analytics_events_user_fk foreign key (user_id) references auth.users (id) on delete set null;
