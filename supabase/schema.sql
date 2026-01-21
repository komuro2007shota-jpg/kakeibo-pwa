create extension if not exists "pgcrypto";

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  amount integer not null,
  type text not null check (type in ('expense', 'income')),
  purpose text not null default 'consumption' check (purpose in ('consumption', 'waste', 'investment')),
  category text not null,
  note text,
  created_at timestamp with time zone default now()
);

alter table public.transactions enable row level security;

create policy "Users can view own transactions"
  on public.transactions
  for select
  using (auth.uid() = user_id);

create policy "Users can insert own transactions"
  on public.transactions
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update own transactions"
  on public.transactions
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own transactions"
  on public.transactions
  for delete
  using (auth.uid() = user_id);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  created_at timestamp with time zone default now(),
  unique (user_id, name)
);

alter table public.categories enable row level security;

create policy "Users can view own categories"
  on public.categories
  for select
  using (auth.uid() = user_id);

create policy "Users can insert own categories"
  on public.categories
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update own categories"
  on public.categories
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own categories"
  on public.categories
  for delete
  using (auth.uid() = user_id);

create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  month text not null,
  category text not null,
  amount integer not null,
  created_at timestamp with time zone default now(),
  unique (user_id, month, category)
);

alter table public.budgets enable row level security;

create policy "Users can view own budgets"
  on public.budgets
  for select
  using (auth.uid() = user_id);

create policy "Users can insert own budgets"
  on public.budgets
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update own budgets"
  on public.budgets
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own budgets"
  on public.budgets
  for delete
  using (auth.uid() = user_id);

create table if not exists public.savings_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  target_amount integer not null,
  current_amount integer not null default 0,
  due_date date,
  created_at timestamp with time zone default now()
);

alter table public.savings_goals enable row level security;

create policy "Users can view own savings goals"
  on public.savings_goals
  for select
  using (auth.uid() = user_id);

create policy "Users can insert own savings goals"
  on public.savings_goals
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update own savings goals"
  on public.savings_goals
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own savings goals"
  on public.savings_goals
  for delete
  using (auth.uid() = user_id);
