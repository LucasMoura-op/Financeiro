create extension if not exists pgcrypto with schema extensions;

create table if not exists public.aureon_workspaces (
  workspace_key text primary key,
  access_hash text,
  payload jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.aureon_workspaces enable row level security;

drop policy if exists "Aureon workspaces can be read by anon" on public.aureon_workspaces;
drop policy if exists "Aureon workspaces can be created by anon" on public.aureon_workspaces;
drop policy if exists "Aureon workspaces can be updated by anon" on public.aureon_workspaces;

update public.aureon_workspaces
set access_hash = extensions.crypt(workspace_key, extensions.gen_salt('bf'))
where access_hash is null;

alter table public.aureon_workspaces
alter column access_hash set not null;

create or replace function public.normalize_aureon_workspace_key(value text)
returns text
language sql
immutable
as $$
  select trim(both '-' from regexp_replace(lower(trim(value)), '[^a-z0-9-]+', '-', 'g'));
$$;

create or replace function public.aureon_get_workspace(
  p_workspace_key text,
  p_access_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_workspace_key text := public.normalize_aureon_workspace_key(p_workspace_key);
  v_payload jsonb;
begin
  if v_workspace_key = '' or length(coalesce(p_access_key, '')) < 6 then
    raise exception 'invalid workspace credentials';
  end if;

  select payload
    into v_payload
    from public.aureon_workspaces
   where workspace_key = v_workspace_key
     and access_hash = extensions.crypt(p_access_key, access_hash);

  return v_payload;
end;
$$;

create or replace function public.aureon_save_workspace(
  p_workspace_key text,
  p_access_key text,
  p_payload jsonb
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_workspace_key text := public.normalize_aureon_workspace_key(p_workspace_key);
  v_access_hash text;
begin
  if v_workspace_key = '' or length(coalesce(p_access_key, '')) < 6 then
    raise exception 'invalid workspace credentials';
  end if;

  select access_hash
    into v_access_hash
    from public.aureon_workspaces
   where workspace_key = v_workspace_key;

  if v_access_hash is null then
    insert into public.aureon_workspaces (workspace_key, access_hash, payload, updated_at)
    values (
      v_workspace_key,
      extensions.crypt(p_access_key, extensions.gen_salt('bf')),
      coalesce(p_payload, '[]'::jsonb),
      now()
    );
    return;
  end if;

  if v_access_hash <> extensions.crypt(p_access_key, v_access_hash) then
    raise exception 'invalid workspace credentials';
  end if;

  update public.aureon_workspaces
     set payload = coalesce(p_payload, '[]'::jsonb),
         updated_at = now()
   where workspace_key = v_workspace_key;
end;
$$;

revoke all on public.aureon_workspaces from anon;
grant execute on function public.aureon_get_workspace(text, text) to anon;
grant execute on function public.aureon_save_workspace(text, text, jsonb) to anon;
