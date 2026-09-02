-- ============================================================
-- 013: Atomic provisioning RPC, atomic product RPC, subscription tiers
-- Phase 1 (provisioning) + Phase 4 (catalog) hardening.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Subscription tier + limits on tenants (Phase 1 inputs).
--    NULL = unlimited. Enforced by triggers, not the UI.
-- ------------------------------------------------------------
alter table public.tenants
  add column if not exists subscription_tier text not null default 'starter'
    check (subscription_tier in ('starter', 'growth', 'enterprise')),
  add column if not exists max_stores int check (max_stores is null or max_stores > 0),
  add column if not exists max_users int check (max_users is null or max_users > 0);

-- Store-count limit: fires on insert into stores.
create or replace function public.enforce_tenant_store_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_max int;
begin
  select max_stores into v_max from public.tenants where id = new.tenant_id;
  if v_max is not null then
    if (select count(*) from public.stores where tenant_id = new.tenant_id) >= v_max then
      raise exception 'Tenant limit reached: subscription allows at most % stores', v_max;
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists trg_enforce_store_limit on public.stores;
create trigger trg_enforce_store_limit
before insert on public.stores
for each row execute function public.enforce_tenant_store_limit();

-- User-count limit: fires on insert into profiles (per-tenant members).
create or replace function public.enforce_tenant_user_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_max int;
begin
  if new.tenant_id is null then return new; end if;
  select max_users into v_max from public.tenants where id = new.tenant_id;
  if v_max is not null then
    if (select count(*) from public.profiles where tenant_id = new.tenant_id) >= v_max then
      raise exception 'Tenant limit reached: subscription allows at most % users', v_max;
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists trg_enforce_user_limit on public.profiles;
create trigger trg_enforce_user_limit
before insert on public.profiles
for each row execute function public.enforce_tenant_user_limit();

-- ------------------------------------------------------------
-- 2. Atomic provisioning (Phase 1). The auth user is created by the
--    app (admin API, cannot run in SQL); everything AFTER that is one
--    transaction here — tenant + owner profile + optional first store.
--    Any failure rolls back completely; the app then deletes the auth
--    user, leaving zero partial state.
--    Platform admins only (SECURITY DEFINER + explicit guard).
-- ------------------------------------------------------------
create or replace function public.provision_tenant(
  p_owner_id uuid,
  p_business_name text,
  p_slug text,
  p_owner_name text,
  p_first_store text default null,
  p_tier text default 'starter',
  p_max_stores int default null,
  p_max_users int default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_tenant uuid;
begin
  if not public.is_platform_admin() then
    raise exception 'only platform admins can provision tenants';
  end if;
  if p_owner_id is null or p_business_name is null or p_slug is null or p_owner_name is null then
    raise exception 'owner id, business name, slug and owner name are required';
  end if;
  if not (p_tier in ('starter', 'growth', 'enterprise')) then
    raise exception 'invalid subscription tier';
  end if;

  -- Tenant
  insert into public.tenants (name, slug, is_active, subscription_tier, max_stores, max_users)
  values (p_business_name, p_slug, true, p_tier, p_max_stores, p_max_users)
  returning id into v_tenant;

  -- Owner profile (profiles has no email column — identity lives in auth.users)
  insert into public.profiles (id, full_name, role, tenant_id, store_id, is_active)
  values (p_owner_id, p_owner_name, 'tenant_owner', v_tenant, null, true);

  -- Optional first store — same transaction, so a store-limit violation
  -- (trigger) rolls the whole tenant back with a clear error.
  if p_first_store is not null and length(trim(p_first_store)) > 0 then
    insert into public.stores (name, tenant_id, store_type)
    values (trim(p_first_store), v_tenant, 'physical');
  end if;

  return v_tenant;
end;
$$;
revoke all on function public.provision_tenant(uuid, text, text, text, text, text, int, int) from public, anon;
grant execute on function public.provision_tenant(uuid, text, text, text, text, text, int, int) to authenticated;

-- ------------------------------------------------------------
-- 3. Atomic product + first variant (Phase 4 business rule).
--    A product WITHOUT variants is invisible in Inventory and Sales,
--    so the pair must be created in one transaction. The variant SKU
--    unique-violation rolls back the product insert automatically.
--    cost_price is only stored when the caller is privileged; the
--    column grants from 012 already hide it from everyone else.
-- ------------------------------------------------------------
create or replace function public.create_product_with_variant(
  p_name text,
  p_brand text,
  p_category text,
  p_attributes jsonb,
  p_sku text,
  p_size_ml int,
  p_retail_price numeric,
  p_cost_price numeric default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_tenant uuid;
  v_product uuid;
  v_privileged boolean;
begin
  select tenant_id, (public.is_tenant_owner() or public.is_platform_admin())
    into v_tenant, v_privileged
  from public.profiles where id = auth.uid();
  if v_tenant is null then raise exception 'no tenant profile for caller'; end if;

  if p_name is null or p_sku is null or p_size_ml is null or p_size_ml < 1 then
    raise exception 'product name, sku and positive size are required';
  end if;

  insert into public.products (name, brand, category, tenant_id, retail_price, cost_price)
  values (
    p_name, p_brand, p_category, v_tenant, p_retail_price,
    case when v_privileged then coalesce(p_cost_price, 0) else 0 end
  )
  returning id into v_product;

  insert into public.product_variants (
    product_id, tenant_id, sku, size_ml, retail_price, cost_price, attributes
  ) values (
    v_product, v_tenant, p_sku, p_size_ml, p_retail_price,
    case when v_privileged then coalesce(p_cost_price, 0) else 0 end,
    coalesce(p_attributes, '{}'::jsonb)
  );

  return jsonb_build_object('product_id', v_product);
end;
$$;
revoke all on function public.create_product_with_variant(text, text, text, jsonb, text, int, numeric, numeric) from public, anon;
grant execute on function public.create_product_with_variant(text, text, text, jsonb, text, int, numeric, numeric) to authenticated;

