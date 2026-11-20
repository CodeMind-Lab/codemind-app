begin;
-- Work shifts and OFF days are schedule entries (kind='shift'/'off').
create table public.agenda_weeks (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
 week_start date not null check(extract(isodow from week_start)=1),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(user_id,week_start)
);
create table public.schedule_entries (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
 title text not null check(length(btrim(title)) between 1 and 200),
 category text not null check(category in ('work','study','diliberto','casa','gym','sleep','relax','personal')),
 kind text not null default 'activity' check(kind in ('activity','shift','off','commute')),
 entry_date date, starts_at timestamptz, ends_at timestamptz,
 planned_minutes integer not null default 0 check(planned_minutes between 0 and 1440),
 project_id uuid, notes text not null default '' check(length(notes)<=5000),
 is_completed boolean not null default false, completed_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(id,user_id),
 foreign key(project_id,user_id) references public.projects(id,user_id) on delete set null (project_id),
 check((starts_at is null and ends_at is null) or (entry_date is not null and ends_at>starts_at and ends_at<=starts_at+interval '24 hours' and planned_minutes=round(extract(epoch from (ends_at-starts_at))/60))),
 check((starts_at is null)=(ends_at is null)),
 check(kind<>'shift' or (category='work' and starts_at is not null)),
 check(kind<>'off' or (category='work' and entry_date is not null and starts_at is null and planned_minutes=0)),
 check(not is_completed or entry_date is not null), check(is_completed=(completed_at is not null))
);
create table public.weekly_goals (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
 week_start date not null check(extract(isodow from week_start)=1), title text not null check(length(btrim(title)) between 1 and 200),
 category text not null check(category in ('work','study','diliberto','casa','gym','sleep','relax','personal')),
 unit text not null check(unit in ('minutes','sessions')), target integer not null check(target between 1 and 10080),
 stretch_target integer not null check(stretch_target>=target and stretch_target<=10080), project_id uuid,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 foreign key(project_id,user_id) references public.projects(id,user_id) on delete set null (project_id)
);
create table public.time_logs (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade, entry_id uuid not null,
 started_at timestamptz not null, ended_at timestamptz not null,
 duration_minutes integer generated always as (round(extract(epoch from (ended_at-started_at))/60)::integer) stored,
 notes text not null default '' check(length(notes)<=2000),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 foreign key(entry_id,user_id) references public.schedule_entries(id,user_id) on delete cascade,
 check(ended_at>started_at and ended_at<=started_at+interval '24 hours')
);
create index agenda_owner_date on public.schedule_entries(user_id,entry_date);
create index agenda_owner_interval on public.schedule_entries(user_id,starts_at,ends_at);
create index agenda_project_fk on public.schedule_entries(project_id);
create index goals_owner_week on public.weekly_goals(user_id,week_start);
create index goals_project_fk on public.weekly_goals(project_id);
create index logs_owner_interval on public.time_logs(user_id,started_at,ended_at);
create index logs_entry_fk on public.time_logs(entry_id);
create function public.normalize_agenda_entry() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.is_completed then
  if tg_op='UPDATE' and old.is_completed then new.completed_at=old.completed_at; else new.completed_at=clock_timestamp(); end if;
 else new.completed_at=null; end if;
 if (new.kind='off' or new.entry_date is null) and exists(select 1 from public.time_logs where entry_id=new.id) then
  raise exception 'Elimina gli intervalli registrati prima di rimuovere la data o scegliere OFF.';
 end if;
 return new;
end; $$;
create trigger agenda_completion before insert or update on public.schedule_entries for each row execute function public.normalize_agenda_entry();
-- Serialize time recording per owner, preventing concurrent double counting.
create function public.validate_agenda_log() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 perform id from public.profiles where id=new.user_id for update;
 if not exists(select 1 from public.schedule_entries where id=new.entry_id and user_id=new.user_id and kind<>'off' and entry_date is not null) then raise exception 'Pianifica una voce valida prima di registrare il tempo.'; end if;
 if tg_op='UPDATE' and new.entry_id<>old.entry_id then raise exception 'Il collegamento all’attività non può cambiare.'; end if;
 if exists(select 1 from public.time_logs where user_id=new.user_id and id<>new.id and started_at<new.ended_at and ended_at>new.started_at) then raise exception 'Questo intervallo si sovrappone a ore già registrate.'; end if;
 return new;
