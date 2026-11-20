begin;
create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null default '', timezone text not null default 'Europe/Rome',
 theme text not null default 'system' check (theme in ('system','light','dark')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.projects (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
 name text not null check (length(btrim(name)) between 1 and 120), description text, notes text,
 color text not null default '#0d7191' check (color ~ '^#[0-9a-fA-F]{6}$'), icon text,
 status text not null default 'active' check (status in ('planned','active','paused','completed','archived')),
 start_date date, due_date date, github_url text, project_url text, archived_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(id,user_id), check (due_date is null or start_date is null or due_date >= start_date)
);
create table public.tasks (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
 project_id uuid not null, title text not null check (length(btrim(title)) between 1 and 200), description text, notes text,
 status text not null default 'todo' check (status in ('backlog','todo','in_progress','testing','completed')),
 priority text not null default 'medium' check (priority in ('low','medium','high','urgent')),
 type text not null default 'feature' check (type in ('feature','bug','ui_ux','refactoring','test','documentation','maintenance','study','other')),
 start_date date, planned_date date, due_date date,
 estimated_minutes integer check (estimated_minutes >= 0), actual_minutes integer check (actual_minutes >= 0),
 position integer not null default 0 check (position >= 0), github_url text, github_issue_number integer check (github_issue_number > 0),
 completed_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(id,user_id), foreign key(project_id,user_id) references public.projects(id,user_id) on delete cascade,
 check (due_date is null or start_date is null or due_date >= start_date),
 check ((status='completed') = (completed_at is not null))
);
create table public.task_checklist_items (
 id uuid primary key default gen_random_uuid(), user_id uuid not null, task_id uuid not null,
 title text not null check (length(btrim(title))>0), is_completed boolean not null default false,
 position integer not null default 0 check (position>=0),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 foreign key(task_id,user_id) references public.tasks(id,user_id) on delete cascade
);
create table public.tags (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
 name text not null check (length(btrim(name)) between 1 and 80), color text check (color ~ '^#[0-9a-fA-F]{6}$'),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(id,user_id)
);
create unique index tags_name_unique on public.tags(user_id,lower(btrim(name)));
create table public.task_tags (
 task_id uuid not null, tag_id uuid not null, user_id uuid not null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), primary key(task_id,tag_id),
 foreign key(task_id,user_id) references public.tasks(id,user_id) on delete cascade,
 foreign key(tag_id,user_id) references public.tags(id,user_id) on delete cascade
);
create index projects_owner_status on public.projects(user_id,status);
create index projects_owner_due on public.projects(user_id,due_date);
create index tasks_owner_project_status_position on public.tasks(user_id,project_id,status,position);
create index tasks_owner_status on public.tasks(user_id,status);
create index tasks_owner_due on public.tasks(user_id,due_date);
create index tasks_owner_planned on public.tasks(user_id,planned_date);
create index tasks_owner_completed on public.tasks(user_id,completed_at);
create index tasks_owner_updated on public.tasks(user_id,updated_at desc);
create index checklist_owner_task on public.task_checklist_items(user_id,task_id,position);
create index checklist_task_fk on public.task_checklist_items(task_id);
create index task_tags_owner_task on public.task_tags(user_id,task_id);
create index task_tags_owner_tag on public.task_tags(user_id,tag_id);
create index task_tags_tag_fk on public.task_tags(tag_id);

create function public.touch_updated_at() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='UPDATE' then
  if to_jsonb(new)->>'user_id' is distinct from to_jsonb(old)->>'user_id' then raise exception 'Ownership cannot change'; end if;
  if new.id is distinct from old.id then raise exception 'Identity cannot change'; end if;
 end if;
 new.updated_at=clock_timestamp(); return new;
end; $$;
create function public.touch_relation_updated_at() returns trigger language plpgsql set search_path='' as $$
begin
 if new.user_id is distinct from old.user_id or new.task_id is distinct from old.task_id or new.tag_id is distinct from old.tag_id then raise exception 'Relation identity cannot change'; end if;
 new.updated_at=clock_timestamp();return new;
end; $$;
create function public.normalize_task() returns trigger language plpgsql set search_path='' as $$
begin
 if new.status='completed' then
  if tg_op='UPDATE' and old.status='completed' then new.completed_at=old.completed_at;
  else new.completed_at=clock_timestamp(); end if;
 else new.completed_at=null; end if;
 return new;
