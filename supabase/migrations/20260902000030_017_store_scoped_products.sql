-- Store-scoped products: a product belongs to a store. store_id NULL means
-- a shared/tenant-wide product (visible in every store). This keeps each
-- store's catalog completely isolated.
alter table public.products
  add column if not exists store_id uuid references public.stores(id) on delete cascade;
create index if not exists products_store_idx on public.products (store_id);

-- authenticated has COLUMN-level SELECT grants that must include store_id for
-- store filtering to work (otherwise .eq on store_id throws 42501 permission
-- denied).
grant select (store_id) on public.products to authenticated;

-- RPC gains p_store_id: the created product is scoped to that store.
create or replace function public.create_product_with_variant(
  p_name text, p_brand text, p_category text, p_attributes jsonb,
  p_sku text, p_size_ml integer, p_retail_price numeric,
  p_cost_price numeric default null, p_store_id uuid default null
) returns jsonb
language plpgsql security definer set search_path to 'public'
as $function$
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
    v_product, v_tenant, p_sku, p_size_ml, p_retail_price,
    case when v_privileged then coalesce(p_cost_price, 0) else 0 end,
    coalesce(p_attributes, '{}'::jsonb)
  );

  return jsonb_build_object('product_id', v_product);
end;
$function$;

