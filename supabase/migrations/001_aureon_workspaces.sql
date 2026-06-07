create table if not exists public.aureon_workspaces (
  workspace_key text primary key,
  payload jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.aureon_workspaces enable row level security;

drop policy if exists "Aureon workspaces can be read by anon" on public.aureon_workspaces;
create policy "Aureon workspaces can be read by anon"
on public.aureon_workspaces
for select
to anon
using (true);

drop policy if exists "Aureon workspaces can be created by anon" on public.aureon_workspaces;
create policy "Aureon workspaces can be created by anon"
on public.aureon_workspaces
for insert
to anon
with check (true);

drop policy if exists "Aureon workspaces can be updated by anon" on public.aureon_workspaces;
create policy "Aureon workspaces can be updated by anon"
on public.aureon_workspaces
for update
to anon
using (true)
with check (true);
