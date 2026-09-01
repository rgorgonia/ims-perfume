-- ============================================================
-- 008 — JSONB attribute backfill + view exposure (Phase 6)
-- Run AFTER 007. Idempotent.
-- ============================================================

-- 1. Expose variant attributes on the manager-safe projection view.
create or replace view public.variant_public_view as
  select id, product_id, sku, size_ml, variant_type, retail_price,
         low_stock_threshold, is_active, attributes
  from public.product_variants;

-- 2. Backfill: legacy products.concentration → variants.attributes.concentration,
--    only where a 'concentration' definition exists for the product's category
--    (the validation trigger would otherwise reject undeclared keys).
--    Skipped when products.category doesn't exist yet (run 003 first).
do $$
begin
  if to_regclass('public.category_attribute_definitions') is not null
     and exists (
       select 1 from information_schema.columns
       where table_schema = 'public'
         and table_name = 'products'
         and column_name = 'category'
     ) then
    update public.product_variants v
    set attributes = coalesce(v.attributes, '{}'::jsonb)
                     || jsonb_build_object('concentration', p.concentration)
    from public.products p
    join public.product_categories c on c.slug = p.category
    join public.category_attribute_definitions d
      on d.category_id = c.id and d.attribute_key = 'concentration'
    where v.product_id = p.id
      and p.concentration is not null
      and (v.attributes ->> 'concentration') is null;
  end if;
end $$;

-- NOTE: legacy columns (products.concentration, product_variants.size_ml) are
-- dual-written by the app during the transition and are intentionally NOT
-- dropped here. Removal happens after the QA pipeline (roadmap Phase 7) is live.
