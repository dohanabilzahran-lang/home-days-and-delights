create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  title text not null,
  amount numeric(12,2) not null,
  kind text not null default 'expense',
  category text not null default 'other',
  occurred_on date not null default current_date,
  created_at timestamptz not null default now()
);
create table public.skincare_steps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  title text not null,
  product text,
  period text not null default 'morning',
  position int not null default 0,
  last_done date,
  created_at timestamptz not null default now()
);
create table public.cleaning_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  title text not null,
  room text,
  every_days int not null default 7,
  last_done date,
  created_at timestamptz not null default now()
);
create table public.kids_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  child_name text not null,
  title text not null,
  at_time time,
  last_done date,
  created_at timestamptz not null default now()
);
create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  title text not null,
  ingredients text not null default '',
  steps text not null default '',
  minutes int,
  created_at timestamptz not null default now()
);

do $$
declare t text;
begin
  foreach t in array array['transactions','skincare_steps','cleaning_tasks','kids_tasks','recipes'] loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "own select" on public.%I for select to authenticated using (auth.uid() = user_id)', t);
    execute format('create policy "own insert" on public.%I for insert to authenticated with check (auth.uid() = user_id)', t);
    execute format('create policy "own update" on public.%I for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
    execute format('create policy "own delete" on public.%I for delete to authenticated using (auth.uid() = user_id)', t);
  end loop;
end $$;