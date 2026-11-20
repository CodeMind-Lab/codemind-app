begin;
-- Durable open intervals; recorded hours remain closed, editable time_logs.
create table public.agenda_timers (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null unique references public.profiles(id) on delete cascade,
 entry_id uuid not null, started_at timestamptz not null default clock_timestamp(),
 created_at timestamptz not null default clock_timestamp(),
 foreign key(entry_id,user_id) references public.schedule_entries(id,user_id) on delete cascade
);
alter table public.time_logs add column source_timer_id uuid;
create unique index logs_timer_once on public.time_logs(user_id,source_timer_id) where source_timer_id is not null;
create table public.agenda_week_preparations (
 id uuid primary key, user_id uuid not null references public.profiles(id) on delete cascade,
 result jsonb not null, created_at timestamptz not null default clock_timestamp()
);
do $$declare t text;begin
 foreach t in array array['agenda_timers','agenda_week_preparations'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
  execute format('grant select,insert,delete on public.%I to authenticated',t);
  execute format('create policy own_select on public.%I for select to authenticated using(user_id=(select auth.uid()))',t);
  execute format('create policy own_insert on public.%I for insert to authenticated with check(user_id=(select auth.uid()))',t);
  execute format('create policy own_delete on public.%I for delete to authenticated using(user_id=(select auth.uid()))',t);
 end loop;
end;$$;
create function public.validate_agenda_timer() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 perform id from public.profiles where id=new.user_id for update;
 if not exists(select 1 from public.schedule_entries where id=new.entry_id and user_id=new.user_id and kind<>'off' and entry_date is not null and not is_completed) then raise exception 'Pianifica o riapri l’attività prima di iniziare.';end if;
 if new.started_at>clock_timestamp()+interval '1 minute' then raise exception 'L’inizio non può essere nel futuro.';end if;
 return new;
end;$$;
create trigger timer_valid before insert on public.agenda_timers for each row execute function public.validate_agenda_timer();
create function public.protect_running_agenda() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if exists(select 1 from public.agenda_timers where entry_id=old.id) and
   (tg_op='DELETE' or new.kind='off' or new.entry_date is null or new.is_completed) then
  raise exception 'Termina il timer prima di completare o eliminare l’impegno.';
 end if;
 return case when tg_op='DELETE' then old else new end;
end;$$;
create trigger protect_timer before update or delete on public.schedule_entries for each row execute function public.protect_running_agenda();
create function public.start_agenda_timer(event_id uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
declare owner_id uuid:=auth.uid(); running public.agenda_timers;begin
 if owner_id is null then raise exception 'Authentication required';end if;
 perform id from public.profiles where id=owner_id for update;
 select * into running from public.agenda_timers where user_id=owner_id;
 if found then
  if running.entry_id=event_id then return to_jsonb(running);end if;
  raise exception 'Un’altra attività è in corso. Termina il suo timer prima di iniziare.';
 end if;
 insert into public.agenda_timers(user_id,entry_id) values(owner_id,event_id) returning * into running;
 return to_jsonb(running);
end;$$;
create function public.stop_agenda_timer(timer_id uuid, finish_at timestamptz, begin_at timestamptz default null, log_notes text default '') returns jsonb language plpgsql security invoker set search_path='' as $$
declare owner_id uuid:=auth.uid(); running public.agenda_timers; recorded public.time_logs;first_at timestamptz;begin
 if owner_id is null then raise exception 'Authentication required';end if;
 perform id from public.profiles where id=owner_id for update;
 select * into recorded from public.time_logs where user_id=owner_id and source_timer_id=timer_id;
 if found then return to_jsonb(recorded);end if;
 select * into running from public.agenda_timers where id=timer_id and user_id=owner_id;
 if not found then raise exception 'Timer non trovato. Aggiorna i dati.';end if;
 first_at=coalesce(begin_at,running.started_at);
 if finish_at is null or first_at is null or finish_at<=first_at or finish_at>first_at+interval '24 hours' or finish_at<first_at+interval '1 minute' then raise exception 'Inserisci un intervallo di almeno un minuto, entro 24 ore.';end if;
 if finish_at>clock_timestamp()+interval '1 minute' then raise exception 'La fine non può essere nel futuro.';end if;
 insert into public.time_logs(user_id,entry_id,started_at,ended_at,notes,source_timer_id) values(owner_id,running.entry_id,first_at,finish_at,coalesce(log_notes,''),timer_id) returning * into recorded;
 delete from public.agenda_timers where id=timer_id and user_id=owner_id;
 return to_jsonb(recorded);
end;$$;
-- One transaction prepares activities, goals and new work presets. Retrying a
-- successful request returns its receipt, even after a lost network response.
create function public.agenda_wall_instant(wall timestamp,tz text) returns timestamptz language plpgsql security invoker set search_path='' as $$
declare initial timestamptz:=wall at time zone tz;result timestamptz;begin
 select min(candidate) into result from (
  select (wall at time zone 'UTC')-((probe at time zone tz)-(probe at time zone 'UTC')) as candidate
  from (values(initial-interval '36 hours'),(initial),(initial+interval '36 hours')) offsets(probe)
 ) candidates where candidate at time zone tz=wall;
 if result is null then raise exception 'Un orario copiato non esiste nel fuso scelto (cambio ora).';end if;
 return result;
end;$$;
revoke all on function public.agenda_wall_instant(timestamp,text) from public,anon;
grant execute on function public.agenda_wall_instant(timestamp,text) to authenticated;
create function public.prepare_agenda_week(payload jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare owner_id uuid:=auth.uid(); request_id uuid:=(payload->>'request_id')::uuid;source_week date:=(payload->>'source_week')::date;target_week date:=(payload->>'target_week')::date;
 tz text;delta integer;item jsonb;s public.schedule_entries;g public.weekly_goals;copied_date date;first_at timestamptz;last_at timestamptz;first_wall timestamp;last_wall timestamp;result jsonb;activity_count integer:=0;goal_count integer:=0;shift_count integer:=0;skip_count integer:=0;changes jsonb:='[]';preset text;begin
 if owner_id is null then raise exception 'Authentication required';end if;
 select timezone into tz from public.profiles where id=owner_id for update;
 select p.result into result from public.agenda_week_preparations p where p.id=request_id and p.user_id=owner_id;
 if found then return result;end if;
 if source_week is null or target_week is null or source_week=target_week or extract(isodow from source_week)<>1 or extract(isodow from target_week)<>1 or request_id is null then raise exception 'Settimane non valide.';end if;
 if jsonb_typeof(payload->'entries') is distinct from 'array' or jsonb_typeof(payload->'goals') is distinct from 'array' or jsonb_typeof(payload->'shifts') is distinct from 'array' or jsonb_array_length(payload->'entries')>300 or jsonb_array_length(payload->'goals')>100 or jsonb_array_length(payload->'shifts')>7 then raise exception 'Voci non valide.';end if;
 delta=target_week-source_week;
 for item in select value from jsonb_array_elements(payload->'entries') loop
  select * into s from public.schedule_entries where id=(item->>'id')::uuid and user_id=owner_id;
  if not found or s.kind<>'activity' or s.category='work' or s.entry_date is null or s.entry_date<source_week or s.entry_date>source_week+6 or s.updated_at is distinct from (item->>'expected_updated_at')::timestamptz then raise exception 'Un impegno sorgente è cambiato. Aggiorna i dati.';end if;
  copied_date=s.entry_date+delta;first_at=null;last_at=null;
  if s.starts_at is not null then
   first_wall=(s.starts_at at time zone tz)+delta*interval '1 day';last_wall=(s.ends_at at time zone tz)+delta*interval '1 day';
   first_at=public.agenda_wall_instant(first_wall,tz);last_at=public.agenda_wall_instant(last_wall,tz);
   if first_at at time zone tz<>first_wall or last_at at time zone tz<>last_wall then raise exception 'Un orario copiato non esiste nel fuso scelto (cambio ora).';end if;
  end if;
  if exists(select 1 from public.schedule_entries e where e.user_id=owner_id and e.kind='activity' and e.title=s.title and e.category=s.category and e.entry_date=copied_date and e.starts_at is not distinct from first_at and e.ends_at is not distinct from last_at and e.project_id is not distinct from s.project_id) then skip_count=skip_count+1;continue;end if;
  insert into public.schedule_entries(user_id,title,category,kind,entry_date,starts_at,ends_at,planned_minutes,project_id,notes) values(owner_id,s.title,s.category,'activity',copied_date,first_at,last_at,case when first_at is null then s.planned_minutes else round(extract(epoch from(last_at-first_at))/60)::integer end,s.project_id,s.notes);
  activity_count=activity_count+1;
 end loop;
 for item in select value from jsonb_array_elements(payload->'goals') loop
  select * into g from public.weekly_goals where id=(item->>'id')::uuid and user_id=owner_id and week_start=source_week;
  if not found or g.updated_at is distinct from (item->>'expected_updated_at')::timestamptz then raise exception 'Un obiettivo sorgente è cambiato. Aggiorna i dati.';end if;
  if exists(select 1 from public.weekly_goals x where x.user_id=owner_id and x.week_start=target_week and x.title=g.title and x.category=g.category and x.unit=g.unit and x.project_id is not distinct from g.project_id) then skip_count=skip_count+1;continue;end if;
  insert into public.weekly_goals(user_id,week_start,title,category,unit,target,stretch_target,project_id) values(owner_id,target_week,g.title,g.category,g.unit,g.target,g.stretch_target,g.project_id);goal_count=goal_count+1;
 end loop;
 if coalesce((payload->>'default_goals')::boolean,false) then
  for item in select value from jsonb_array_elements('[{"title":"Studio","category":"study","unit":"minutes","target":480,"stretch_target":480},{"title":"Palestra","category":"gym","unit":"sessions","target":2,"stretch_target":3}]'::jsonb) loop
   if exists(select 1 from public.weekly_goals x where x.user_id=owner_id and x.week_start=target_week and x.title=item->>'title' and x.category=item->>'category' and x.unit=item->>'unit' and x.project_id is null) then skip_count=skip_count+1;continue;end if;
   insert into public.weekly_goals(user_id,week_start,title,category,unit,target,stretch_target) values(owner_id,target_week,item->>'title',item->>'category',item->>'unit',(item->>'target')::integer,(item->>'stretch_target')::integer);goal_count=goal_count+1;
  end loop;
 end if;
 for item in select value from jsonb_array_elements(payload->'shifts') loop
  copied_date=(item->>'date')::date;preset=item->>'preset';
  if copied_date is null or copied_date<target_week or copied_date>target_week+6 or preset not in ('apertura','chiusura','notte','off') or preset is null then raise exception 'Turno non valido.';end if;
  if exists(select 1 from public.schedule_entries where user_id=owner_id and entry_date=copied_date and kind in ('shift','off')) or exists(select 1 from jsonb_array_elements(changes) x where (x->>'entry_date')::date=copied_date) then raise exception 'Un turno è già presente: aggiorna l’anteprima.';end if;
  first_at=null;last_at=null;
  if preset<>'off' then
   first_at=(copied_date::timestamp+case preset when 'apertura' then interval '7 hours 30 minutes' when 'chiusura' then interval '15 hours 30 minutes' else interval '23 hours 30 minutes' end) at time zone tz;
   last_at=((copied_date+case when preset='notte' then 1 else 0 end)::timestamp+case preset when 'apertura' then interval '15 hours 30 minutes' when 'chiusura' then interval '23 hours 30 minutes' else interval '7 hours 30 minutes' end) at time zone tz;
  end if;
  changes=changes||jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'title',case preset when 'off' then 'Giorno OFF' when 'apertura' then 'Lavoro · Apertura' when 'chiusura' then 'Lavoro · Chiusura' else 'Lavoro · Notte' end,'kind',case when preset='off' then 'off' else 'shift' end,'entry_date',copied_date,'starts_at',first_at,'ends_at',last_at,'planned_minutes',case when first_at is null then 0 else round(extract(epoch from(last_at-first_at))/60)::integer end,'remove',false));shift_count=shift_count+1;
 end loop;
 perform public.save_agenda_shifts(changes);
 result=jsonb_build_object('activities',activity_count,'goals',goal_count,'shifts',shift_count,'skipped',skip_count);
 insert into public.agenda_week_preparations(id,user_id,result) values(request_id,owner_id,result);
 return result;
end;$$;
revoke all on function public.start_agenda_timer(uuid),public.stop_agenda_timer(uuid,timestamptz,timestamptz,text),public.prepare_agenda_week(jsonb) from public,anon;
grant execute on function public.start_agenda_timer(uuid),public.stop_agenda_timer(uuid,timestamptz,timestamptz,text),public.prepare_agenda_week(jsonb) to authenticated;
revoke all on function public.validate_agenda_timer(),public.protect_running_agenda() from public,anon,authenticated;
notify pgrst,'reload schema';
commit;
