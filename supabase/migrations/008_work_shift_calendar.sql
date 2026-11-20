begin;
-- Nullable links preserve manually planned journeys and all existing records.
alter table public.schedule_entries add column shift_id uuid, add column commute_leg text;
alter table public.schedule_entries add constraint commute_shift_owner
 foreign key(shift_id,user_id) references public.schedule_entries(id,user_id) on delete cascade;
alter table public.schedule_entries add constraint commute_link
 check((shift_id is null and commute_leg is null) or (shift_id is not null and commute_leg is not null and commute_leg in ('outbound','return') and kind='commute'));
create unique index one_journey_per_shift_leg on public.schedule_entries(shift_id,commute_leg) where shift_id is not null;

create function public.validate_shift_link() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.shift_id is not null and not exists(select 1 from public.schedule_entries where id=new.shift_id and user_id=new.user_id and kind='shift') then
  raise exception 'Il tragitto deve appartenere a un turno dello stesso proprietario.';
 end if;
 return new;
end; $$;
create trigger validate_shift_link before insert or update of shift_id,commute_leg,kind,user_id on public.schedule_entries
 for each row execute function public.validate_shift_link();

create function public.sync_shift_commutes() returns trigger language plpgsql security invoker set search_path='' as $$
declare leg text; journey public.schedule_entries; left_edge timestamptz; right_edge timestamptz; label text; zone text;
begin
 if new.kind<>'shift' then
  if tg_op='UPDATE' and old.kind='shift' then
   if exists(select 1 from public.time_logs l join public.schedule_entries e on e.id=l.entry_id where e.shift_id=new.id) then
    raise exception 'Un tragitto ha ore registrate. Elimina prima gli intervalli per rimuovere il turno o scegliere OFF.';
   end if;
   delete from public.schedule_entries where shift_id=new.id;
  end if;
  return new;
 end if;
 -- Completion, notes and unchanged week saves preserve individually edited journeys.
 if tg_op='UPDATE' and new.kind=old.kind and new.starts_at=old.starts_at and new.ends_at=old.ends_at and new.entry_date=old.entry_date
    and (select count(*) from public.schedule_entries where shift_id=new.id)=2 then return new; end if;
 select timezone into zone from public.profiles where id=new.user_id;
 zone=coalesce(zone,'Europe/Rome');
 foreach leg in array array['outbound','return'] loop
  left_edge=case when leg='outbound' then new.starts_at-interval '30 minutes' else new.ends_at end;
  right_edge=left_edge+interval '30 minutes';
  label=case when leg='outbound' then 'Tragitto · andata' else 'Tragitto · ritorno' end;
  select * into journey from public.schedule_entries where shift_id=new.id and commute_leg=leg for update;
  if not found then
   -- Adopt an exact legacy seed journey; never remove unrelated calendar entries.
   select * into journey from public.schedule_entries where user_id=new.user_id and shift_id is null and kind='commute'
    and title=label and starts_at=left_edge and ends_at=right_edge order by created_at,id limit 1 for update;
  end if;
  if journey.id is not null then
   update public.schedule_entries set shift_id=new.id,commute_leg=leg,entry_date=(left_edge at time zone zone)::date,
    starts_at=left_edge,ends_at=right_edge,planned_minutes=30 where id=journey.id;
  else
   insert into public.schedule_entries(user_id,title,category,kind,entry_date,starts_at,ends_at,planned_minutes,shift_id,commute_leg)
    values(new.user_id,label,'personal','commute',(left_edge at time zone zone)::date,left_edge,right_edge,30,new.id,leg);
  end if;
 end loop;
 return new;
end; $$;
create trigger shift_calendar_journeys after insert or update of kind,starts_at,ends_at,entry_date on public.schedule_entries
 for each row execute function public.sync_shift_commutes();
revoke all on function public.validate_shift_link(),public.sync_shift_commutes() from public,anon,authenticated;

-- Link existing shifts and journeys, retaining IDs, notes, completion and actual logs.
update public.schedule_entries set starts_at=starts_at where kind='shift';

