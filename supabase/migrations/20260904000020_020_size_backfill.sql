-- ============================================================
-- 020: backfill variant size from legacy attributes.ml
--  Variants created before 019 stored size as attributes.ml.
--  Rename ml -> size (removing the legacy key, which the
--  attribute-validation trigger no longer declares) and mirror
--  the number into size_ml so the UI shows e.g. "(100 ml)"
--  instead of "(null ml)".
-- ============================================================

alter table public.product_variants disable trigger trg_validate_variant_attributes;

update public.product_variants
set attributes = (attributes - 'ml') || jsonb_build_object('size', attributes->'ml')
where attributes ? 'ml'
  and not attributes ? 'size';

update public.product_variants
set size_ml = (attributes->>'size')::numeric
where size_ml is null
  and attributes ? 'size';

alter table public.product_variants enable trigger trg_validate_variant_attributes;
