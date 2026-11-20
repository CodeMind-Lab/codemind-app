-- 014 · Università (20/11/2026)
--
-- Le materie restano righe di projects con i dati nel JSON delle note
-- (CODEMIND_UNIVERSITY_V1): lì stanno anche il numero di lezioni, fin dove arriva la
-- prova intermedia e la scheda ufficiale. Qui le parti che crescono nel tempo:
-- registro lezioni, piano di studio, appelli, simulazioni, errori da ripassare,
-- elaborati. Ogni riga appartiene a una materia dello stesso utente; cancellando la
-- materia si cancella tutto il resto.
--
-- Stesse regole delle altre tabelle (proprietario, RLS, updated_at). Una transazione.
begin;

create table public.uni_lezioni (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles(id) on delete cascade,
 materia_id uuid not null,
 numero integer not null check (numero between 1 and 500),
 titolo text not null default '' check (length(titolo) <= 300),
 seguita boolean not null default false,
 data_seguita date,
 note text not null default '' check (length(note) <= 2000),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique (user_id, materia_id, numero),
 foreign key (materia_id, user_id) references public.projects(id, user_id) on delete cascade
);

create table public.uni_piano (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles(id) on delete cascade,
 materia_id uuid not null,
 posizione integer not null default 0 check (posizione >= 0),
 settimana text not null default '' check (length(settimana) <= 60),
 argomento text not null check (length(btrim(argomento)) between 1 and 300),
 lezioni text not null default '' check (length(lezioni) <= 120),
 ore numeric(6,2) check (ore is null or ore between 0 and 500),
 fatto boolean not null default false,
 note text not null default '' check (length(note) <= 2000),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 foreign key (materia_id, user_id) references public.projects(id, user_id) on delete cascade
);

create table public.uni_appelli (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles(id) on delete cascade,
 materia_id uuid not null,
 data date not null,
 ora time,
 prova text not null default 'unica' check (prova in ('intermedia', 'finale', 'unica')),
 modalita text not null default '' check (length(modalita) <= 120),
 iscrizione_entro date,
 iscritto boolean not null default false,
 esito text not null default '' check (esito in ('', 'superato', 'non_superato', 'ritirato', 'assente')),
 punti numeric(5,2) check (punti is null or punti between 0 and 100),
 note text not null default '' check (length(note) <= 2000),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 foreign key (materia_id, user_id) references public.projects(id, user_id) on delete cascade
);

create table public.uni_simulazioni (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles(id) on delete cascade,
 materia_id uuid not null,
 data date not null default current_date,
 prova text not null default 'intermedia' check (prova in ('intermedia', 'finale', 'unica')),
 domande integer not null check (domande between 1 and 200),
 corrette integer not null check (corrette >= 0),
 minuti integer check (minuti is null or minuti between 1 and 600),
 note text not null default '' check (length(note) <= 2000),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check (corrette <= domande),
 foreign key (materia_id, user_id) references public.projects(id, user_id) on delete cascade
);

create table public.uni_errori (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles(id) on delete cascade,
 materia_id uuid not null,
 lezione integer check (lezione is null or lezione between 1 and 500),
 domanda text not null check (length(btrim(domanda)) between 1 and 1000),
 risposta text not null default '' check (length(risposta) <= 2000),
 spiegazione text not null default '' check (length(spiegazione) <= 5000),
 ripassi integer not null default 0 check (ripassi between 0 and 50),
 prossimo_ripasso date,
 risolto boolean not null default false,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 foreign key (materia_id, user_id) references public.projects(id, user_id) on delete cascade
);

create table public.uni_elaborati (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles(id) on delete cascade,
 materia_id uuid not null,
 titolo text not null check (length(btrim(titolo)) between 1 and 200),
 scadenza date,
 stato text not null default 'da_iniziare' check (stato in ('da_iniziare', 'in_corso', 'consegnato', 'valutato')),
 punti numeric(4,2) check (punti is null or punti between 0 and 10),
 link text not null default '' check (length(link) <= 500),
 note text not null default '' check (length(note) <= 5000),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 foreign key (materia_id, user_id) references public.projects(id, user_id) on delete cascade
);

create index uni_piano_materia on public.uni_piano(materia_id, posizione);
create index uni_appelli_data on public.uni_appelli(user_id, data);
create index uni_simulazioni_materia on public.uni_simulazioni(materia_id, data);
create index uni_errori_materia on public.uni_errori(materia_id);
create index uni_elaborati_materia on public.uni_elaborati(materia_id);

-- RLS scritta tabella per tabella (e non in un ciclo) perché il controllo del SQL
-- Editor di Supabase la riconosca e non chieda conferme.
alter table public.uni_lezioni enable row level security;
alter table public.uni_piano enable row level security;
alter table public.uni_appelli enable row level security;
alter table public.uni_simulazioni enable row level security;
alter table public.uni_errori enable row level security;
alter table public.uni_elaborati enable row level security;

do $$declare t text; begin
 foreach t in array array['uni_lezioni','uni_piano','uni_appelli','uni_simulazioni','uni_errori','uni_elaborati'] loop
  execute format('create trigger touch_timestamp before update on public.%I for each row execute function public.touch_updated_at()',t);
  execute format('revoke all on public.%I from anon,authenticated',t);
  execute format('grant select,insert,update,delete on public.%I to authenticated',t);
  execute format('create policy own_select on public.%I for select to authenticated using(user_id=(select auth.uid()))',t);
  execute format('create policy own_insert on public.%I for insert to authenticated with check(user_id=(select auth.uid()))',t);
  execute format('create policy own_update on public.%I for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()))',t);
  execute format('create policy own_delete on public.%I for delete to authenticated using(user_id=(select auth.uid()))',t);
 end loop;
end; $$;

commit;
