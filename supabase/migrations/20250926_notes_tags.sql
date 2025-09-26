-- Add tags to notes and create indexes for search
alter table if exists public.notes
  add column if not exists tags text[] not null default '{}'::text[];

create index if not exists notes_tags_gin_idx on public.notes using gin (tags);

-- Optionally, if you need a combined simple search later, you can create a generated tsvector
-- alter table public.notes add column if not exists search_tsv tsvector generated always as (
--   setweight(to_tsvector('simple', coalesce(title,'')), 'A') ||
--   setweight(to_tsvector('simple', coalesce(content,'')), 'B') ||
--   setweight(to_tsvector('simple', array_to_string(tags,' ')), 'C')
-- ) stored;
-- create index if not exists notes_search_tsv_idx on public.notes using gin (search_tsv);
