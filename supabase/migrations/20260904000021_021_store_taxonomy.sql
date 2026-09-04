-- ============================================================
-- 021: per-store taxonomy
--  product_categories / category_attribute_definitions gain a
--  nullable store_id: NULL = tenant-wide shared default, set =
--  owned by that store only. Store B never sees Store A's rows
--  unless explicitly imported. Uniqueness becomes per-scope.
--  The attribute-validation trigger accepts keys defined in the
--  variant's own store scope OR the shared scope.
-- ============================================================

alter table public.product_categories
  add column if not exists store_id uuid references public.stores(id) on delete cascade;
alter table public.category_attribute_definitions
  add column if not exists store_id uuid references public.stores(id) on delete cascade;

-- scope-aware uniqueness (slug): one shared row + one row per store
alter table public.product_categories
  drop constraint if exists product_categories_slug_key;
drop index if exists public.uq_categories_tenant_slug;
create unique index if not exists uq_categories_scope
  on public.product_categories (tenant_id, coalesce(store_id, '00000000-0000-0000-0000-000000000000'::uuid), slug);

-- scope-aware uniqueness (attribute key per category)
alter table public.category_attribute_definitions
  drop constraint if exists category_attribute_definitions_category_id_attribute_key_key;
create unique index if not exists uq_attrdefs_scope
  on public.category_attribute_definitions
    (tenant_id, category_id, coalesce(store_id, '00000000-0000-0000-0000-000000000000'::uuid), attribute_key);

-- validation trigger: accept keys from the product's store scope OR shared
create or replace function public.validate_variant_attributes()
returns trigger language plpgsql as $$
declare
  v_category text;
  v_tenant   uuid;
  v_store    uuid;
  v_defined  text[];
  v_required text[];
begin
  select p.category, p.tenant_id, p.store_id into v_category, v_tenant, v_store
    from public.products p where p.id = new.product_id;
  if v_category is null then return new; end if;

  select coalesce(array_agg(d.attribute_key order by d.sort_order), '{}'),
         coalesce(array_agg(d.attribute_key) filter (where d.required), '{}')
    into v_defined, v_required
  from public.category_attribute_definitions d
  join public.product_categories c on c.id = d.category_id
  where c.slug = v_category and c.is_active and c.tenant_id = v_tenant
    and (d.store_id is null or d.store_id is not distinct from v_store);

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