end; $$;
create trigger task_status_timestamps before insert or update on public.tasks for each row execute function public.normalize_task();
create function public.normalize_project() returns trigger language plpgsql set search_path='' as $$
begin
 if new.status='archived' then
  if tg_op='UPDATE' and old.status='archived' then new.archived_at=old.archived_at;
  else new.archived_at=clock_timestamp(); end if;
 else new.archived_at=null; end if;
 return new;
end; $$;
create trigger project_archive_timestamp before insert or update on public.projects for each row execute function public.normalize_project();
create function public.validate_profile_timezone() returns trigger language plpgsql set search_path='' as $$
begin
 if not exists(select 1 from pg_catalog.pg_timezone_names where name=new.timezone) then raise exception 'Invalid timezone'; end if;
 return new;
end; $$;
create trigger profile_timezone before insert or update on public.profiles for each row execute function public.validate_profile_timezone();
create function public.handle_new_user() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.profiles(id,display_name) values(new.id,coalesce(new.raw_user_meta_data->>'display_name',''));
 return new;
end; $$;
revoke all on function public.handle_new_user() from public,anon,authenticated;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
insert into public.profiles(id) select id from auth.users on conflict(id) do nothing;
create trigger touch_timestamp before update on public.profiles for each row execute function public.touch_updated_at();
create trigger touch_timestamp before update on public.projects for each row execute function public.touch_updated_at();
create trigger touch_timestamp before update on public.tasks for each row execute function public.touch_updated_at();
create trigger touch_timestamp before update on public.task_checklist_items for each row execute function public.touch_updated_at();
create trigger touch_timestamp before update on public.tags for each row execute function public.touch_updated_at();
create trigger touch_timestamp before update on public.task_tags for each row execute function public.touch_relation_updated_at();
alter table public.profiles enable row level security;
revoke all on public.profiles from anon,authenticated;
grant select,update on public.profiles to authenticated;
create policy own_select on public.profiles for select to authenticated using (id=(select auth.uid()));
create policy own_update on public.profiles for update to authenticated using (id=(select auth.uid())) with check (id=(select auth.uid()));
alter table public.projects enable row level security;
revoke all on public.projects from anon,authenticated;
grant select,update on public.projects to authenticated;
create policy own_select on public.projects for select to authenticated using (user_id=(select auth.uid()));
create policy own_update on public.projects for update to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
grant insert,delete on public.projects to authenticated;
create policy own_insert on public.projects for insert to authenticated with check (user_id=(select auth.uid()));
create policy own_delete on public.projects for delete to authenticated using (user_id=(select auth.uid()));
alter table public.tasks enable row level security;
revoke all on public.tasks from anon,authenticated;
grant select,update on public.tasks to authenticated;
create policy own_select on public.tasks for select to authenticated using (user_id=(select auth.uid()));
create policy own_update on public.tasks for update to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
grant insert,delete on public.tasks to authenticated;
create policy own_insert on public.tasks for insert to authenticated with check (user_id=(select auth.uid()));
create policy own_delete on public.tasks for delete to authenticated using (user_id=(select auth.uid()));
alter table public.task_checklist_items enable row level security;
revoke all on public.task_checklist_items from anon,authenticated;
grant select,update on public.task_checklist_items to authenticated;
create policy own_select on public.task_checklist_items for select to authenticated using (user_id=(select auth.uid()));
create policy own_update on public.task_checklist_items for update to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
grant insert,delete on public.task_checklist_items to authenticated;
create policy own_insert on public.task_checklist_items for insert to authenticated with check (user_id=(select auth.uid()));
create policy own_delete on public.task_checklist_items for delete to authenticated using (user_id=(select auth.uid()));
alter table public.tags enable row level security;
revoke all on public.tags from anon,authenticated;
grant select,update on public.tags to authenticated;
create policy own_select on public.tags for select to authenticated using (user_id=(select auth.uid()));
create policy own_update on public.tags for update to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
grant insert,delete on public.tags to authenticated;
create policy own_insert on public.tags for insert to authenticated with check (user_id=(select auth.uid()));
create policy own_delete on public.tags for delete to authenticated using (user_id=(select auth.uid()));
alter table public.task_tags enable row level security;
revoke all on public.task_tags from anon,authenticated;
grant select,update on public.task_tags to authenticated;
create policy own_select on public.task_tags for select to authenticated using (user_id=(select auth.uid()));
create policy own_update on public.task_tags for update to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
grant insert,delete on public.task_tags to authenticated;
create policy own_insert on public.task_tags for insert to authenticated with check (user_id=(select auth.uid()));
create policy own_delete on public.task_tags for delete to authenticated using (user_id=(select auth.uid()));

