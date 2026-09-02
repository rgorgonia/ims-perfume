-- ============================================================
-- IMS — 012: Multi-Tenant SaaS Conversion
-- Run AFTER 001–011. Idempotent (safe to re-run).
--
-- Converts the single-org multi-store schema into a bulletproof
-- multi-tenant B2B "rental" platform:
--   * public.tenants + tenant_id on every data table (hard boundary)
--   * 3-tier RBAC: platform_admin / tenant_owner / store_manager
--   * every tenant-owned table RLS-scoped to the caller's tenant
--   * per-tenant settings + per-tenant catalog/taxonomy ownership
-- ============================================================

-- ------------------------------------------------------------
-- 1. TENANTS + role enum swap
-- ------------------------------------------------------------

create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Default tenant absorbs any pre-existing (single-org) rows.
insert into public.tenants (name, slug)
values ('Default Tenant', 'default')
on conflict (slug) do nothing;

do $$
begin
  -- New 3-tier role model as a fresh type (old values are renamed/replaced).
  if not exists (select 1 from pg_type where typname = 'user_role_v2') then
    create type public.user_role_v2 as enum ('platform_admin', 'tenant_owner', 'store_manager');
  end if;
end $$;

-- Bind every profile to a tenant: platform_admin -> NULL (global); the rest
-- live under the default tenant (one-time conversion of pre-existing data).
alter table public.profiles
  add column if not exists tenant_id uuid references public.tenants(id);

-- ---- One-time legacy role swap (only while profiles.role is still user_role) ----
do $$
begin
  if not exists (
    select 1
      from pg_type t
      join pg_attribute a on a.attrelid = 'public.profiles'::regclass
                        and a.attname = 'role'
     where t.oid = a.atttypid and t.typname = 'user_role'
  ) then
    return;  -- already converted
  end if;

  alter table public.profiles add column role_v2 public.user_role_v2;

  update public.profiles p
     set role_v2 = case
           when p.role = 'system_admin' then 'platform_admin'::public.user_role_v2
           when p.store_role = 'owner'  then 'tenant_owner'::public.user_role_v2
           else 'store_manager'::public.user_role_v2
         end
   where p.role_v2 is null;

  update public.profiles p
     set tenant_id = (select id from public.tenants where slug = 'default')
   where p.role_v2 <> 'platform_admin'
     and p.tenant_id is null;

  drop index if exists public.one_owner_per_store;

  alter table public.profiles alter column role_v2 set not null;
  alter table public.profiles drop column role;
  alter table public.profiles rename column role_v2 to role;

  drop type if exists public.user_role;
end $$;

-- Drop the redundant per-store owner flag if it still exists.
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema='public' and table_name='profiles' and column_name='store_role') then
    alter table public.profiles drop column if exists store_role;
  end if;
end $$;

-- ------------------------------------------------------------
-- 2. tenant_id on every data table (backfill -> not null)
-- ------------------------------------------------------------
alter table public.stores           add column if not exists tenant_id uuid references public.tenants(id);
alter table public.products         add column if not exists tenant_id uuid references public.tenants(id);
alter table public.product_notes    add column if not exists tenant_id uuid references public.tenants(id);
alter table public.product_variants add column if not exists tenant_id uuid references public.tenants(id);
alter table public.batches          add column if not exists tenant_id uuid references public.tenants(id);
alter table public.inventory_levels add column if not exists tenant_id uuid references public.tenants(id);
alter table public.stock_movements  add column if not exists tenant_id uuid references public.tenants(id);
alter table public.suppliers        add column if not exists tenant_id uuid references public.tenants(id);
alter table public.purchase_orders  add column if not exists tenant_id uuid references public.tenants(id);
alter table public.purchase_order_items add column if not exists tenant_id uuid references public.tenants(id);
alter table public.sales_transactions add column if not exists tenant_id uuid references public.tenants(id);
alter table public.sale_items       add column if not exists tenant_id uuid references public.tenants(id);
alter table public.capital_ledger   add column if not exists tenant_id uuid references public.tenants(id);
alter table public.product_categories add column if not exists tenant_id uuid references public.tenants(id);
alter table public.category_attribute_definitions add column if not exists tenant_id uuid references public.tenants(id);

