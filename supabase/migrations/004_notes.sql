begin;
create table public.notes (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles(id) on delete cascade,
 title text not null check(length(btrim(title)) between 1 and 200),
 body text not null default '' check(length(body)<=30000),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index notes_owner_updated on public.notes(user_id,updated_at desc);
alter table public.notes enable row level security;
revoke all on public.notes from anon,authenticated;
grant select,insert,update,delete on public.notes to authenticated;
create policy own_records on public.notes for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create trigger touch_timestamp before update on public.notes for each row execute function public.touch_updated_at();
commit;