create or replace function public.save_agenda_shifts(changes jsonb) returns void language plpgsql security invoker set search_path='' as $$
declare owner_id uuid:=auth.uid(); item jsonb; existing public.schedule_entries; begin
 if owner_id is null then raise exception 'Authentication required'; end if;
 perform id from public.profiles where id=owner_id for update;
 for item in select value from jsonb_array_elements(changes) loop
  select * into existing from public.schedule_entries where id=(item->>'id')::uuid for update;
  if found then
   if item->>'expected_updated_at' is null or existing.updated_at<>(item->>'expected_updated_at')::timestamptz then raise exception 'Turno modificato altrove. Aggiorna i dati prima di salvare.'; end if;
   if existing.kind not in ('shift','off') then raise exception 'Voce non valida per i turni.'; end if;
   if (item->>'remove')::boolean then
    if exists(select 1 from public.time_logs l join public.schedule_entries e on e.id=l.entry_id where e.id=existing.id or e.shift_id=existing.id) then
     raise exception 'Il turno o un tragitto ha ore registrate. Elimina prima gli intervalli.';
    end if;
    delete from public.schedule_entries where id=existing.id;
   else
    if item->>'kind' not in ('shift','off') then raise exception 'Tipo di turno non valido.'; end if;
    update public.schedule_entries set title=item->>'title',category='work',kind=item->>'kind',entry_date=(item->>'entry_date')::date,starts_at=(item->>'starts_at')::timestamptz,ends_at=(item->>'ends_at')::timestamptz,planned_minutes=(item->>'planned_minutes')::integer where id=existing.id;
   end if;
  else
   if item->>'expected_updated_at' is not null then raise exception 'Turno non trovato o non accessibile.'; end if;
   if (item->>'remove')::boolean then raise exception 'Turno non trovato.'; end if;
   if item->>'kind' not in ('shift','off') then raise exception 'Tipo di turno non valido.'; end if;
   if exists(select 1 from public.schedule_entries where user_id=owner_id and entry_date=(item->>'entry_date')::date and kind in ('shift','off')) then
    raise exception 'Esiste già un turno in questo giorno. Aggiorna i dati prima di salvare.';
   end if;
   insert into public.schedule_entries(id,user_id,title,category,kind,entry_date,starts_at,ends_at,planned_minutes)
   values((item->>'id')::uuid,owner_id,item->>'title','work',item->>'kind',(item->>'entry_date')::date,(item->>'starts_at')::timestamptz,(item->>'ends_at')::timestamptz,(item->>'planned_minutes')::integer);
  end if;
 end loop;
end; $$;

create or replace function public.seed_agenda_week(payload jsonb) returns void language plpgsql security invoker set search_path='' as $$
declare owner_id uuid:=auth.uid(); week_id uuid; item jsonb; begin
 if owner_id is null then raise exception 'Authentication required'; end if;
 insert into public.agenda_weeks(user_id,week_start) values(owner_id,(payload->>'week_start')::date)
 on conflict(user_id,week_start) do nothing returning id into week_id;
 if week_id is null then return; end if;
 for item in select value from jsonb_array_elements(payload->'entries') loop
  if item->>'kind'='commute' then continue; end if; -- The shift trigger creates both journeys.
  insert into public.schedule_entries(id,user_id,title,category,kind,entry_date,starts_at,ends_at,planned_minutes,project_id,notes)
  values((item->>'id')::uuid,owner_id,item->>'title',item->>'category',item->>'kind',(item->>'entry_date')::date,(item->>'starts_at')::timestamptz,(item->>'ends_at')::timestamptz,(item->>'planned_minutes')::integer,(item->>'project_id')::uuid,coalesce(item->>'notes',''));
 end loop;
 for item in select value from jsonb_array_elements(payload->'goals') loop
  insert into public.weekly_goals(id,user_id,title,week_start,category,unit,target,stretch_target,project_id)
  values((item->>'id')::uuid,owner_id,item->>'title',(payload->>'week_start')::date,item->>'category',item->>'unit',(item->>'target')::integer,(item->>'stretch_target')::integer,(item->>'project_id')::uuid);
 end loop;
end; $$;
notify pgrst,'reload schema';
commit;
