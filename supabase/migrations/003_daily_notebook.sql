begin;
create table public.daily_todos (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles(id) on delete cascade,
 todo_date date not null,
 title text not null check(length(btrim(title)) between 1 and 200),
 is_completed boolean not null default false,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index daily_todos_owner_date on public.daily_todos(user_id,todo_date);
create table public.daily_journal (
 id uuid not null default gen_random_uuid() unique,
 user_id uuid not null references public.profiles(id) on delete cascade,
 entry_date date not null,
 body text not null default '' check(length(body)<=30000),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 primary key(user_id,entry_date)
);
alter table public.daily_todos enable row level security;
alter table public.daily_journal enable row level security;
revoke all on public.daily_todos,public.daily_journal from anon,authenticated;
grant select,insert,update,delete on public.daily_todos,public.daily_journal to authenticated;
create policy own_records on public.daily_todos for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy own_records on public.daily_journal for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create trigger touch_timestamp before update on public.daily_todos for each row execute function public.touch_updated_at();
create trigger touch_timestamp before update on public.daily_journal for each row execute function public.touch_updated_at();
commit;