end; $$;
create trigger log_interval before insert or update on public.time_logs for each row execute function public.validate_agenda_log();
do $$declare t text; begin
 foreach t in array array['agenda_weeks','schedule_entries','weekly_goals','time_logs'] loop
  execute format('create trigger touch_timestamp before update on public.%I for each row execute function public.touch_updated_at()',t);
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from anon,authenticated',t);
  execute format('grant select,insert,update,delete on public.%I to authenticated',t);
  execute format('create policy own_select on public.%I for select to authenticated using(user_id=(select auth.uid()))',t);
  execute format('create policy own_insert on public.%I for insert to authenticated with check(user_id=(select auth.uid()))',t);
  execute format('create policy own_update on public.%I for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()))',t);
  execute format('create policy own_delete on public.%I for delete to authenticated using(user_id=(select auth.uid()))',t);
 end loop;
end; $$;
-- One atomic, idempotent initial-week import; no demo data imported on sign-in.
create function public.seed_agenda_week(payload jsonb) returns void language plpgsql security invoker set search_path='' as $$
declare owner_id uuid:=auth.uid(); week_id uuid; item jsonb; begin
 if owner_id is null then raise exception 'Authentication required'; end if;
 insert into public.agenda_weeks(user_id,week_start) values(owner_id,(payload->>'week_start')::date)
 on conflict(user_id,week_start) do nothing returning id into week_id;
 if week_id is null then return; end if;
 for item in select value from jsonb_array_elements(payload->'entries') loop
  insert into public.schedule_entries(id,user_id,title,category,kind,entry_date,starts_at,ends_at,planned_minutes,project_id,notes)
  values((item->>'id')::uuid,owner_id,item->>'title',item->>'category',item->>'kind',(item->>'entry_date')::date,(item->>'starts_at')::timestamptz,(item->>'ends_at')::timestamptz,(item->>'planned_minutes')::integer,(item->>'project_id')::uuid,coalesce(item->>'notes',''));
 end loop;
 for item in select value from jsonb_array_elements(payload->'goals') loop
  insert into public.weekly_goals(id,user_id,title,week_start,category,unit,target,stretch_target,project_id)
  values((item->>'id')::uuid,owner_id,item->>'title',(payload->>'week_start')::date,item->>'category',item->>'unit',(item->>'target')::integer,(item->>'stretch_target')::integer,(item->>'project_id')::uuid);
 end loop;
end; $$;
revoke all on function public.seed_agenda_week(jsonb) from public,anon;
grant execute on function public.seed_agenda_week(jsonb) to authenticated;
revoke all on function public.normalize_agenda_entry(),public.validate_agenda_log() from public,anon,authenticated;
create function public.save_agenda_shifts(changes jsonb) returns void language plpgsql security invoker set search_path='' as $$
declare owner_id uuid:=auth.uid(); item jsonb; existing public.schedule_entries; begin
 if owner_id is null then raise exception 'Authentication required'; end if;
 perform id from public.profiles where id=owner_id for update;
 for item in select value from jsonb_array_elements(changes) loop
  select * into existing from public.schedule_entries where id=(item->>'id')::uuid for update;
  if found then
   if item->>'expected_updated_at' is null or existing.updated_at<>(item->>'expected_updated_at')::timestamptz then raise exception 'Turno modificato altrove. Aggiorna i dati prima di salvare.'; end if;
   if existing.kind not in ('shift','off') then raise exception 'Voce non valida per i turni.'; end if;
   if (item->>'remove')::boolean then
    if exists(select 1 from public.time_logs where entry_id=existing.id) then raise exception 'Il turno ha ore registrate. Elimina prima gli intervalli.'; end if;
    delete from public.schedule_entries where id=existing.id;
   else
    if item->>'kind' not in ('shift','off') then raise exception 'Tipo di turno non valido.'; end if;
    update public.schedule_entries set title=item->>'title',category='work',kind=item->>'kind',entry_date=(item->>'entry_date')::date,starts_at=(item->>'starts_at')::timestamptz,ends_at=(item->>'ends_at')::timestamptz,planned_minutes=(item->>'planned_minutes')::integer where id=existing.id;
   end if;
  else
   if item->>'expected_updated_at' is not null then raise exception 'Turno non trovato o non accessibile.'; end if;
   if (item->>'remove')::boolean then raise exception 'Turno non trovato.'; end if;
   if item->>'kind' not in ('shift','off') then raise exception 'Tipo di turno non valido.'; end if;
   insert into public.schedule_entries(id,user_id,title,category,kind,entry_date,starts_at,ends_at,planned_minutes)
   values((item->>'id')::uuid,owner_id,item->>'title','work',item->>'kind',(item->>'entry_date')::date,(item->>'starts_at')::timestamptz,(item->>'ends_at')::timestamptz,(item->>'planned_minutes')::integer);
  end if;
 end loop;
end; $$;
revoke all on function public.save_agenda_shifts(jsonb) from public,anon;
grant execute on function public.save_agenda_shifts(jsonb) to authenticated;
commit;
