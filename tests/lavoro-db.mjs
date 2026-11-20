// Migrazione 013: tabelle di Lavoro Hotel e Lavoro Sviluppo, con proprietario,
// regole di accesso (RLS), collegamenti tra righe dello stesso utente e vincoli.
import {PGlite} from '@electric-sql/pglite';import fs from 'node:fs';import assert from 'node:assert/strict';
const db=new PGlite();
await db.exec("create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}');create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;");
for(const m of ['001_initial','002_daily_focus','003_daily_notebook','004_notes','007_personal_agenda','008_work_shift_calendar','009_agenda_productivity','010_sport_connection','011_forma_workspace','012_categoria_sviluppo','013_lavoro'])await db.exec(fs.readFileSync('supabase/migrations/'+m+'.sql','utf8'));
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222';
await db.query('insert into auth.users(id) values($1),($2)',[A,B]);
const rows=async(q,p=[])=>(await db.query(q,p)).rows;
const fails=async(fn)=>{let ok=false;try{await fn();}catch{ok=true;}assert.ok(ok,'doveva fallire');};
async function role(id){await db.exec('reset role;set role authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);}

await role(A);
// Contratto: una riga sola per utente, valori di default sensati.
const c=(await rows("insert into hotel_contratto(user_id,netto_mensile,mensilita_extra) values($1,1500,'[{\"mese\":7,\"nome\":\"14ª\"},{\"mese\":12,\"nome\":\"13ª\"}]') returning *",[A]))[0];
assert.equal(Number(c.ore_giornaliere),8);assert.equal(c.notte_inizio,'22:00:00');
await fails(()=>db.query("insert into hotel_contratto(user_id) values($1)",[A]));
await fails(()=>db.query("update hotel_contratto set mensilita_extra='{}' where id=$1",[c.id]));
const prima=c.updated_at;await rows("update hotel_contratto set netto_mensile=1510 where id=$1",[c.id]);
assert.notEqual((await rows('select updated_at from hotel_contratto'))[0].updated_at.toISOString(),prima.toISOString());
// Assenze: i permessi vogliono le ore, niente doppioni nello stesso giorno.
await rows("insert into hotel_assenze(user_id,data,tipo) values($1,'2026-11-23','ferie')",[A]);
await fails(()=>db.query("insert into hotel_assenze(user_id,data,tipo) values($1,'2026-11-23','ferie')",[A]));
await fails(()=>db.query("insert into hotel_assenze(user_id,data,tipo) values($1,'2026-11-24','permesso')",[A]));
await rows("insert into hotel_assenze(user_id,data,tipo,ore) values($1,'2026-11-24','permesso',2)",[A]);
// Buste paga: un mese per riga, sempre il giorno 1.
await rows("insert into hotel_buste_paga(user_id,mese,netto) values($1,'2026-10-01',1500)",[A]);
await fails(()=>db.query("insert into hotel_buste_paga(user_id,mese,netto) values($1,'2026-10-15',1500)",[A]));
await fails(()=>db.query("insert into hotel_buste_paga(user_id,mese,netto) values($1,'2026-10-01',1490)",[A]));
// Sviluppo: cliente, progetto collegato, preventivo, incassi.
const cli=(await rows("insert into clienti(user_id,nome) values($1,'Studio Design') returning id",[A]))[0].id;
const prj=(await rows("insert into projects(user_id,name,cliente_id) values($1,'Shop',$2) returning id,cliente_id",[A,cli]))[0];
assert.equal(prj.cliente_id,cli);
const prev=(await rows("insert into preventivi(user_id,cliente_id,project_id,titolo,importo,stato) values($1,$2,$3,'Fase 2',1200,'accettato') returning id",[A,cli,prj.id]))[0].id;
await rows("insert into incassi(user_id,preventivo_id,importo) values($1,$2,400)",[A,prev]);
await fails(()=>db.query("insert into incassi(user_id,preventivo_id,importo) values($1,$2,0)",[A,prev]));
await fails(()=>db.query("insert into preventivi(user_id,cliente_id,titolo,importo,stato) values($1,$2,'X',10,'pagato')",[A,cli]));
await rows("insert into formazione(user_id,titolo,tipo,stato,ore_previste,ore_fatte) values($1,'RAG','corso','in_corso',10,6)",[A]);
await fails(()=>db.query("insert into formazione(user_id,titolo,stato) values($1,'X','boh')",[A]));

// L'altro utente non vede né tocca niente, e non può collegarsi ai clienti di A.
await role(B);
for(const t of ['hotel_contratto','hotel_assenze','hotel_buste_paga','clienti','preventivi','incassi','formazione'])assert.equal((await rows(`select * from ${t}`)).length,0,t);
assert.equal((await rows("update clienti set nome='Rubato' where id=$1 returning *",[cli])).length,0);
assert.equal((await rows("delete from preventivi where id=$1 returning *",[prev])).length,0);
await fails(()=>db.query("insert into clienti(user_id,nome) values($1,'Finto')",[A]));
await fails(()=>db.query("insert into projects(user_id,name,cliente_id) values($1,'Mio',$2)",[B,cli]));
await fails(()=>db.query("insert into preventivi(user_id,cliente_id,titolo,importo) values($1,$2,'X',1)",[B,cli]));
await db.exec('reset role;set role anon');
for(const t of ['hotel_contratto','clienti','preventivi','formazione'])await fails(()=>db.query(`select * from ${t}`));

// Cancellare un cliente stacca i progetti (restano) e cancella preventivi e incassi.
await role(A);
await rows('delete from clienti where id=$1',[cli]);
assert.equal((await rows('select cliente_id from projects where id=$1',[prj.id]))[0].cliente_id,null);
assert.equal((await rows('select count(*)::int n from preventivi'))[0].n,0);
assert.equal((await rows('select count(*)::int n from incassi'))[0].n,0);
console.log('PASS: lavoro: contratto unico con default, assenze e buste paga valide, clienti/progetti/preventivi/incassi collegati, formazione, isolamento tra utenti, anonimi esclusi e cancellazioni a cascata.');
