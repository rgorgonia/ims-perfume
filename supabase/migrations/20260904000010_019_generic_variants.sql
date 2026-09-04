-- ============================================================
-- 019: Generic, taxonomy-driven variants (Phase B2).
--  1. size_ml -> nullable legacy mirror; size lives in attributes JSONB
--  2. uniqueness keyed on the attribute-derived size
--  3. seed a "size" number attribute for every active category
--  4. product_notes.note_type: enum -> free text (any category can tag)
--  5. drop legacy products.concentration (unused, zero data)
--  6. variant_public_view: size_ml falls back to attributes->>'size'
--  7. create_product_with_variant: size optional, derived from attributes
-- ============================================================

-- 1. size becomes optional on the column (check still enforces > 0 when set)
alter table public.product_variants alter column size_ml drop not null;

-- 2. uniqueness: (tenant, product, type, size) where size comes from the
--    attribute when declared, falling back to the legacy column for old rows.
drop index if exists public.uq_variants_tenant_size;
alter table public.product_variants
  drop constraint if exists product_variants_product_id_size_ml_variant_type_key;
create unique index if not exists uq_variants_tenant_size_attr
  on public.product_variants
    (tenant_id, product_id, variant_type,
     coalesce(nullif(attributes->>'size', ''), size_ml::text, ''));

-- 3. every active category gets a "size" number attribute so variant forms
--    always render a Size field (mirrors the 018 seeding pattern).
insert into public.category_attribute_definitions
  (tenant_id, category_id, attribute_key, label, input_type, options, required, sort_order)
select c.tenant_id, c.id, 'size', 'Size', 'number', null, false, 0
from public.product_categories c
where c.is_active
  and not exists (
    select 1 from public.category_attribute_definitions d
    where d.category_id = c.id and d.attribute_key = 'size'
  )
on conflict (category_id, attribute_key) do nothing;

-- 4. free-form note types
alter table public.product_notes
  alter column note_type type text using note_type::text;
drop type if exists public.note_type;

-- 5. legacy column removed (values were dual-written to variants.attributes)
alter table public.products drop column if exists concentration;

-- 6. view: display size prefers attributes.size, falls back to size_ml
--    (drop+recreate: the size_ml column type changes int -> numeric)
drop view if exists public.variant_public_view;
create view public.variant_public_view with (security_invoker = on) as
select
  id,
  product_id,
  sku,
  coalesce(nullif(attributes->>'size', '')::numeric, size_ml) as size_ml,
  variant_type,
  retail_price,
  low_stock_threshold,
  is_active,
  attributes
from public.product_variants;

grant select on public.variant_public_view to authenticated;

-- 7. RPC: size now optional on the wire — derived from p_attributes->>'size'
create or replace function public.create_product_with_variant(
  p_name text, p_brand text, p_category text, p_attributes jsonb,
  p_sku text, p_size_ml integer default null, p_retail_price numeric default 0,
  p_cost_price numeric default null, p_store_id uuid default null
) returns jsonb
language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_tenant uuid;
  v_product uuid;
  v_privileged boolean;
  v_size integer;
begin
  select tenant_id, (public.is_tenant_owner() or public.is_platform_admin())
    into v_tenant, v_privileged
  from public.profiles where id = auth.uid();
  if v_tenant is null then raise exception 'no tenant profile for caller'; end if;

  if p_name is null or p_sku is null then
    raise exception 'product name and sku are required';
  end if;

  v_size := coalesce(
    p_size_ml,
    nullif(p_attributes ->> 'size', '')::integer
  );
  if v_size is not null and v_size < 1 then
    raise exception 'size must be a positive number';
  end if;

  if p_store_id is not null then
    perform 1 from public.stores where id = p_store_id and tenant_id = v_tenant;
    if not found then raise exception 'store not found in your organization'; end if;
  end if;

  insert into public.products (name, brand, category, tenant_id, retail_price, cost_price, store_id)
  values (
    p_name, p_brand, p_category, v_tenant, p_retail_price,
    case when v_privileged then coalesce(p_cost_price, 0) else 0 end,
    p_store_id
  )
  returning id into v_product;

  insert into public.product_variants (
    product_id, tenant_id, sku, size_ml, retail_price, cost_price, attributes
  ) values (
    v_product, v_tenant, p_sku, v_size, p_retail_price,
    case when v_privileged then coalesce(p_cost_price, 0) else 0 end,
    coalesce(p_attributes, '{}'::jsonb)
  );

  return jsonb_build_object('product_id', v_product);
end;
$function$;

revoke all on function public.create_product_with_variant(text, text, text, jsonb, text, integer, numeric, numeric, uuid) from public, anon;
grant execute on function public.create_product_with_variant(text, text, text, jsonb, text, integer, numeric, numeric, uuid) to authenticated;

-- remove the stale 8-arg overload superseded above
drop function if exists public.create_product_with_variant(text, text, text, jsonb, text, integer, numeric, numeric);