-- The task and its checklist/tags are saved in a single transaction under caller RLS.
create function public.save_task(payload jsonb, expected_updated_at timestamptz default null)
returns uuid language plpgsql security invoker set search_path='' as $$
declare
 owner_id uuid := auth.uid(); task_id_value uuid := (payload->>'id')::uuid;
 existing public.tasks; item jsonb; tag_name text; tag_id_value uuid; item_id uuid;
begin
 if owner_id is null then raise exception 'Authentication required'; end if;
 if task_id_value is null then raise exception 'Task ID required'; end if;
 select * into existing from public.tasks where id=task_id_value for update;
 if found then
  if expected_updated_at is null or existing.updated_at<>expected_updated_at then
   raise exception 'Attività modificata su un altro dispositivo. Aggiorna i dati prima di salvare.';
  end if;
  update public.tasks set
   title=payload->>'title', description=payload->>'description', project_id=(payload->>'project_id')::uuid,
   status=payload->>'status', priority=payload->>'priority', type=payload->>'type',
   start_date=nullif(payload->>'start_date','')::date, planned_date=nullif(payload->>'planned_date','')::date,
   due_date=nullif(payload->>'due_date','')::date, estimated_minutes=(payload->>'estimated_minutes')::integer,
   actual_minutes=(payload->>'actual_minutes')::integer, notes=payload->>'notes',
   github_url=payload->>'github_url', github_issue_number=(payload->>'github_issue_number')::integer,
   position=coalesce((payload->>'position')::integer,0)
  where id=task_id_value;
 else
  if expected_updated_at is not null then raise exception 'Attività non trovata o non accessibile.'; end if;
  insert into public.tasks(id,user_id,project_id,title,description,status,priority,type,start_date,planned_date,due_date,estimated_minutes,actual_minutes,notes,github_url,github_issue_number,position)
  values(task_id_value,owner_id,(payload->>'project_id')::uuid,payload->>'title',payload->>'description',payload->>'status',payload->>'priority',payload->>'type',nullif(payload->>'start_date','')::date,nullif(payload->>'planned_date','')::date,nullif(payload->>'due_date','')::date,(payload->>'estimated_minutes')::integer,(payload->>'actual_minutes')::integer,payload->>'notes',payload->>'github_url',(payload->>'github_issue_number')::integer,coalesce((payload->>'position')::integer,0));
 end if;
 delete from public.task_checklist_items where task_id=task_id_value;
 for item in select value from jsonb_array_elements(coalesce(payload->'checklist','[]'::jsonb)) loop
  item_id=coalesce((item->>'id')::uuid,gen_random_uuid());
  insert into public.task_checklist_items(id,user_id,task_id,title,is_completed,position)
  values(item_id,owner_id,task_id_value,item->>'title',coalesce((item->>'is_completed')::boolean,false),coalesce((item->>'position')::integer,0));
 end loop;
 delete from public.task_tags where task_id=task_id_value;
 for tag_name in select distinct btrim(value) from jsonb_array_elements_text(coalesce(payload->'tags','[]'::jsonb)) where length(btrim(value))>0 loop
  insert into public.tags(user_id,name) values(owner_id,tag_name)
  on conflict(user_id,lower(btrim(name))) do update set name=public.tags.name returning id into tag_id_value;
  insert into public.task_tags(task_id,tag_id,user_id) values(task_id_value,tag_id_value,owner_id) on conflict do nothing;
 end loop;
 return task_id_value;
end; $$;
revoke all on function public.save_task(jsonb,timestamptz) from public,anon;
grant execute on function public.save_task(jsonb,timestamptz) to authenticated;
revoke all on function public.touch_updated_at(),public.touch_relation_updated_at(),public.normalize_task(),public.normalize_project(),public.validate_profile_timezone() from public,anon,authenticated;
commit;
