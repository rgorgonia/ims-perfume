-- ============================================================
-- IMS — Store types + per-store owner/manager split (RBAC)
-- Run AFTER 001–009. Safe to re-run.
-- ============================================================
-- store_type: what kind of outlet the store is.
-- profiles.store_role:
--   'owner'   → assigned user sees full store info INCL. revenue/profit
--   'manager' → manages inventory + sales only, never sees revenue
-- (system_admin always sees everything.)

alter table public.stores
  add column if not exists store_type text
  not null default 'physical'
  check (store_type in ('physical', 'online', 'kiosk', 'warehouse'));

alter table public.profiles
  add column if not exists store_role text
  not null default 'manager'
  check (store_role in ('manager', 'owner'));

-- Helper: is the caller an owner of their assigned store?
create or replace function public.is_store_owner()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role = 'store_manager'
      and store_role = 'owner'
      and is_active
      and store_id is not null
  );
$$;

-- Store owners may read capital-ledger entries tied to their own store
-- (business-wide entries, store_id is null, stay admin-only).
drop policy if exists ledger_owner_read on public.capital_ledger;
create policy ledger_owner_read on public.capital_ledger
  for select using (
    public.is_store_owner()
    and store_id in (select public.assigned_store_ids())
  );
