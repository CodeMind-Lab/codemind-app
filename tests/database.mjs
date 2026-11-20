import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
import assert from "node:assert/strict";
const db = new PGlite();
await db.exec(
  `create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}'); create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$; grant usage on schema auth,public to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;`,
);
await db.exec(fs.readFileSync("supabase/migrations/001_initial.sql", "utf8"));
await db.exec(
  fs.readFileSync("supabase/migrations/002_daily_focus.sql", "utf8"),
);
await db.exec(fs.readFileSync("supabase/migrations/003_daily_notebook.sql", "utf8"));
await db.exec(fs.readFileSync("supabase/migrations/004_notes.sql", "utf8"));
await db.exec(fs.readFileSync("supabase/migrations/007_personal_agenda.sql", "utf8"));
const A = "11111111-1111-4111-8111-111111111111",
  B = "22222222-2222-4222-8222-222222222222",
  PA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  PB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  TA = "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  TB = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
await db.query("insert into auth.users(id) values($1),($2)", [A, B]);
await db.query(
  "insert into projects(id,user_id,name) values($1,$2,$3),($4,$5,$6)",
  [PA, A, "Project A", PB, B, "Project B"],
);
await db.query(
  "insert into tasks(id,user_id,project_id,title) values($1,$2,$3,$4)",
  [TB, B, PB, "Task B"],
);
async function role(user) {
  await db.exec("reset role;set role authenticated");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user]);
}
async function fails(fn) {
  let failed = false;
  try {
    await fn();
  } catch {
    failed = true;
  }
  assert(failed, "Expected rejection");
}
await role(A);
assert.equal((await db.query("select * from projects")).rows.length, 1);
assert.equal((await db.query("select * from tasks")).rows.length, 0);
assert.equal(
  (
    await db.query("update projects set name=$1 where id=$2 returning id", [
      "Forbidden",
      PB,
    ])
  ).rows.length,
  0,
);
assert.equal(
  (await db.query("delete from tasks where id=$1 returning id", [TB])).rows
    .length,
  0,
);
await fails(() =>
  db.query("insert into projects(user_id,name) values($1,$2)", [B, "Bad"]),
);
await fails(() =>
  db.query("insert into tasks(user_id,project_id,title) values($1,$2,$3)", [
    A,
    PB,
    "Cross-owner",
  ]),
);
const payload = {
  id: TA,
  project_id: PA,
  title: "Task A",
  status: "todo",
  priority: "urgent",
  type: "bug",
  tags: ["frontend", "Frontend"],
  checklist: [
    { title: "First", is_completed: true, position: 0 },
    { title: "Second", is_completed: false, position: 1 },
  ],
};
await db.query("select save_task($1::jsonb,null)", [JSON.stringify(payload)]);
assert.equal(
  (await db.query("select * from task_checklist_items")).rows.length,
  2,
);
assert.equal((await db.query("select * from tags")).rows.length, 1);
assert.equal((await db.query("select * from task_tags")).rows.length, 1);
let task = (await db.query("select * from tasks where id=$1", [TA])).rows[0];
await fails(() =>
  db.query("select save_task($1::jsonb,$2)", [
    JSON.stringify({ ...payload, title: "Stale" }),
    "2000-01-01T00:00:00Z",
  ]),
);
await db.query("select save_task($1::jsonb,$2)", [
  JSON.stringify({ ...payload, status: "completed" }),
  task.updated_at,
]);
task = (await db.query("select * from tasks where id=$1", [TA])).rows[0];
assert(task.completed_at);
await db.query("select save_task($1::jsonb,$2)", [
  JSON.stringify({ ...payload, status: "todo" }),
  task.updated_at,
]);
task = (await db.query("select * from tasks where id=$1", [TA])).rows[0];
assert.equal(task.completed_at, null);
await fails(() =>
  db.query("select save_task($1::jsonb,$2)", [
    JSON.stringify({
      ...payload,
      title: "Should rollback",
      checklist: [{ title: "" }],
    }),
    task.updated_at,
  ]),
);
assert.equal(
  (await db.query("select title from tasks where id=$1", [TA])).rows[0].title,
  "Task A",
);
await fails(() =>
  db.query(
    "insert into task_checklist_items(user_id,task_id,title) values($1,$2,$3)",
    [A, TB, "Bad checklist"],
  ),
);
await role(B);
assert.equal((await db.query("select * from tasks")).rows.length, 1);
const tagB = (
  await db.query("insert into tags(user_id,name) values($1,$2) returning id", [
    B,
    "Private",
  ])
).rows[0].id;
await role(A);
await fails(() =>
  db.query("insert into task_tags(task_id,tag_id,user_id) values($1,$2,$3)", [
    TA,
    tagB,
    A,
  ]),
);
await fails(() => db.query("update tasks set user_id=$1 where id=$2", [B, TA]));
await fails(() =>
  db.query("update profiles set timezone='Invalid/Fake' where id=$1", [A]),
);
await db.exec("reset role;set role anon");
await fails(() => db.query("select * from projects"));
await fails(() =>
  db.query("select save_task($1::jsonb,null)", [JSON.stringify(payload)]),
);
await role(A);
const focusDate = "2026-09-14";
const extra = [];
for (let i = 0; i < 3; i++)
  extra.push(
    (
      await db.query(
        "insert into tasks(user_id,project_id,title) values($1,$2,$3) returning id",
        [A, PA, "Focus " + i],
      )
    ).rows[0].id,
  );