-- Backfill every tenant-owned row into the default tenant.
do $$
declare
  v_default uuid := (select id from public.tenants where slug = 'default');
begin
  update public.stores           set tenant_id = v_default where tenant_id is null;
  update public.products         set tenant_id = v_default where tenant_id is null;
  update public.product_notes    set tenant_id = v_default where tenant_id is null;
  update public.product_variants set tenant_id = v_default where tenant_id is null;
  update public.batches          set tenant_id = v_default where tenant_id is null;
  update public.inventory_levels set tenant_id = v_default where tenant_id is null;
  update public.stock_movements  set tenant_id = v_default where tenant_id is null;
  update public.suppliers        set tenant_id = v_default where tenant_id is null;
  update public.purchase_orders  set tenant_id = v_default where tenant_id is null;
  update public.purchase_order_items set tenant_id = v_default where tenant_id is null;
  update public.sales_transactions set tenant_id = v_default where tenant_id is null;
  update public.sale_items       set tenant_id = v_default where tenant_id is null;
  update public.capital_ledger   set tenant_id = v_default where tenant_id is null;
  update public.product_categories set tenant_id = v_default where tenant_id is null;
  update public.category_attribute_definitions set tenant_id = v_default where tenant_id is null;
end $$;

-- Enforce NOT NULL on every tenant-owned table.
alter table public.stores          alter column tenant_id set not null;
alter table public.products        alter column tenant_id set not null;
alter table public.product_notes   alter column tenant_id set not null;
alter table public.product_variants alter column tenant_id set not null;
alter table public.batches         alter column tenant_id set not null;
alter table public.inventory_levels alter column tenant_id set not null;
alter table public.stock_movements alter column tenant_id set not null;
alter table public.suppliers       alter column tenant_id set not null;
alter table public.purchase_orders alter column tenant_id set not null;
alter table public.purchase_order_items alter column tenant_id set not null;
alter table public.sales_transactions alter column tenant_id set not null;
alter table public.sale_items      alter column tenant_id set not null;
alter table public.capital_ledger  alter column tenant_id set not null;
alter table public.product_categories alter column tenant_id set not null;
alter table public.category_attribute_definitions alter column tenant_id set not null;

-- ------------------------------------------------------------
-- 3. Per-tenant uniqueness (replace global constraints)
-- ------------------------------------------------------------
alter table public.stores drop constraint if exists stores_name_key;
create unique index if not exists uq_stores_tenant_name
  on public.stores (tenant_id, name);

alter table public.product_variants drop constraint if exists product_variants_sku_key;
create unique index if not exists uq_variants_tenant_sku
  on public.product_variants (tenant_id, sku);

create unique index if not exists uq_variants_tenant_size
  on public.product_variants (tenant_id, product_id, size_ml, variant_type);

alter table public.batches drop constraint if exists batches_product_variant_id_lot_number_key;
create unique index if not exists uq_batches_tenant_lot
  on public.batches (tenant_id, product_variant_id, lot_number);

alter table public.product_categories drop constraint if exists product_categories_slug_key;
create unique index if not exists uq_categories_tenant_slug
  on public.product_categories (tenant_id, slug);

-- ------------------------------------------------------------
-- 4. Per-tenant settings
-- ------------------------------------------------------------
create table if not exists public.tenant_settings (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  business_name text not null default 'My Business',
  currency_symbol text not null default '₱',
  currency_locale text not null default 'en-PH',
  size_unit text not null default 'ml'
);

insert into public.tenant_settings (tenant_id)
select id from public.tenants
on conflict (tenant_id) do nothing;

-- ------------------------------------------------------------
-- 5. Tenant-aware RLS helper functions
-- ------------------------------------------------------------
-- Note: `create or replace` only (no DROPs). Legacy helper signatures
-- (`is_system_admin`, `assigned_store_ids`, `is_store_owner`) keep the same
-- argument profile, so redefining their bodies is safe while old policies
-- still reference them; section 6 removes those policies right after.

create or replace function public.is_platform_admin()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role = 'platform_admin'
      and tenant_id is null
      and is_active
  );
$$;

-- Compatibility alias (superseded by is_platform_admin; kept for safety).
create or replace function public.is_system_admin()
returns boolean language sql security definer stable set search_path = public as $$
  select public.is_platform_admin();
$$;

create or replace function public.is_tenant_owner()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role = 'tenant_owner'
      and tenant_id is not null
      and is_active
  );
$$;

-- Tenants the caller may touch: platform_admin -> every tenant; else own tenant.
create or replace function public.current_tenant_ids()
returns setof uuid language sql security definer stable set search_path = public as $$
  select id from public.tenants where public.is_platform_admin()
  union
  select p.tenant_id from public.profiles p
    join public.tenants t on t.id = p.tenant_id
  where p.id = auth.uid() and p.is_active and t.is_active
    and p.tenant_id is not null;
$$;

-- Stores the caller may touch.
--   platform_admin -> every store
--   tenant_owner   -> every store in their tenant
--   store_manager  -> assigned store only
create or replace function public.current_store_ids()
returns setof uuid language sql security definer stable set search_path = public as $$
  select s.id from public.stores s where public.is_platform_admin()
  union
  select s.id from public.stores s
    join public.profiles p on p.tenant_id = s.tenant_id
    join public.tenants t on t.id = s.tenant_id
   where p.id = auth.uid() and p.role = 'tenant_owner'
     and p.is_active and t.is_active
  union
  select p.store_id from public.profiles p
    join public.tenants t on t.id = p.tenant_id
  where p.id = auth.uid() and p.is_active and t.is_active
    and p.role = 'store_manager' and p.store_id is not null;
$$;

-- Compatibility alias.
create or replace function public.assigned_store_ids()
returns setof uuid language sql security definer stable set search_path = public as $$
  select public.current_store_ids();
$$;

-- Compatibility: was "is the caller an owner of their assigned store".
create or replace function public.is_store_owner()
returns boolean language sql security definer stable set search_path = public as $$
  select public.is_tenant_owner();
$$;

-- ------------------------------------------------------------
-- 6. Drop every legacy RLS policy on tenant-owned tables.
-- ------------------------------------------------------------
do $$
declare r record;
begin
  for r in
    select tablename, policyname
      from pg_policies
     where schemaname = 'public'
       and tablename in (
         'stores','profiles','products','product_notes','product_variants',
         'batches','inventory_levels','stock_movements','suppliers',
         'purchase_orders','purchase_order_items','sales_transactions',
         'sale_items','capital_ledger','product_categories',
         'category_attribute_definitions','tenants','tenant_settings'
       )
  loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- ------------------------------------------------------------
-- 7. New tenant-scoped RLS policies
-- ------------------------------------------------------------

-- TENANTS
alter table public.tenants enable row level security;
create policy tenants_platform_all on public.tenants
  for all using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy tenants_self_read on public.tenants
  for select using (id in (select public.current_tenant_ids()));

-- TENANT_SETTINGS
alter table public.tenant_settings enable row level security;
create policy ts_read on public.tenant_settings
  for select using (tenant_id in (select public.current_tenant_ids()));
create policy ts_platform_write on public.tenant_settings
  for all using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy ts_owner_write on public.tenant_settings
  for update using (public.is_tenant_owner())
  with check (tenant_id in (select public.current_tenant_ids()));

-- STORES
create policy stores_read on public.stores
  for select using (tenant_id in (select public.current_tenant_ids()));
create policy stores_platform_write on public.stores
  for all using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy stores_owner_write on public.stores
  for all using (public.is_tenant_owner())
  with check (public.is_tenant_owner() and tenant_id in (select public.current_tenant_ids()));

-- PROFILES
create policy profiles_platform_all on public.profiles
  for all using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy profiles_self_read on public.profiles
  for select using (id = auth.uid() or tenant_id in (select public.current_tenant_ids()));
