begin;
create table public.forma_archives (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null unique references public.profiles(id) on delete cascade,
 source_id text not null check(source_id ~ '^[a-zA-Z0-9_-]{8,100}$'),
 archive jsonb not null check(jsonb_typeof(archive)='object' and archive->>'version'='1' and jsonb_typeof(archive->'items')='array' and jsonb_array_length(archive->'items')<=20000 and octet_length(archive::text)<=6000000 and not archive ? 'sync'),
 managed_turns jsonb not null default '[]',
 revision bigint not null default 1 check(revision>0),
 updated_at timestamptz not null default now()
);
alter table public.forma_archives enable row level security;
revoke all on public.forma_archives from public,anon,authenticated;
grant select,insert,update on public.forma_archives to authenticated;
create policy own_select on public.forma_archives for select to authenticated using(user_id=(select auth.uid()));
create policy own_insert on public.forma_archives for insert to authenticated with check(user_id=(select auth.uid()));
create policy own_update on public.forma_archives for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));

-- Projects is the source for dated work shifts. Only g.turno is reconciled.
create function public.forma_work_turns() returns trigger language plpgsql security invoker set search_path='' as $$
declare rows_value jsonb:=new.archive->'items'; turn jsonb; prev jsonb; row_value jsonb; idx integer; managed jsonb:='[]'; preset text; day_value text; stamp numeric:=floor(extract(epoch from clock_timestamp())*1000); zone text; definition jsonb;
begin
 if tg_op='UPDATE' then
  if new.id<>old.id or new.user_id<>old.user_id or new.source_id<>old.source_id then raise exception 'Identità archivio non modificabile.'; end if;
  new.revision:=old.revision+1;
 else new.revision:=1; end if;
 if jsonb_typeof(new.archive->'items') is distinct from 'array' or jsonb_typeof(new.archive->'settings') is distinct from 'object' or jsonb_typeof(new.archive->'graves') is distinct from 'object' then raise exception 'Archivio Forma non valido.'; end if;
 if new.archive::text ~* '"(sync|access|refresh|password|token|anon|secret|service_role|authorization|apikey|__proto__|prototype|constructor)"[[:space:]]*:' then raise exception 'Credenziali non ammesse nell’archivio.'; end if;
 if exists(select 1 from jsonb_array_elements(rows_value) i where coalesce(i->>'id','')='' or length(i->>'id')>200 or coalesce(i->>'t','') not in('a','ag','agr','cfg','g','gt','in','l','m','p','pa','r','s','tn','tu','w')) or exists(select 1 from jsonb_array_elements(rows_value) i group by i->>'id' having count(*)>1) then raise exception 'Voce Forma non valida o duplicata.'; end if;
 select timezone into zone from public.profiles where id=new.user_id;
 for turn in select to_jsonb(s) from public.schedule_entries s where s.user_id=new.user_id and s.kind in('shift','off') and s.entry_date in(select entry_date from public.schedule_entries where user_id=new.user_id and kind in('shift','off') group by entry_date having count(*)=1) order by s.entry_date loop
  day_value:=turn->>'entry_date'; preset:=null;
  if turn->>'kind'='off' then preset:='off';
  elsif extract(epoch from ((turn->>'ends_at')::timestamptz-(turn->>'starts_at')::timestamptz))=28800 then
   preset:=case to_char((turn->>'starts_at')::timestamptz at time zone coalesce(zone,'Europe/Rome'),'HH24:MI') when '07:30' then 'apertura' when '15:30' then 'chiusura' when '23:30' then 'notte' else null end;
  end if;
  if preset is null then continue; end if;
  managed:=managed||jsonb_build_array(jsonb_build_object('date',day_value,'preset',preset));
  select (o-1)::integer,i into idx,row_value from jsonb_array_elements(rows_value) with ordinality a(i,o) where i->>'t'='g' and i->>'d'=day_value limit 1;
  if row_value is null then rows_value:=rows_value||jsonb_build_array(jsonb_build_object('id','g-'||day_value,'t','g','d',day_value,'turno','cm-work-'||preset,'acqua',0,'passi',0,'updatedAt',stamp));
  elsif row_value->>'turno' is distinct from 'cm-work-'||preset then rows_value:=jsonb_set(rows_value,array[idx::text],row_value||jsonb_build_object('turno','cm-work-'||preset,'updatedAt',stamp)); end if;
  if not exists(select 1 from jsonb_array_elements(rows_value) i where i->>'id'='cm-work-'||preset) then
   definition:=case preset when 'apertura' then '{"n":"Apertura","ore":"07:30 – 15:30","ic":"🌅","col":"ambra"}'::jsonb when 'chiusura' then '{"n":"Chiusura","ore":"15:30 – 23:30","ic":"🌆","col":"corallo"}'::jsonb when 'notte' then '{"n":"Notte","ore":"23:30 – 07:30","ic":"🌙","col":"viola"}'::jsonb else '{"n":"OFF","ore":"riposo","ic":"🏠","col":"verde"}'::jsonb end;
   rows_value:=rows_value||jsonb_build_array(definition||jsonb_build_object('id','cm-work-'||preset,'t','tn','riposo',preset='off','ord',100,'updatedAt',stamp));
  end if;
 end loop;
 if tg_op='UPDATE' then
  for prev in select value from jsonb_array_elements(old.managed_turns) loop
   if exists(select 1 from jsonb_array_elements(managed) m where m->>'date'=prev->>'date') then continue; end if;
   select (o-1)::integer,i into idx,row_value from jsonb_array_elements(rows_value) with ordinality a(i,o) where i->>'t'='g' and i->>'d'=prev->>'date' limit 1;
   if row_value->>'turno'='cm-work-'||(prev->>'preset') then rows_value:=jsonb_set(rows_value,array[idx::text],row_value||jsonb_build_object('turno','','updatedAt',stamp)); end if;
  end loop;
 end if;
 new.archive:=jsonb_set(new.archive,'{items}',rows_value);new.managed_turns:=managed;new.updated_at:=clock_timestamp();return new;
