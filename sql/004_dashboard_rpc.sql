-- ============================================================
-- IMS — Dashboard performance (one RPC for ALL visible stores)
-- Run AFTER 001/002/003. Safe to re-run.
-- ============================================================
-- security invoker: RLS on sales_transactions/stores applies, so a store
-- manager only ever aggregates their own store; admins get all stores.
create or replace function public.store_sales_summary_all(p_days int default 30)
returns table (store_id uuid, store_name text, day date, revenue numeric, cogs numeric, profit numeric)
language sql security invoker stable as $$
  select s.store_id,
         st.name as store_name,
         s.day,
         s.revenue,
         s.cogs,
         s.profit
  from (
    select t.store_id,
           date_trunc('day', t.created_at)::date as day,
           sum(t.total) as revenue,
           sum(t.total_cogs) as cogs,
           sum(t.total - t.total_cogs) as profit
    from public.sales_transactions t
    where t.created_at >= now() - make_interval(days => p_days)
    group by 1, 2
  ) s
  join public.stores st on st.id = s.store_id
  order by s.day asc;
$$;