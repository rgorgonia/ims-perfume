-- 014: profile avatar + self-service profile updates
alter table public.profiles add column if not exists avatar_url text;

-- Users may update their OWN row (full_name / avatar_url). The guard trigger
-- below prevents changing role/tenant/store/is_active through this path.
drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

create or replace function public.guard_profile_self_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is distinct from new.id then
    return new; -- not a self-update; other policies govern it
  end if;
  if new.role is distinct from old.role
     or new.tenant_id is distinct from old.tenant_id
     or new.store_id is distinct from old.store_id
     or new.is_active is distinct from old.is_active then
    raise exception 'Cannot change role, tenant, store, or active status from profile settings';
  end if;
  return new;
end $$;

drop trigger if exists trg_guard_profile_self_update on public.profiles;
create trigger trg_guard_profile_self_update
  before update on public.profiles
  for each row execute function public.guard_profile_self_update();

-- Public avatars bucket; users may only write inside their own uid folder.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists avatars_public_read on storage.objects;
create policy avatars_public_read on storage.objects
  for select using (bucket_id = 'avatars');

drop policy if exists avatars_owner_write on storage.objects;
create policy avatars_owner_write on storage.objects
  for insert with check (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists avatars_owner_update on storage.objects;
create policy avatars_owner_update on storage.objects
  for update using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists avatars_owner_delete on storage.objects;
create policy avatars_owner_delete on storage.objects
  for delete using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );