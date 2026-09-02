-- ============================================================
-- Local-only seed data. Runs automatically after `supabase db reset`.
-- NEVER run against a hosted/production Supabase.
-- ============================================================
-- Recreates the local test accounts wiped by db reset.
-- Passwords: admin1234 / localadmin123 / manager1234 (bcrypt via pgcrypto,
-- same scheme GoTrue verifies against).

-- 1) Auth users (fixed UUIDs so profile FKs are stable across resets)
-- NOTE: auth.users has no unique constraint on email in this schema version,
-- so guard with not-exists instead of ON CONFLICT.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token, recovery_token, email_change_token_new, email_change, email_change_token_current, phone_change_token, reauthentication_token, phone)
select v.id::uuid, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', v.email, crypt(v.pass, gen_salt('bf', 10)), now(), now(), now(),
       '{"provider":"email","providers":["email"]}', json_build_object('full_name', v.full_name, 'email_verified', true),
       '', '', '', '', '', '', '', NULL
from (values
  ('11111111-1111-1111-1111-111111111111', 'admin@local.test', 'admin1234', 'Local Admin'),
  ('22222222-2222-2222-2222-222222222222', 'ronald.gorgonia.work@gmail.com', 'localadmin123', 'Ronald Gorgonia'),
  ('33333333-3333-3333-3333-333333333333', 'manager@local.test', 'manager1234', 'Test Manager')
) as v(id, email, pass, full_name)
where not exists (select 1 from auth.users u where u.email = v.email);

-- 2) Profiles (admin / admin / inventory manager)
insert into public.profiles (id, full_name, role, store_role)
values
  ('11111111-1111-1111-1111-111111111111', 'Local Admin', 'system_admin', 'manager'),
  ('22222222-2222-2222-2222-222222222222', 'Ronald Gorgonia', 'system_admin', 'manager'),
  ('33333333-3333-3333-3333-333333333333', 'Test Manager', 'store_manager', 'manager')
on conflict (id) do nothing;

-- 3) A demo store for the manager account
insert into public.stores (id, name, store_type)
values ('44444444-4444-4444-4444-444444444444', 'Test Store', 'physical')
on conflict (name) do nothing;

update public.profiles
set store_id = '44444444-4444-4444-4444-444444444444'
where id = '33333333-3333-3333-3333-333333333333';