-- Owners may provision/manage staff within their tenant but never touch their own
-- row (prevents self-escalation) and cannot change another tenant's members.
create policy profiles_owner_insert on public.profiles
  for insert with check (
    public.is_tenant_owner()
    and tenant_id in (select public.current_tenant_ids())
    and id <> auth.uid()
  );
create policy profiles_owner_update on public.profiles
  for update using (
    public.is_tenant_owner()
    and tenant_id in (select public.current_tenant_ids())
    and id <> auth.uid()
  ) with check (
    public.is_tenant_owner()
    and tenant_id in (select public.current_tenant_ids())
    and id <> auth.uid()
  );

-- PRODUCTS
create policy products_read on public.products
  for select using (
    tenant_id in (select public.current_tenant_ids())
    and (is_active or public.is_platform_admin())
  );
create policy products_platform_write on public.products
  for all using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy products_owner_write on public.products
  for all using (public.is_tenant_owner())
  with check (public.is_tenant_owner() and tenant_id in (select public.current_tenant_ids()));

-- PRODUCT_NOTES
create policy notes_read on public.product_notes
  for select using (tenant_id in (select public.current_tenant_ids()));
create policy notes_platform_write on public.product_notes
  for all using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy notes_owner_write on public.product_notes
  for all using (public.is_tenant_owner())
  with check (public.is_tenant_owner() and tenant_id in (select public.current_tenant_ids()));

-- PRODUCT_VARIANTS
-- Managers DO read variant rows through this (the sale form embeds the
-- cost-free variant_public_view). cost_price itself is physically hidden from
-- `authenticated` via COLUMN GRANTS in section 10, so no tenant member can
-- ever SELECT it directly.
create policy variants_read on public.product_variants
  for select using (
    tenant_id in (select public.current_tenant_ids())
    and (is_active or public.is_platform_admin())
  );
create policy variants_platform_write on public.product_variants
  for all using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy variants_owner_write on public.product_variants
  for all using (public.is_tenant_owner())
  with check (public.is_tenant_owner() and tenant_id in (select public.current_tenant_ids()));

-- BATCHES
create policy batches_read on public.batches
  for select using (tenant_id in (select public.current_tenant_ids()));
create policy batches_platform_write on public.batches
  for all using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy batches_owner_write on public.batches
  for all using (public.is_tenant_owner())
  with check (public.is_tenant_owner() and tenant_id in (select public.current_tenant_ids()));

-- SUPPLIERS
create policy suppliers_read on public.suppliers
  for select using (tenant_id in (select public.current_tenant_ids()));
create policy suppliers_platform_write on public.suppliers
  for all using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy suppliers_owner_write on public.suppliers
  for all using (public.is_tenant_owner())
  with check (public.is_tenant_owner() and tenant_id in (select public.current_tenant_ids()));

-- INVENTORY_LEVELS (store-isolated; writers are platform/owner, never managers)
create policy inv_select on public.inventory_levels
  for select using (store_id in (select public.current_store_ids()));
create policy inv_platform_write on public.inventory_levels
  for all using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy inv_owner_write on public.inventory_levels
  for all using (public.is_tenant_owner())
  with check (public.is_tenant_owner() and store_id in (select public.current_store_ids()));

-- STOCK_MOVEMENTS (immutable; store-isolated; insert allowed for assigned stores)
create policy mov_select on public.stock_movements
  for select using (store_id in (select public.current_store_ids()));
create policy mov_insert on public.stock_movements
  for insert with check (
    store_id in (select public.current_store_ids())
    and tenant_id in (select public.current_tenant_ids())
  );

-- PURCHASE ORDERS
create policy po_select on public.purchase_orders
  for select using (store_id in (select public.current_store_ids()));
create policy po_platform_write on public.purchase_orders
  for all using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy po_owner_write on public.purchase_orders
  for all using (public.is_tenant_owner())
  with check (public.is_tenant_owner() and store_id in (select public.current_store_ids()));

create policy poi_select on public.purchase_order_items
  for select using (
    exists (
      select 1 from public.purchase_orders po
      where po.id = purchase_order_id
        and po.store_id in (select public.current_store_ids())
    )
  );
