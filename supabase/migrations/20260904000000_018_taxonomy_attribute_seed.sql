-- ============================================================
-- 018: Taxonomy attribute seed.
-- Categories without attribute definitions render no fields on
-- product/variant forms, so variants are saved with an empty
-- attributes JSONB ("variant has no contents"). Backfill every
-- active tenant category that has no definitions with a usable
-- starter set:
--   * all categories      -> "notes" (free text)
--   * fragrance-ish slugs -> "concentration" + "scent_family" selects
-- Mirrors the defaults seeded by addCategoryAction (src/app/actions/config.ts).
-- ============================================================

insert into public.category_attribute_definitions
  (tenant_id, category_id, attribute_key, label, input_type, options, required, sort_order)
select
  c.tenant_id, c.id, 'concentration', 'Concentration', 'select',
  '["EDT","EDP","Parfum","EdC"]'::jsonb, false, 0
from public.product_categories c
where c.is_active
  and c.slug ~ '(fragrance|perfume|cologne)'
  and not exists (
    select 1 from public.category_attribute_definitions d
    where d.category_id = c.id and d.attribute_key = 'concentration'
  )
on conflict (category_id, attribute_key) do nothing;

insert into public.category_attribute_definitions
  (tenant_id, category_id, attribute_key, label, input_type, options, required, sort_order)
select
  c.tenant_id, c.id, 'scent_family', 'Scent family', 'select',
  '["Floral","Woody","Oriental","Fresh","Gourmand"]'::jsonb, false, 1
from public.product_categories c
where c.is_active
  and c.slug ~ '(fragrance|perfume|cologne)'
  and not exists (
    select 1 from public.category_attribute_definitions d
    where d.category_id = c.id and d.attribute_key = 'scent_family'
  )
on conflict (category_id, attribute_key) do nothing;

-- Generic catch-all: any category that still has no definitions at all
-- gets a free-text "notes" attribute so variant contents are never empty.
insert into public.category_attribute_definitions
  (tenant_id, category_id, attribute_key, label, input_type, options, required, sort_order)
select
  c.tenant_id, c.id, 'notes', 'Notes', 'text', null, false, 10
from public.product_categories c
where c.is_active
  and not exists (
    select 1 from public.category_attribute_definitions d
    where d.category_id = c.id
  )
on conflict (category_id, attribute_key) do nothing;
