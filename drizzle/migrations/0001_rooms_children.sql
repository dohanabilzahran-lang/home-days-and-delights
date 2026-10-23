-- Phase 1: rooms for cleaning and children as real records.
-- Additive only: existing columns (cleaning_tasks.room, kids_tasks.child_name) are kept.

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  name text not null,
  position int not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create table public.children (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  name text not null,
  position int not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

-- A room or child that still has tasks cannot be deleted (on delete restrict).
alter table public.cleaning_tasks add column room_id uuid references public.rooms(id) on delete restrict;
alter table public.kids_tasks add column child_id uuid references public.children(id) on delete restrict;
alter table public.kids_tasks alter column child_name drop not null;

create index cleaning_tasks_room_id_idx on public.cleaning_tasks (room_id);
create index kids_tasks_child_id_idx on public.kids_tasks (child_id);

do $$
declare t text;
begin
  foreach t in array array['rooms','children'] loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "own select" on public.%I for select to authenticated using (auth.uid() = user_id)', t);
    execute format('create policy "own insert" on public.%I for insert to authenticated with check (auth.uid() = user_id)', t);
    execute format('create policy "own update" on public.%I for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
    execute format('create policy "own delete" on public.%I for delete to authenticated using (auth.uid() = user_id)', t);
  end loop;
end $$;

-- Carry over any existing free-text rooms and child names (the app currently has no data,
-- but this keeps the migration safe if rows exist).
insert into public.rooms (user_id, name)
  select distinct user_id, btrim(room) from public.cleaning_tasks
  where room is not null and btrim(room) <> ''
  on conflict (user_id, name) do nothing;
update public.cleaning_tasks c set room_id = r.id
  from public.rooms r
  where c.room_id is null and r.user_id = c.user_id and r.name = btrim(c.room);

insert into public.children (user_id, name)
  select distinct user_id, btrim(child_name) from public.kids_tasks
  where child_name is not null and btrim(child_name) <> ''
  on conflict (user_id, name) do nothing;
update public.kids_tasks k set child_id = ch.id
  from public.children ch
  where k.child_id is null and ch.user_id = k.user_id and ch.name = btrim(k.child_name);