create policy poi_platform_write on public.purchase_order_items
  for all using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy poi_owner_write on public.purchase_order_items
  for all using (public.is_tenant_owner())
  with check (
    exists (
      select 1 from public.purchase_orders po
      where po.id = purchase_order_id
        and po.store_id in (select public.current_store_ids())
    )
  );
-- SALES
create policy sale_insert on public.sales_transactions
  for insert with check (
    store_id in (select public.current_store_ids())
    and sold_by = auth.uid()
    and tenant_id in (select public.current_tenant_ids())
  );
create policy sale_select on public.sales_transactions
  for select using (store_id in (select public.current_store_ids()));
create policy sale_update_privileged on public.sales_transactions
  for update using (public.is_platform_admin() or public.is_tenant_owner())
  with check (store_id in (select public.current_store_ids()));
create policy sale_delete_admin on public.sales_transactions
  for delete using (public.is_platform_admin());

create policy sale_item_insert on public.sale_items
  for insert with check (
    exists (
      select 1 from public.sales_transactions s
      where s.id = sale_id
        and s.store_id in (select public.current_store_ids())
        and s.sold_by = auth.uid()
    )
  );
create policy sale_item_select on public.sale_items
  for select using (
    exists (
      select 1 from public.sales_transactions s
      where s.id = sale_id
        and s.store_id in (select public.current_store_ids())
    )
  );

-- CAPITAL LEDGER
create policy ledger_select on public.capital_ledger
  for select using (
    public.is_platform_admin()
    or (public.is_tenant_owner() and tenant_id in (select public.current_tenant_ids()))
  );
create policy ledger_platform_write on public.capital_ledger
  for all using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy ledger_owner_write on public.capital_ledger
  for all using (public.is_tenant_owner())
  with check (public.is_tenant_owner() and tenant_id in (select public.current_tenant_ids()));

-- TAXONOMY (tenant-owned)
create policy taxonomy_read on public.product_categories
  for select using (tenant_id in (select public.current_tenant_ids()));
create policy taxonomy_platform_write on public.product_categories
  for all using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy taxonomy_owner_write on public.product_categories
  for all using (public.is_tenant_owner())
  with check (public.is_tenant_owner() and tenant_id in (select public.current_tenant_ids()));

create policy attr_defs_read on public.category_attribute_definitions
  for select using (tenant_id in (select public.current_tenant_ids()));
create policy attr_defs_platform_write on public.category_attribute_definitions
  for all using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy attr_defs_owner_write on public.category_attribute_definitions
  for all using (public.is_tenant_owner())
  with check (public.is_tenant_owner() and tenant_id in (select public.current_tenant_ids()));

-- ------------------------------------------------------------
-- 8. Tenant-aware triggers + indexes
-- ------------------------------------------------------------

-- Stock apply: set inventory tenant_id from the store, keep null-safe upsert.
create or replace function public.apply_stock_movement()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_qoh int;
begin
  select quantity_on_hand into v_qoh
    from public.inventory_levels
   where variant_id = new.variant_id
     and store_id  = new.store_id
     and batch_id  is not distinct from new.batch_id;

  if v_qoh is null then
    if new.quantity < 0 then
      raise exception 'cannot deduct stock: no stock on hand for variant % at store %',
        new.variant_id, new.store_id;
    end if;
    insert into public.inventory_levels (variant_id, store_id, batch_id, quantity_on_hand, tenant_id)
    values (new.variant_id, new.store_id, new.batch_id, new.quantity,
            (select tenant_id from public.stores where id = new.store_id));
  else
    if v_qoh + new.quantity < 0 then
      raise exception 'insufficient stock for variant % at store %: have %, needed %',
        new.variant_id, new.store_id, v_qoh, -new.quantity;
    end if;
    update public.inventory_levels
       set quantity_on_hand = quantity_on_hand + new.quantity,
           updated_at       = now()
     where variant_id = new.variant_id
       and store_id  = new.store_id
       and batch_id  is not distinct from new.batch_id;
  end if;
  return new;
end;
$$;

