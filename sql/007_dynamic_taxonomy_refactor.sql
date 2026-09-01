-- ============================================================
-- 007 — Dynamic Taxonomy Refactor (Metadata-Driven Schema Engine)
-- Run AFTER 001–006. Safe to re-run (idempotent).
-- ============================================================

-- ------------------------------------------------------------
-- 1. Taxonomy: categories become first-class rows (replaces the
--    comma-separated product_categories string in app_settings)
-- ------------------------------------------------------------
create table if not exists public.product_categories (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,                 -- 'fragrance' (stable identifier)
  label text not null,                       -- 'Fragrance' (display)
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 2. Dynamic attribute definitions per category.
--    Replaces hardcoded domain fields (concentration, size_ml,
--    perfume_features flag, category_options JSON map).
-- ------------------------------------------------------------
create table if not exists public.category_attribute_definitions (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.product_categories(id) on delete cascade,
  attribute_key text not null,               -- 'concentration' (JSONB key on variants)
  label text not null,                       -- 'Concentration' (form label)
  input_type text not null check (input_type in ('select','text','number','boolean','date')),
  options jsonb,                             -- ["EDT","EDP"] for input_type='select'
  required boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (category_id, attribute_key)
);

-- ------------------------------------------------------------
-- 3. Product variant attributes (JSONB) + GIN index
-- ------------------------------------------------------------
alter table public.product_variants
  add column if not exists attributes jsonb not null default '{}';

create index if not exists idx_product_variants_attributes
  on public.product_variants using gin (attributes jsonb_path_ops);

-- ------------------------------------------------------------
-- 4. Attribute integrity trigger (declared keys + required check)
-- ------------------------------------------------------------
create or replace function public.validate_variant_attributes()
returns trigger language plpgsql as $$
declare
  v_category text;
  v_defined text[];
  v_required text[];
begin
  select p.category into v_category from public.products p where p.id = new.product_id;
  if v_category is null then return new; end if;  -- uncategorized: skip

  select coalesce(array_agg(d.attribute_key order by d.sort_order), '{}'),
         coalesce(array_agg(d.attribute_key) filter (where d.required), '{}')
    into v_defined, v_required
  from public.category_attribute_definitions d
  join public.product_categories c on c.id = d.category_id
  where c.slug = v_category and c.is_active;

  if exists (
    select 1 from jsonb_object_keys(new.attributes) k
    where not (k = any(v_defined))
  ) then
    raise exception 'variant has attribute keys not defined for category %', v_category;
  end if;

  if exists (select 1 from unnest(v_required) r where (new.attributes ->> r) is null) then
    raise exception 'missing required attribute(s) for category %', v_category;
  end if;

  return new;
end $$;

drop trigger if exists trg_validate_variant_attributes on public.product_variants;
create trigger trg_validate_variant_attributes
  before insert or update of attributes, product_id on public.product_variants
  for each row execute function public.validate_variant_attributes();

-- ------------------------------------------------------------
-- 5. RLS — taxonomy readable by everyone (public catalog metadata,
--    required for cached anon reads); writes are admin-only
-- ------------------------------------------------------------
alter table public.product_categories enable row level security;
alter table public.category_attribute_definitions enable row level security;

drop policy if exists "taxonomy_read_all" on public.product_categories;
create policy "taxonomy_read_all"
  on public.product_categories for select using (true);

drop policy if exists "taxonomy_admin_write" on public.product_categories;
create policy "taxonomy_admin_write"
  on public.product_categories for all
  using (public.is_system_admin())
  with check (public.is_system_admin());

drop policy if exists "attr_defs_read_all" on public.category_attribute_definitions;
create policy "attr_defs_read_all"
  on public.category_attribute_definitions for select using (true);

drop policy if exists "attr_defs_admin_write" on public.category_attribute_definitions;
create policy "attr_defs_admin_write"
  on public.category_attribute_definitions for all
  using (public.is_system_admin())
  with check (public.is_system_admin());

-- ------------------------------------------------------------
-- 6. Backfill from legacy app_settings (string categories + options map)
-- ------------------------------------------------------------
-- Backfill only applies if the legacy app_settings table exists
-- (fresh databases have nothing to migrate).
do $$
begin
  if to_regclass('public.app_settings') is not null then
    insert into public.product_categories (slug, label, sort_order)
    select
      lower(regexp_replace(trim(cat), '[^a-z0-9]+', '-', 'gi')),
      trim(cat),
      ord
    from (
      select row_number() over () as ord, trim(cat) as cat
      from unnest(string_to_array(
        coalesce((select value from public.app_settings where key = 'product_categories'), ''),
        ','
      )) as cat
      where trim(cat) <> ''
    ) s
    on conflict (slug) do nothing;

    -- category_options: {"Fragrance": ["EDT","EDP"]} → one select
    -- attribute per category, iterating over the JSONB map keys
    insert into public.category_attribute_definitions
      (category_id, attribute_key, label, input_type, options, sort_order)
    select c.id, 'concentration', 'Concentration', 'select', opt.value, 0
    from public.app_settings s,
         jsonb_each(s.value::jsonb) as opt(label, value)
    join public.product_categories
      c on c.slug = lower(regexp_replace(trim(opt.label), '[^a-z0-9]+', '-', 'gi'))
    where s.key = 'category_options'
      and jsonb_typeof(s.value::jsonb) = 'object'
      and jsonb_typeof(opt.value) = 'array'
    on conflict (category_id, attribute_key) do nothing;
  end if;
end $$;

-- app_settings holds only public catalog config (branding/currency) —
-- readable by anon so unstable_cache can fetch without a user session.
-- (Skipped on fresh databases where app_settings doesn't exist yet.)
do $$
begin
  if to_regclass('public.app_settings') is not null
     and not exists (
       select 1 from pg_policies
       where tablename = 'app_settings' and policyname = 'settings_read_public'
     ) then
    execute 'create policy "settings_read_public" on public.app_settings for select using (true)';
  end if;
end $$;