for (const id of [TA, ...extra.slice(0, 2)])
  await db.query("select set_daily_focus($1,$2,true)", [id, focusDate]);
assert.equal((await db.query("select * from daily_focus")).rows.length, 3);
await db.query("select set_daily_focus($1,$2,true)", [TA, focusDate]);
assert.equal((await db.query("select * from daily_focus")).rows.length, 3);
await fails(() =>
  db.query("select set_daily_focus($1,$2,true)", [extra[2], focusDate]),
);
await fails(() =>
  db.query("select set_daily_focus($1,$2,true)", [TB, focusDate]),
);
await db.query("select set_daily_focus($1,$2,false)", [TA, focusDate]);
await db.query("select set_daily_focus($1,$2,true)", [extra[2], focusDate]);
assert.equal((await db.query("select * from daily_focus")).rows.length, 3);
await db.query("select set_daily_focus($1,$2,true)", [TA, "2026-09-15"]);
await role(B);
assert.equal((await db.query("select * from daily_focus")).rows.length, 0);
await fails(() =>
  db.query(
    "insert into daily_focus(user_id,task_id,focus_date,slot) values($1,$2,$3,1)",
    [B, TA, focusDate],
  ),
);
await db.exec("reset role;set role anon");
await fails(() =>
  db.query("select set_daily_focus($1,$2,true)", [TA, focusDate]),
);
await role(A);
await db.query("delete from projects where id=$1", [PA]);
assert.equal((await db.query("select * from tasks")).rows.length, 0);
assert.equal(
  (await db.query("select * from task_checklist_items")).rows.length,
  0,
);
assert.equal((await db.query("select * from task_tags")).rows.length, 0);
assert.equal((await db.query("select * from daily_focus")).rows.length, 0);
console.log(
  "PASS: daily focus limit, idempotency, date separation, ownership and cascade; migration, RLS isolation, composite ownership, atomic task/checklist/tags, concurrency, completion/reopen, timezone, cascade.",
);
await role(A);
const note = (await db.query("insert into daily_journal(user_id,entry_date,body) values($1,'2026-09-14','Private A') returning *",[A])).rows[0];
const todo = (await db.query("insert into daily_todos(user_id,todo_date,title) values($1,'2026-09-14','Daily A') returning *",[A])).rows[0];
await fails(()=>db.query("insert into daily_journal(user_id,entry_date,body) values($1,'2026-09-14','Duplicate')",[A]));
await db.query("insert into daily_journal(user_id,entry_date,body) values($1,'2026-09-15','Next day')",[A]);
await db.query("update daily_journal set body='Updated' where user_id=$1 and entry_date='2026-09-14' and updated_at=$2",[A,note.updated_at]);
assert.equal((await db.query("update daily_journal set body='Stale overwrite' where user_id=$1 and entry_date='2026-09-14' and updated_at=$2 returning *",[A,note.updated_at])).rows.length,0);
await db.query("update daily_todos set is_completed=true,todo_date='2026-09-15' where id=$1",[todo.id]);
assert.equal((await db.query("select * from daily_todos where id=$1",[todo.id])).rows[0].is_completed,true);
await fails(()=>db.query("insert into daily_todos(user_id,todo_date,title) values($1,'2026-09-14',' ')",[A]));
await role(B);
assert.equal((await db.query('select * from daily_journal')).rows.length,0);
assert.equal((await db.query('select * from daily_todos')).rows.length,0);
assert.equal((await db.query("update daily_journal set body='Forbidden' where user_id=$1 returning *",[A])).rows.length,0);
assert.equal((await db.query('delete from daily_todos where id=$1 returning *',[todo.id])).rows.length,0);
await fails(()=>db.query("insert into daily_journal(user_id,entry_date,body) values($1,'2026-09-16','Forbidden')",[A]));
await db.query("insert into daily_journal(user_id,entry_date,body) values($1,'2026-09-14','Private B')",[B]);
await db.exec('reset role;set role anon');
await fails(()=>db.query('select * from daily_journal'));
await fails(()=>db.query('select * from daily_todos'));
console.log('PASS: private diary and daily todo RLS, dates, duplicate prevention, stale-write protection, edit/complete and anonymous denial.');
await role(A);
const noteItem=(await db.query("insert into notes(user_id,title,body) values($1,'Link','https://example.com') returning *",[A])).rows[0];
await db.query("update notes set body='Edited' where id=$1 and updated_at=$2",[noteItem.id,noteItem.updated_at]);
assert.equal((await db.query("update notes set body='Stale' where id=$1 and updated_at=$2 returning *",[noteItem.id,noteItem.updated_at])).rows.length,0);
await role(B);
assert.equal((await db.query('select * from notes')).rows.length,0);
assert.equal((await db.query("update notes set body='Forbidden' where id=$1 returning *",[noteItem.id])).rows.length,0);
await fails(()=>db.query("insert into notes(user_id,title) values($1,'Forbidden')",[A]));
await db.exec('reset role;set role anon');await fails(()=>db.query('select * from notes'));
console.log('PASS: notes ownership, anonymous denial and stale-write protection.');
await role(A);
const agendaProject=(await db.query("insert into projects(user_id,name) values($1,'Agenda project') returning id",[A])).rows[0].id;
const agendaEntry=(await db.query("insert into schedule_entries(user_id,title,category,kind,entry_date,starts_at,ends_at,planned_minutes,project_id) values($1,'Night','work','shift','2026-10-08','2026-10-08T21:30:00Z','2026-10-09T05:30:00Z',480,$2) returning *",[A,agendaProject])).rows[0];
await db.query("update schedule_entries set is_completed=true where id=$1",[agendaEntry.id]);
assert((await db.query("select completed_at from schedule_entries where id=$1",[agendaEntry.id])).rows[0].completed_at);
await db.query("update schedule_entries set is_completed=false where id=$1",[agendaEntry.id]);
assert.equal((await db.query("select completed_at from schedule_entries where id=$1",[agendaEntry.id])).rows[0].completed_at,null);
const agendaLog=(await db.query("insert into time_logs(user_id,entry_id,started_at,ended_at) values($1,$2,'2026-10-08T21:30:00Z','2026-10-09T05:30:00Z') returning *",[A,agendaEntry.id])).rows[0];
assert.equal(agendaLog.duration_minutes,480);
await fails(()=>db.query("insert into time_logs(user_id,entry_id,started_at,ended_at) values($1,$2,'2026-10-09T04:30:00Z','2026-10-09T06:30:00Z')",[A,agendaEntry.id]));
await fails(()=>db.query("update schedule_entries set entry_date=null,starts_at=null,ends_at=null where id=$1",[agendaEntry.id]));
await fails(()=>db.query("insert into schedule_entries(user_id,title,category,project_id) values($1,'Cross owner','study',$2)",[A,PB]));
await fails(()=>db.query("insert into weekly_goals(user_id,title,week_start,category,unit,target,stretch_target) values($1,'Tuesday','2026-10-06','study','minutes',480,480)",[A]));
await db.query("delete from projects where id=$1",[agendaProject]);
assert.equal((await db.query("select project_id from schedule_entries where id=$1",[agendaEntry.id])).rows[0].project_id,null);
await role(B);
assert.equal((await db.query('select * from schedule_entries')).rows.length,0);
assert.equal((await db.query('select * from time_logs')).rows.length,0);
await fails(()=>db.query("insert into time_logs(user_id,entry_id,started_at,ended_at) values($1,$2,now(),now()+interval '1 hour')",[B,agendaEntry.id]));
await role(A);
const seed={week_start:'2026-10-05',entries:[{id:'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',title:'Seed',category:'study',kind:'activity',entry_date:'2026-10-05',planned_minutes:60}],goals:[]};
await db.query('select seed_agenda_week($1::jsonb)',[JSON.stringify(seed)]); await db.query('select seed_agenda_week($1::jsonb)',[JSON.stringify(seed)]);
assert.equal((await db.query('select * from agenda_weeks')).rows.length,1);
assert.equal((await db.query('select * from schedule_entries')).rows.length,2);
const shift=(await db.query('select * from schedule_entries where id=$1',[agendaEntry.id])).rows[0];
await fails(()=>db.query('select save_agenda_shifts($1::jsonb)',[JSON.stringify([{id:shift.id,expected_updated_at:shift.updated_at,remove:true}])]));
const shiftChanges=[{id:shift.id,expected_updated_at:shift.updated_at,title:'Changed',kind:'shift',entry_date:'2026-10-08',starts_at:'2026-10-08T20:30:00Z',ends_at:'2026-10-09T04:30:00Z',planned_minutes:480},{id:'ffffffff-ffff-4fff-8fff-ffffffffffff',title:'Invalid',kind:'shift',entry_date:'2026-10-10',planned_minutes:0}];
await fails(()=>db.query('select save_agenda_shifts($1::jsonb)',[JSON.stringify(shiftChanges)]));
assert.equal((await db.query('select title from schedule_entries where id=$1',[shift.id])).rows[0].title,'Night');
await db.query('select save_agenda_shifts($1::jsonb)',[JSON.stringify(shiftChanges.slice(0,1))]);
assert.equal((await db.query('select title from schedule_entries where id=$1',[shift.id])).rows[0].title,'Changed');
await fails(()=>db.query('select save_agenda_shifts($1::jsonb)',[JSON.stringify(shiftChanges.slice(0,1))]));
await db.query('delete from schedule_entries where id=$1',[agendaEntry.id]);
assert.equal((await db.query('select * from time_logs')).rows.length,0);
await db.exec('reset role;set role anon');
for (const table of ['schedule_entries','time_logs','weekly_goals','agenda_weeks']) await fails(()=>db.query('select * from '+table));
await fails(()=>db.query('select seed_agenda_week($1::jsonb)',[JSON.stringify(seed)]));
console.log('PASS: agenda migration, RLS, cross-owner links, midnight duration, overlap constraint, completion/reopen, project unlinking, seed idempotency, atomic shift updates and stale writes, log cascade and anonymous denial.');
await db.close();
