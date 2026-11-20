begin;

create table public.daily_focus (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  task_id uuid not null,
  focus_date date not null,
  slot smallint not null check(slot between 1 and 3),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key(task_id,user_id) references public.tasks(id,user_id) on delete cascade,
  unique(user_id,focus_date,slot),
  unique(user_id,focus_date,task_id)
);
create index daily_focus_task on public.daily_focus(task_id);
alter table public.daily_focus enable row level security;
revoke all on public.daily_focus from anon,authenticated;
grant select,insert,delete on public.daily_focus to authenticated;
create policy own_select on public.daily_focus for select to authenticated using(user_id=(select auth.uid()));
create policy own_insert on public.daily_focus for insert to authenticated with check(user_id=(select auth.uid()));
create policy own_delete on public.daily_focus for delete to authenticated using(user_id=(select auth.uid()));

-- Serialize assignments per owner: two devices cannot claim the same free slot.
create function public.set_daily_focus(selected_task uuid, selected_date date, pinned boolean)
returns void language plpgsql security invoker set search_path='' as $$
declare owner_id uuid:=auth.uid(); available_slot smallint;
begin
 if owner_id is null then raise exception 'Authentication required'; end if;
 if selected_date is null or pinned is null then raise exception 'Data e azione richieste.'; end if;
 perform id from public.profiles where id=owner_id for update;
 if not found then raise exception 'Profilo non trovato.'; end if;
 if not pinned then
  delete from public.daily_focus where user_id=owner_id and task_id=selected_task and focus_date=selected_date;
  return;
 end if;
 if not exists(select 1 from public.tasks t join public.projects p on p.id=t.project_id
   where t.id=selected_task and t.user_id=owner_id and t.status<>'completed' and p.status<>'archived')
 then raise exception 'Seleziona un’attività aperta di un progetto non archiviato.'; end if;
 if exists(select 1 from public.daily_focus where user_id=owner_id and task_id=selected_task and focus_date=selected_date) then return; end if;
 delete from public.daily_focus f where f.user_id=owner_id and f.focus_date=selected_date
 and exists(select 1 from public.tasks t join public.projects p on p.id=t.project_id where t.id=f.task_id and p.status='archived');
 select n into available_slot from generate_series(1,3) n
 where not exists(select 1 from public.daily_focus where user_id=owner_id and focus_date=selected_date and slot=n)
 order by n limit 1;
 if available_slot is null then raise exception 'Hai già scelto tre priorità. Rimuovine una prima di aggiungerne un’altra.'; end if;
 insert into public.daily_focus(user_id,task_id,focus_date,slot) values(owner_id,selected_task,selected_date,available_slot);
end; $$;
revoke all on function public.set_daily_focus(uuid,date,boolean) from public,anon;
grant execute on function public.set_daily_focus(uuid,date,boolean) to authenticated;
commit;
