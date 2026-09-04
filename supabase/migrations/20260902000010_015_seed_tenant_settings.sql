-- 015: guarantee every tenant has a tenant_settings row.
-- Fixes: "new row violates row-level security policy for table tenant_settings"
--   * migration 012 seeded tenant_settings exactly once (for the tenants that
--     existed at that time)
--   * tenant creation afterwards (provision_tenant RPC / app flows) never adds
--     a settings row
--   * so an owner's very first Settings save becomes an INSERT, which RLS
--     rejects (ts_owner_write is FOR UPDATE-only; ts_platform_write is admins-only).

-- 1) Backfill a settings row for every tenant that is missing one.
insert into public.tenant_settings (tenant_id)
select t.id
from public.tenants t
left join public.tenant_settings ts on ts.tenant_id = t.id
where ts.tenant_id is null;

-- 2) Auto-seed a settings row for every newly created tenant.
create or replace function public.seed_tenant_settings()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.tenant_settings (tenant_id)
  values (new.id)
  on conflict (tenant_id) do nothing;
  return new;
end;
$$;

drop trigger if exists tenant_settings_seed on public.tenants;
create trigger tenant_settings_seed
  after insert on public.tenants
  for each row
  execute function public.seed_tenant_settings();