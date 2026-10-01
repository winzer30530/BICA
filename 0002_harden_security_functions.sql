-- Move SECURITY DEFINER helpers out of the exposed public schema.
create schema if not exists private;
create or replace function private.is_staff() returns boolean language sql stable security definer set search_path=public,private as $$ select exists(select 1 from public.profiles where id=auth.uid()) $$;
create or replace function private.is_owner() returns boolean language sql stable security definer set search_path=public,private as $$ select exists(select 1 from public.profiles where id=auth.uid() and role='owner') $$;
grant usage on schema private to authenticated;
grant execute on function private.is_staff() to authenticated;
grant execute on function private.is_owner() to authenticated;
-- Existing policies should reference private.is_staff/private.is_owner; recreate them during deployment if upgrading an existing database.