-- Sale deduction: carry the sale's tenant onto the stock movement.
create or replace function public.deduct_sale_stock()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_sale public.sales_transactions;
begin
  select * into v_sale from public.sales_transactions where id = new.sale_id;
  insert into public.stock_movements (variant_id, store_id, batch_id, movement_type, quantity, reference_id, created_by, tenant_id)
  values (new.variant_id, v_sale.store_id, new.batch_id, 'sale', -new.quantity, v_sale.id, v_sale.sold_by, v_sale.tenant_id);
  return new;
end;
$$;

-- Attribute validation must resolve categories within the SAME tenant.
create or replace function public.validate_variant_attributes()
returns trigger language plpgsql as $$
declare
  v_category text;
  v_tenant   uuid;
  v_defined  text[];
  v_required text[];
begin
  select p.category, p.tenant_id into v_category, v_tenant
    from public.products p where p.id = new.product_id;
  if v_category is null then return new; end if;

  select coalesce(array_agg(d.attribute_key order by d.sort_order), '{}'),
         coalesce(array_agg(d.attribute_key) filter (where d.required), '{}')
    into v_defined, v_required
  from public.category_attribute_definitions d
  join public.product_categories c on c.id = d.category_id
  where c.slug = v_category and c.is_active and c.tenant_id = v_tenant;

  if exists (
    select 1 from jsonb_object_keys(new.attributes) k
    where not (k = any(v_defined))
  ) then
    raise exception 'variant has attribute keys not defined for category %', v_category;
  end if;

  if exists (select 1 from unnest(v_required) r where (new.attributes ->> r) is null) then
    raise exception 'missing required attributes for category %', v_category;
  end if;
  return new;
end;
$$;

-- Tenant-scoped query indexes.
create index if not exists idx_products_tenant on public.products(tenant_id);
create index if not exists idx_variants_tenant on public.product_variants(tenant_id);
create index if not exists idx_sales_tenant on public.sales_transactions(tenant_id, created_at desc);
create index if not exists idx_movements_tenant on public.stock_movements(tenant_id, created_at desc);
create index if not exists idx_inventory_tenant on public.inventory_levels(tenant_id);

-- APP_SETTINGS (platform-level config): restore the admin-write policy that the
-- CASCADE on is_system_admin removed; read policies survive untouched.
drop policy if exists settings_admin_write on public.app_settings;
create policy settings_admin_write on public.app_settings
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());
create index if not exists idx_inventory_tenant on public.inventory_levels(tenant_id);
create index if not exists idx_inventory_tenant on public.inventory_levels(tenant_id);

-- ------------------------------------------------------------
-- 9. Server-side COGS derivation (kills the cost-price leak).
--    sale_items.unit_cogs + sales_transactions.total_cogs are filled by DB
--    triggers using SECURITY DEFINER, so neither the client nor a store
--    manager ever reads cost_price. Manager queries use variant_public_view,
--    which physically omits the column. tenant_id on sale_items is ALSO derived
--    from the parent sale so a client can never create a mismatched or
--    missing-tenant line item (and the sale_item_insert policy need not trust
--    a client-supplied tenant_id).
-- ------------------------------------------------------------
create or replace function public.sale_item_populate()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_sale public.sales_transactions;
begin
  -- Derive the owning tenant from the parent sale (never trust a client value).
  select tenant_id into v_sale.tenant_id
    from public.sales_transactions
   where id = new.sale_id;
  if v_sale.tenant_id is not null then
    new.tenant_id := v_sale.tenant_id;
  end if;

  -- Derive unit_cogs from the (privileged) product_variants table.
  select cost_price into new.unit_cogs
    from public.product_variants
   where id = new.variant_id;
  if new.unit_cogs is null then new.unit_cogs := 0; end if;
  return new;
end;
$$;

drop trigger if exists trg_sale_item_set_cogs on public.sale_items;
drop trigger if exists trg_sale_item_populate on public.sale_items;
create trigger trg_sale_item_populate
before insert on public.sale_items
for each row execute function public.sale_item_populate();

-- ------------------------------------------------------------
-- 9b. Atomic sale RPC (SECURITY DEFINER).
--     The sanctioned write path for recording a sale. Runs as one transaction:
--     creates the transaction + line item + (via triggers) the COGS and the
--     stock deduction. If stock is insufficient, the whole sale rolls back —
--     no orphan transaction is ever left behind. Because it is SECURITY
--     DEFINER it bypasses RLS, so it strictly re-validates that the target
--     store belongs to the caller's tenant and sets sold_by = auth.uid().
-- ------------------------------------------------------------
create or replace function public.record_sale(
  p_store uuid,
  p_variant uuid,
  p_quantity int,
  p_unit_price numeric,
  p_payment public.payment_method default 'cash',
  p_discount numeric default 0,
  p_batch uuid default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_tenant uuid;
  v_price numeric;
  v_subtotal numeric;
  v_total numeric;
  v_sale uuid;
begin
  if p_quantity < 1 then raise exception 'quantity must be positive'; end if;

  -- Strictly bound the store to a tenant the caller is allowed to touch.
  select tenant_id into v_tenant from public.stores where id = p_store;
  if v_tenant is null then raise exception 'unknown store'; end if;
  if not (v_tenant in (select public.current_tenant_ids())) then
    raise exception 'unauthorized store';
  end if;

  -- The retail price is derived server-side; a client-supplied price is
  -- never trusted (prevents a tampered client recording a 0-price sale).
  select retail_price into v_price
    from public.product_variants
   where id = p_variant and is_active;
  if v_price is null then raise exception 'unknown or inactive variant'; end if;

  v_subtotal := v_price * p_quantity;
  if p_discount < 0 or p_discount > v_subtotal then
    raise exception 'discount cannot be negative or exceed subtotal';
  end if;
  v_total := greatest(v_subtotal - p_discount, 0);

  insert into public.sales_transactions
    (store_id, sold_by, tenant_id, payment_method, subtotal, discount, total)
  values (p_store, auth.uid(), v_tenant, p_payment, v_subtotal, p_discount, v_total)
  returning id into v_sale;

  insert into public.sale_items (sale_id, variant_id, batch_id, quantity, unit_price)
  values (v_sale, p_variant, p_batch, p_quantity, v_price);

  return jsonb_build_object('sale_id', v_sale, 'total', v_total);
end;
$$;

revoke all on function public.record_sale(uuid, uuid, int, numeric, public.payment_method, numeric, uuid) from public, anon;
grant execute on function public.record_sale(uuid, uuid, int, numeric, public.payment_method, numeric, uuid) to authenticated;

create or replace function public.sale_sync_total_cogs()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_total numeric;
begin
  select sum(unit_cogs * quantity) into v_total
    from public.sale_items
   where sale_id = new.sale_id;
  update public.sales_transactions
     set total_cogs = coalesce(v_total, 0)
   where id = new.sale_id;
  return new;
end;
$$;

drop trigger if exists trg_sale_sync_total_cogs on public.sale_items;
create trigger trg_sale_sync_total_cogs
after insert on public.sale_items
for each row execute function public.sale_sync_total_cogs();

-- ------------------------------------------------------------
-- 10. Cost-price hardening (column grants + security_invoker view).
--     authenticated (every logged-in user — owners AND managers) is granted
--     SELECT on product/products columns EXCEPT cost_price, so cost cannot be
--     read via the API by anyone. The COGS triggers are SECURITY DEFINER
--     (run as postgres) and still read cost internally. variant_public_view is
--     security_invoker so the caller's RLS applies, preventing a manager from
--     reading another tenant's catalog through it.
-- ------------------------------------------------------------
revoke select on public.products from authenticated;
revoke select on public.product_variants from authenticated;

grant select (id, name, brand, category, concentration, description,
              image_url, is_active, retail_price, tenant_id, created_at)
  on public.products to authenticated;
grant select (id, product_id, sku, size_ml, variant_type, retail_price,
              attributes, low_stock_threshold, is_active, tenant_id)
  on public.product_variants to authenticated;

alter view public.variant_public_view set (security_invoker = true);