end; $$;
create trigger reconcile_turns before insert or update on public.forma_archives for each row execute function public.forma_work_turns();

create function public.sync_forma_work_turns() returns trigger language plpgsql security invoker set search_path='' as $$
declare owner_id uuid;
begin
 if tg_op='DELETE' then if old.kind not in('shift','off') then return old;end if;owner_id:=old.user_id;
 else if new.kind not in('shift','off') and (tg_op='INSERT' or old.kind not in('shift','off')) then return new;end if;owner_id:=new.user_id;end if;
 update public.forma_archives set archive=archive where user_id=owner_id;
 if tg_op='DELETE' then return old;else return new;end if;
end; $$;
create trigger sync_forma_turns after insert or update or delete on public.schedule_entries for each row execute function public.sync_forma_work_turns();

create function public.save_forma_archive(payload jsonb, expected_revision bigint default null) returns jsonb language plpgsql security invoker set search_path='' as $$
declare owner_id uuid:=auth.uid(); saved public.forma_archives; expected_id uuid:=nullif(payload->>'archive_id','')::uuid;
begin
 if owner_id is null then raise exception 'Authentication required';end if;
 perform id from public.profiles where id=owner_id for update;
 select * into saved from public.forma_archives where user_id=owner_id for update;
 if saved.id is distinct from expected_id or saved.revision is distinct from expected_revision then raise exception 'FORMA_CONFLICT: Archivio aggiornato su un altro dispositivo. Riprova con i dati aggiornati.';end if;
 if exists(select 1 from public.sport_connections where user_id=owner_id and source_id<>payload->>'source_id') then raise exception 'Questo archivio Forma è diverso da quello collegato.';end if;
 if saved.id is null then insert into public.forma_archives(user_id,source_id,archive) values(owner_id,payload->>'source_id',payload->'archive') returning * into saved;
 else update public.forma_archives set archive=payload->'archive' where id=saved.id and source_id=payload->>'source_id' returning * into saved;end if;
 if saved.id is null then raise exception 'Archivio Forma non corrispondente.';end if;
 return to_jsonb(saved);
end; $$;
revoke all on function public.save_forma_archive(jsonb,bigint) from public,anon;
grant execute on function public.save_forma_archive(jsonb,bigint) to authenticated;
revoke all on function public.forma_work_turns(),public.sync_forma_work_turns() from public,anon;
grant execute on function public.forma_work_turns(),public.sync_forma_work_turns() to authenticated;
commit;
