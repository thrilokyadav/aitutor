-- Function to return per-day event counts for recent N days
create or replace function public.analytics_daily_counts(p_days int default 14)
returns table(day date, event text, cnt bigint)
language sql
stable
as $$
  select
    date_trunc('day', created_at)::date as day,
    event,
    count(*)::bigint as cnt
  from public.analytics_events
  where created_at >= now() - (p_days || ' days')::interval
  group by 1,2
  order by 1 desc, 2 asc;
$$;
