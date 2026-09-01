-- ============================================================
-- IMS — App Settings (makes the system business-agnostic)
-- Run AFTER 001_schema.sql. Safe to re-run.
-- ============================================================

-- Key/value configuration editable by system admins.
create table if not exists public.app_settings (
  key text primary key,
  value text,
  updated_at timestamptz not null default now()
);

alter table public.app_settings enable row level security;

-- Everyone signed in can read the settings (needed to render the UI)...
create policy "settings_read_all"
  on public.app_settings for select
  to authenticated
  using (true);

-- ...but only system admins can change them.
create policy "settings_admin_write"
  on public.app_settings for all
  to authenticated
  using (public.is_system_admin())
  with check (public.is_system_admin());

-- Products get an optional free-text category (configurable list in settings).
alter table public.products add column if not exists category text;

-- ---------- Defaults (safe to re-run) ----------
insert into public.app_settings (key, value) values
  ('business_name', 'My Business'),
  ('currency_symbol', '₱'),
  ('currency_locale', 'en-PH'),
  ('size_unit', 'ml'),
  ('product_categories', 'Fragrance, Body care, Home scent, Cosmetic, Accessory'),
  ('perfume_features', 'on')          -- 'on' shows concentration + scent notes; 'off' hides them
on conflict (key) do nothing;
