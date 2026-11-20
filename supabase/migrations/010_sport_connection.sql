begin;
-- Store only workout summaries; Forma's database and credentials stay separate.
create table public.sport_connections (
 id uuid primary key default gen_random_uuid(), user_id uuid not null unique references public.profiles(id) on delete cascade,
 source_id text not null check(source_id ~ '^[a-zA-Z0-9_-]{8,100}$'),
 snapshot jsonb not null check(jsonb_typeof(snapshot)='object' and octet_length(snapshot::text)<=1500000),
 synced_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.schedule_entries add column sport_session_key text check(sport_session_key is null or (length(sport_session_key)<=250 and category='gym'));
create unique index sport_session_once on public.schedule_entries(user_id,sport_session_key) where sport_session_key is not null;
create table public.sport_imports (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
 source_key text not null check(length(source_key) between 1 and 250), entry_id uuid,
 created_at timestamptz not null default now(), unique(user_id,source_key),
 foreign key(entry_id,user_id) references public.schedule_entries(id,user_id) on delete set null (entry_id)
);
create index sport_import_entry_fk on public.sport_imports(entry_id);
alter table public.sport_connections enable row level security;
alter table public.sport_imports enable row level security;
revoke all on public.sport_connections,public.sport_imports from public,anon,authenticated;
grant select,insert,update,delete on public.sport_connections to authenticated;
grant select,insert on public.sport_imports to authenticated;
create policy own_select on public.sport_connections for select to authenticated using(user_id=(select auth.uid()));
create policy own_insert on public.sport_connections for insert to authenticated with check(user_id=(select auth.uid()));
create policy own_update on public.sport_connections for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy own_delete on public.sport_connections for delete to authenticated using(user_id=(select auth.uid()));
create policy own_select on public.sport_imports for select to authenticated using(user_id=(select auth.uid()));
create policy own_insert on public.sport_imports for insert to authenticated with check(user_id=(select auth.uid()));
create trigger touch_timestamp before update on public.sport_connections for each row execute function public.touch_updated_at();
create or replace function public.save_sport_snapshot(payload jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare owner_id uuid:=auth.uid(); saved public.sport_connections; expected_id uuid:=nullif(payload->>'connection_id','')::uuid;
begin
 if owner_id is null then raise exception 'Authentication required'; end if;
 perform id from public.profiles where id=owner_id for update;
 if coalesce(payload->>'version','')<>'1' or jsonb_typeof(payload->'workouts')<>'array' or jsonb_typeof(payload->'plans')<>'array' or coalesce(jsonb_array_length(payload->'workouts'),2001)>2000 or coalesce(jsonb_array_length(payload->'plans'),8)>7 then raise exception 'Riepilogo Forma non valido.'; end if;
 select * into saved from public.sport_connections where user_id=owner_id;
 if saved.id is distinct from expected_id then raise exception 'Il collegamento è cambiato. Aggiorna i dati e riprova.'; end if;
 if exists(select 1 from public.sport_connections where user_id=owner_id and source_id<>payload->>'source_id') then raise exception 'Questo archivio Forma è diverso da quello collegato.'; end if;
 insert into public.sport_connections(user_id,source_id,snapshot) values(owner_id,payload->>'source_id',payload-'connection_id')
 on conflict(user_id) do update set snapshot=excluded.snapshot,synced_at=clock_timestamp() returning * into saved;
 return to_jsonb(saved);
end; $$;
create function public.import_sport_agenda(payload jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare owner_id uuid:=auth.uid(); snap jsonb; source text; item jsonb; workout jsonb; entry public.schedule_entries; date_value date; done boolean; key_value text; imported integer:=0; skipped integer:=0; recorded integer:=0; missing integer:=0; used uuid[]:='{}'; start_value timestamptz; end_value timestamptz;
begin
 if owner_id is null then raise exception 'Authentication required'; end if;
 perform id from public.profiles where id=owner_id for update;
 if jsonb_typeof(payload)<>'array' or jsonb_array_length(payload) not between 1 and 100 then raise exception 'Seleziona da 1 a 100 allenamenti.'; end if;
 select snapshot,source_id into snap,source from public.sport_connections where user_id=owner_id;
 if snap is null then raise exception 'Collega prima Forma.'; end if;
 for item in select value from jsonb_array_elements(payload) loop
  key_value:=item->>'key'; date_value:=(item->>'date')::date; done:=(item->>'completed')::boolean;
  if key_value is null or date_value is null or done is null then raise exception 'Allenamento non valido.'; end if;
  if exists(select 1 from public.sport_imports where user_id=owner_id and source_key=key_value) then skipped:=skipped+1; continue; end if;
  workout:=null;
  if done then
   select value into workout from jsonb_array_elements(snap->'workouts') where key_value=source||':session:'||(value->>'id') and value->>'date'=date_value::text and value->>'completed'='true';
   if workout is null then raise exception 'La sessione non è presente nel riepilogo Forma. Aggiorna il collegamento.'; end if;
  elsif not exists(select 1 from jsonb_array_elements(snap->'plans') where key_value=source||':plan:'||(value->>'id')||':'||date_value::text and (value->>'weekday')::integer=extract(isodow from date_value)::integer-1) then raise exception 'Programma Forma non valido.';
  end if;
  entry:=null;
  if nullif(item->>'link_id','') is not null then
   select * into entry from public.schedule_entries where id=(item->>'link_id')::uuid and user_id=owner_id and category='gym' and entry_date=date_value for update;
   if entry.id is null or entry.updated_at is distinct from (item->>'expected_updated_at')::timestamptz then raise exception 'L’attività scelta è cambiata. Aggiorna i dati e riprova.'; end if;
   if entry.id=any(used) or (done and entry.sport_session_key is not null) then raise exception 'Collega ogni sessione a un’attività diversa.'; end if;
  else
   insert into public.schedule_entries(user_id,title,category,entry_date,planned_minutes,notes)
   values(owner_id,item->>'title','gym',date_value,case when done then 0 else (item->>'planned_minutes')::integer end,'Da Forma · allenamento collegato') returning * into entry;
  end if;
  used:=array_append(used,entry.id);
  if done then
   update public.schedule_entries set is_completed=true,sport_session_key=key_value where id=entry.id;
   if not exists(select 1 from public.time_logs where entry_id=entry.id and user_id=owner_id) then
    start_value:=nullif(workout->>'started_at','')::timestamptz; end_value:=nullif(workout->>'ended_at','')::timestamptz;
    if start_value is not null and end_value>start_value and end_value<=start_value+interval '5 hours'
       and (start_value at time zone (select timezone from public.profiles where id=owner_id))::date=date_value
       and abs(extract(epoch from (end_value-start_value))/60-coalesce((workout->>'duration_minutes')::integer,0))<1
       and not exists(select 1 from public.time_logs where user_id=owner_id and started_at<end_value and ended_at>start_value) then
     insert into public.time_logs(user_id,entry_id,started_at,ended_at,notes) values(owner_id,entry.id,start_value,end_value,'Da Forma · intervallo registrato'); recorded:=recorded+1;
    else missing:=missing+1; end if;
   end if;
  end if;
  insert into public.sport_imports(user_id,source_key,entry_id) values(owner_id,key_value,entry.id);
  imported:=imported+1;
 end loop;
 return jsonb_build_object('imported',imported,'skipped',skipped,'logs',recorded,'missing_times',missing);
end; $$;
revoke all on function public.save_sport_snapshot(jsonb),public.import_sport_agenda(jsonb) from public,anon;
grant execute on function public.save_sport_snapshot(jsonb),public.import_sport_agenda(jsonb) to authenticated;
commit;
