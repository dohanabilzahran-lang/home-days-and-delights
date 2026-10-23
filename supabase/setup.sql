-- Nest: full database setup for a NEW Supabase project.
-- Paste everything into Supabase → SQL Editor → New query, then click Run. Run it once.

-- ===== 0000_migration =====
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
-- ===== 0001_rooms_children =====
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

-- ===== 0002_full_organizer =====
-- Phases 2–8 in one migration, so the owner applies it with a single Lovable message.
-- Additive only. Every user-owned table gets the same four own-row RLS policies as 0000/0001.

-- ───────────── Profile ─────────────
create table public.profiles (
  user_id uuid primary key default auth.uid(),
  timezone text not null default 'Africa/Cairo',
  monthly_income numeric(12,2) not null default 0 check (monthly_income >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ───────────── Phase 2: repeating tasks ─────────────
-- History of every completion or skip. One row per task per day (no duplicates).
create table public.completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  source_type text not null check (source_type in ('cleaning','kids','skincare')),
  source_id uuid not null,
  on_date date not null,
  status text not null default 'done' check (status in ('done','skipped')),
  created_at timestamptz not null default now(),
  unique (source_type, source_id, on_date)
);
create index completions_source_idx on public.completions (source_type, source_id, on_date desc);

alter table public.cleaning_tasks
  add column snoozed_until date,
  add column checklist text[] not null default '{}',
  add column show_in_calendar boolean not null default false,
  add constraint cleaning_every_days_positive check (every_days >= 1);

-- days_of_week: null = every day; otherwise ISO weekdays 1 (Mon) … 7 (Sun).
alter table public.kids_tasks
  add column days_of_week smallint[],
  add column snoozed_until date,
  add column remind boolean not null default false,
  add column show_in_calendar boolean not null default false;

alter table public.skincare_steps
  add column days_of_week smallint[],
  add column snoozed_until date,
  add column remind_time time,
  add column show_in_calendar boolean not null default false,
  add constraint skincare_period_valid check (period in ('morning','evening'));

-- ───────────── Phase 3: budget ─────────────
alter table public.transactions
  add constraint transactions_amount_positive check (amount > 0),
  add constraint transactions_kind_valid check (kind in ('expense','income')),
  add column source text not null default 'manual' check (source in ('manual','shopping','debt'));

create table public.budget_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  month date not null check (extract(day from month) = 1),
  category text not null,
  planned numeric(12,2) not null default 0 check (planned >= 0),
  created_at timestamptz not null default now(),
  unique (user_id, month, category)
);

create table public.savings_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  name text not null,
  target numeric(12,2) not null check (target > 0),
  saved numeric(12,2) not null default 0 check (saved >= 0),
  target_date date,
  created_at timestamptz not null default now()
);

create table public.debts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  name text not null,
  total numeric(12,2) not null check (total > 0),
  monthly_payment numeric(12,2) check (monthly_payment is null or monthly_payment > 0),
  due_day smallint check (due_day between 1 and 31),
  start_date date not null default current_date,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.debt_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  debt_id uuid not null references public.debts(id) on delete cascade,
  paid_on date not null default current_date,
  amount numeric(12,2) not null check (amount > 0),
  transaction_id uuid unique references public.transactions(id) on delete set null,
  created_at timestamptz not null default now()
);
create index debt_payments_debt_idx on public.debt_payments (debt_id);

-- ───────────── Phase 4: work ─────────────
create table public.work_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  name text not null,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.work_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  project_id uuid references public.work_projects(id) on delete set null,
  kind text not null default 'task' check (kind in ('task','note','reminder')),
  title text not null,
  body text not null default '',
  status text not null default 'todo' check (status in ('todo','doing','done')),
  priority text not null default 'normal' check (priority in ('low','normal','high')),
  due_date date,
  due_time time,
  remind boolean not null default false,
  show_in_calendar boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index work_items_project_idx on public.work_items (project_id);

-- ───────────── Phase 5: recipes, meals, shopping ─────────────
alter table public.recipes
  add column kind text not null default 'full' check (kind in ('full','quick')),
  add column servings smallint check (servings is null or servings > 0);

create table public.recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  name text not null,
  quantity numeric(10,2) check (quantity is null or quantity > 0),
  unit text,
  position int not null default 0
);
create index recipe_ingredients_recipe_idx on public.recipe_ingredients (recipe_id);

create table public.meal_plan_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  on_date date not null,
  slot text not null check (slot in ('breakfast','lunch','dinner','snack','lunchbox')),
  child_id uuid references public.children(id) on delete set null,
  recipe_id uuid references public.recipes(id) on delete set null,
  title text,
  position int not null default 0,
  created_at timestamptz not null default now(),
  check (recipe_id is not null or (title is not null and btrim(title) <> ''))
);
create index meal_plan_entries_date_idx on public.meal_plan_entries (user_id, on_date);

create table public.shopping_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  name text not null,
  position int not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

