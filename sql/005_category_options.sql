-- ============================================================
-- IMS — Category-driven secondary field (e.g. concentration)
-- Run AFTER 001–004. Safe to re-run.
-- ============================================================

-- Free the concentration column from the perfume-only enum so any
-- category can store its own option values (fragrance, product type, etc.)
alter table public.products alter column concentration type text;

-- Per-category options for the second dropdown. JSON: { "Category": ["opt", ...] }
-- Categories without an entry simply show no secondary dropdown.
insert into public.app_settings (key, value) values
  ('category_options', '{"Fragrance": ["EDT", "EDP", "EXTRAIT", "EDC", "OIL"]}')
on conflict (key) do nothing;