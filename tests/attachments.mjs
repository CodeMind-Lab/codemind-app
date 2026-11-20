import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const db = new PGlite();
await db.exec(`create role authenticated; create schema auth; create schema storage;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create table public.projects(id uuid primary key,user_id uuid,name text default 'Project title');
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint);
create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);
create function storage.foldername(text) returns text[] language sql immutable as $$select (string_to_array($1,'/'))[1:array_length(string_to_array($1,'/'),1)-1]$$;
alter table storage.objects enable row level security;
grant usage on schema public,auth,storage to authenticated;
grant select on public.projects to authenticated;
grant select,insert,delete on storage.objects to authenticated;`);
await db.exec(fs.readFileSync('supabase/migrations/005_project_attachments.sql','utf8'));
await db.exec(fs.readFileSync('supabase/migrations/006_fix_attachment_policies.sql','utf8'));
await db.exec(fs.readFileSync('supabase/migrations/006_fix_attachment_policies.sql','utf8'));
const a='11111111-1111-4111-8111-111111111111', b='22222222-2222-4222-8222-222222222222', p='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', q='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
await db.query('insert into projects(id,user_id) values($1,$2),($3,$4)',[p,a,q,b]);
async function as(user) {await db.exec('reset role; set role authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user]);}
await as(a);
await db.query("insert into storage.objects(bucket_id,name) values('project-attachments',$1)",[`${a}/${p}/file.txt`]);
for (const key of [`${b}/${q}/file.txt`,`${a}/${q}/file.txt`,`${a}/nonexistent/file.txt`,`${a}/${p}/nested/file.txt`]) {
 await assert.rejects(db.query("insert into storage.objects(bucket_id,name) values('project-attachments',$1)",[key]));
}
assert.equal((await db.query('select * from storage.objects')).rows.length,1);
await as(b);
assert.equal((await db.query('select * from storage.objects')).rows.length,0);
await db.query('delete from storage.objects');
await as(a);
assert.equal((await db.query('select * from storage.objects')).rows.length,1);
await db.query('delete from storage.objects');
assert.equal((await db.query('select * from storage.objects')).rows.length,0);
await db.exec('reset role');
const bucket=(await db.query('select * from storage.buckets')).rows[0];
assert.equal(bucket.public,false);assert.equal(Number(bucket.file_size_limit),10485760);
await db.close();
console.log('Attachment policies: owner upload/read/delete, isolation, invalid project and nested paths OK');
