// La migrazione 012 sposta Studio Design e B&B Esempio nella categoria Sviluppo
// senza perdere progetto collegato, completamento e ore registrate.
import {PGlite} from '@electric-sql/pglite';import fs from 'node:fs';import assert from 'node:assert/strict';
const db=new PGlite();
await db.exec("create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}');create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;");
for(const m of ['001_initial','002_daily_focus','003_daily_notebook','004_notes','007_personal_agenda','008_work_shift_calendar','009_agenda_productivity','010_sport_connection','011_forma_workspace'])await db.exec(fs.readFileSync('supabase/migrations/'+m+'.sql','utf8'));
const A='11111111-1111-4111-8111-111111111111';
await db.query('insert into auth.users(id) values($1)',[A]);
const rows=async(q,p=[])=>(await db.query(q,p)).rows;
const p=(await rows("insert into projects(user_id,name) values($1,'Studio Design') returning id",[A]))[0].id;
const dld=(await rows("insert into schedule_entries(user_id,title,category,entry_date,starts_at,ends_at,planned_minutes,project_id,is_completed,completed_at) values($1,'Pagina prodotto','diliberto','2026-11-16','2026-11-16T10:00Z','2026-11-16T12:00Z',120,$2,true,now()) returning *",[A,p]))[0];
await rows("insert into time_logs(user_id,entry_id,started_at,ended_at) values($1,$2,'2026-11-16T10:00Z','2026-11-16T11:30Z')",[A,dld.id]);
await rows("insert into schedule_entries(user_id,title,category,entry_date,planned_minutes) values($1,'Prenotazioni','casa','2026-11-17',60)",[A]);
await rows("insert into schedule_entries(user_id,title,category,entry_date,planned_minutes) values($1,'Studio','study','2026-11-17',60)",[A]);
await rows("insert into weekly_goals(user_id,title,week_start,category,unit,target,stretch_target,project_id) values($1,'Studio Design','2026-11-16','diliberto','minutes',360,360,$2)",[A,p]);
await db.exec(fs.readFileSync('supabase/migrations/012_categoria_sviluppo.sql','utf8'));
const voci=await rows('select title,category,project_id,is_completed from schedule_entries order by title');
assert.deepEqual(voci.map(v=>[v.title,v.category]),[['Pagina prodotto','dev'],['Prenotazioni','dev'],['Studio','study']]);
assert.equal(voci[0].project_id,p);assert.equal(voci[0].is_completed,true);
assert.equal((await rows('select count(*)::int n from time_logs'))[0].n,1);
const goal=(await rows('select category,project_id from weekly_goals'))[0];
assert.equal(goal.category,'dev');assert.equal(goal.project_id,p);
await assert.rejects(()=>db.query("insert into schedule_entries(user_id,title,category,entry_date,planned_minutes) values($1,'Vecchia','diliberto','2026-11-18',30)",[A]));
await assert.rejects(()=>db.query("insert into weekly_goals(user_id,title,week_start,category,unit,target,stretch_target) values($1,'Vecchio','2026-11-16','casa','minutes',60,60)",[A]));
await db.exec(fs.readFileSync('supabase/migrations/012_categoria_sviluppo.sql','utf8'));
console.log('PASS: categoria Sviluppo: voci e obiettivi Studio Design/B&B Esempio spostati con progetto, completamento e ore; vecchie categorie rifiutate; migrazione ripetibile.');
