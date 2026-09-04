-- Per-store configuration: tenant_settings gains a nullable store_id.
-- store_id IS NULL     -> tenant-wide defaults (existing behavior)
-- store_id = <store>   -> config shown/edited only when that store is active
alter table public.tenant_settings
  add column if not exists store_id uuid references public.stores(id) on delete cascade;

alter table public.tenant_settings drop constraint tenant_settings_pkey;
create unique index if not exists tenant_settings_tenant_store_key
  on public.tenant_settings (tenant_id, store_id) nulls not distinct;

-- Owners may now CREATE/UPDATE their own tenant's settings rows (tenant-wide
-- and per-store). The WITH CHECK pins every write to the owner's tenant.
drop policy if exists ts_owner_write on public.tenant_settings;
create policy ts_owner_write on public.tenant_settings for all
  using (is_tenant_owner())
  with check (tenant_id in (select current_tenant_ids()));