-- origin 'manual' items are never removed by meal-plan changes; 'recipe' items record where they came from.
create table public.shopping_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  name text not null,
  quantity numeric(10,2) check (quantity is null or quantity > 0),
  unit text,
  category text not null default 'other',
  origin text not null default 'manual' check (origin in ('manual','recipe')),
  status text not null default 'needed' check (status in ('needed','bought')),
  estimated_price numeric(12,2) check (estimated_price is null or estimated_price >= 0),
  actual_price numeric(12,2) check (actual_price is null or actual_price > 0),
  bought_on date,
  transaction_id uuid unique references public.transactions(id) on delete set null,
  created_at timestamptz not null default now()
);
create index shopping_items_status_idx on public.shopping_items (user_id, status);

-- Last price paid per item name (lower-cased), offered as the next estimate.
create table public.item_prices (
  user_id uuid not null default auth.uid(),
  name_key text not null,
  last_price numeric(12,2) not null check (last_price > 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, name_key)
);

-- Records a shopping purchase in the budget exactly once, however often it is called.
create function public.record_purchase(p_item_id uuid, p_price numeric, p_on date)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_item public.shopping_items;
  v_tx uuid;
begin
  if p_price is null or p_price <= 0 then
    raise exception 'Price must be greater than zero';
  end if;
  select * into v_item from public.shopping_items where id = p_item_id for update;
  if not found then
    raise exception 'Item not found';
  end if;
  if v_item.transaction_id is not null then
    return v_item.transaction_id;
  end if;
  insert into public.transactions (title, amount, kind, category, occurred_on, source)
    values (v_item.name, p_price, 'expense', 'groceries', coalesce(p_on, current_date), 'shopping')
    returning id into v_tx;
  update public.shopping_items
    set status = 'bought', actual_price = p_price, bought_on = coalesce(p_on, current_date), transaction_id = v_tx
    where id = p_item_id;
  insert into public.item_prices (user_id, name_key, last_price)
    values (v_item.user_id, lower(btrim(v_item.name)), p_price)
    on conflict (user_id, name_key) do update set last_price = excluded.last_price, updated_at = now();
  return v_tx;
end $$;
grant execute on function public.record_purchase(uuid, numeric, date) to authenticated;

-- ───────────── Phase 6: calendar and notifications ─────────────
-- One-off dated items. Only these (never repeating tasks) can sync to Google.
create table public.events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  title text not null,
  notes text not null default '',
  starts_on date not null,
  start_time time,
  end_time time,
  work_item_id uuid unique references public.work_items(id) on delete cascade,
  remind_minutes int check (remind_minutes is null or remind_minutes >= 0),
  sync_to_google boolean not null default false,
  google_event_id text,
  google_etag text,
  google_updated_at timestamptz,
  sync_state text not null default 'local'
    check (sync_state in ('local','pending','synced','conflict','error','delete_requested_by_google','delete_requested_by_nest')),
  sync_error text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, google_event_id)
);
create index events_date_idx on public.events (user_id, starts_on);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  title text not null,
  body text not null default '',
  url text,
  dedupe_key text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  pushed_at timestamptz,
  unique (user_id, dedupe_key)
);

-- ───────────── Phase 7: push ─────────────
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  device_label text,
  created_at timestamptz not null default now(),
  last_ok_at timestamptz
);

-- ───────────── Own-row security for every new user table ─────────────
do $$
declare t text;
begin
  foreach t in array array[
    'profiles','completions','budget_plans','savings_goals','debts','debt_payments',
    'work_projects','work_items','recipe_ingredients','meal_plan_entries','shopping_categories',
    'shopping_items','item_prices','events','notifications','push_subscriptions'
  ] loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "own select" on public.%I for select to authenticated using (auth.uid() = user_id)', t);
    execute format('create policy "own insert" on public.%I for insert to authenticated with check (auth.uid() = user_id)', t);
    execute format('create policy "own update" on public.%I for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
    execute format('create policy "own delete" on public.%I for delete to authenticated using (auth.uid() = user_id)', t);
  end loop;
end $$;

-- ───────────── Phase 8: Google Calendar (server only) ─────────────
-- Tokens never reach the browser: RLS is on and there are no policies for the authenticated role.
create table public.google_connections (
  user_id uuid primary key,
  calendar_id text,
  refresh_token text,
  access_token text,
  access_expires_at timestamptz,
  sync_token text,
  status text not null default 'connected' check (status in ('connected','needs_reconnect','disconnected')),
  last_sync_at timestamptz,
  last_error text,
  created_at timestamptz not null default now()
);
alter table public.google_connections enable row level security;
grant all on public.google_connections to service_role;

-- What the browser may know about the connection, without any token.
create function public.google_status()
returns table (status text, calendar_id text, last_sync_at timestamptz, last_error text)
language sql
security definer
set search_path = public
stable
as $$
  select g.status, g.calendar_id, g.last_sync_at, g.last_error
  from public.google_connections g where g.user_id = auth.uid();
$$;
revoke all on function public.google_status() from public;
grant execute on function public.google_status() to authenticated;

-- Server configuration (Google client, VAPID keys, cron secret). Service role only.
create table public.app_config (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
alter table public.app_config enable row level security;
grant all on public.app_config to service_role;

