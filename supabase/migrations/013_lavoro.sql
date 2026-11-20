-- 013 · Lavoro Hotel e Lavoro Sviluppo (20/11/2026)
--
-- Hotel: il contratto (paga e regole per contare le ore), ferie/permessi/malattia,
-- buste paga ricevute. I turni restano in schedule_entries (kind shift/off) e le note
-- di turno sono le note del turno stesso: niente doppioni.
-- Sviluppo: clienti (collegati ai progetti), preventivi con i loro incassi, e la lista
-- di Formazione AI. Le ore per progetto si ricavano dall'Agenda (categoria dev).
--
-- Stesse regole delle altre tabelle: ogni riga ha un proprietario, solo lui la vede e
-- la modifica (RLS), updated_at si aggiorna da solo e serve a fermare le scritture
-- vecchie arrivate da un altro dispositivo. Tutto in una transazione.
begin;

create table public.hotel_contratto (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null unique references public.profiles(id) on delete cascade,
 netto_mensile numeric(10,2) check (netto_mensile is null or netto_mensile >= 0),
 lordo_mensile numeric(10,2) check (lordo_mensile is null or lordo_mensile >= 0),
 -- mensilità in più: per esempio [{"mese":7,"nome":"14ª"},{"mese":12,"nome":"13ª"}]
 mensilita_extra jsonb not null default '[]' check (jsonb_typeof(mensilita_extra) = 'array'),
 ore_giornaliere numeric(4,2) not null default 8 check (ore_giornaliere > 0 and ore_giornaliere <= 24),
 ore_settimanali numeric(5,2) not null default 40 check (ore_settimanali > 0 and ore_settimanali <= 84),
 notte_inizio time not null default '22:00',
 notte_fine time not null default '06:00',
 ferie_giorni_anno numeric(5,2) check (ferie_giorni_anno is null or ferie_giorni_anno between 0 and 60),
 permessi_ore_anno numeric(6,2) check (permessi_ore_anno is null or permessi_ore_anno between 0 and 500),
 ferie_saldo_iniziale numeric(6,2) not null default 0 check (ferie_saldo_iniziale between -60 and 200),
 permessi_saldo_iniziale numeric(7,2) not null default 0 check (permessi_saldo_iniziale between -500 and 1000),
 anno_saldo integer not null default extract(year from now())::integer check (anno_saldo between 2000 and 2100),
 note text not null default '' check (length(note) <= 5000),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.hotel_assenze (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles(id) on delete cascade,
 data date not null,
 tipo text not null check (tipo in ('ferie', 'permesso', 'malattia', 'altro')),
 -- per i permessi conta le ore; ferie e malattia valgono il giorno intero
 ore numeric(4,2) check (ore is null or (ore > 0 and ore <= 24)),
 note text not null default '' check (length(note) <= 2000),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique (user_id, data, tipo),
 check (tipo <> 'permesso' or ore is not null)
);

create table public.hotel_buste_paga (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles(id) on delete cascade,
 mese date not null check (extract(day from mese) = 1),
 netto numeric(10,2) not null check (netto >= 0),
 lordo numeric(10,2) check (lordo is null or lordo >= 0),
 ore_pagate numeric(6,2) check (ore_pagate is null or ore_pagate >= 0),
 straordinari_pagati numeric(6,2) check (straordinari_pagati is null or straordinari_pagati >= 0),
 note text not null default '' check (length(note) <= 2000),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique (user_id, mese)
);

create table public.clienti (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles(id) on delete cascade,
 nome text not null check (length(btrim(nome)) between 1 and 120),
 referente text not null default '' check (length(referente) <= 120),
 email text not null default '' check (length(email) <= 200),
 telefono text not null default '' check (length(telefono) <= 40),
 sito text not null default '' check (length(sito) <= 300),
 colore text not null default '#5B4BC4' check (colore ~ '^#[0-9a-fA-F]{6}$'),
 interno boolean not null default false,
 archiviato boolean not null default false,
 note text not null default '' check (length(note) <= 5000),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique (id, user_id)
);

alter table public.projects add column cliente_id uuid;
alter table public.projects add constraint projects_cliente_fk
 foreign key (cliente_id, user_id) references public.clienti(id, user_id) on delete set null (cliente_id);
create index projects_cliente on public.projects(cliente_id);

create table public.preventivi (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles(id) on delete cascade,
 cliente_id uuid not null,
 project_id uuid,
 titolo text not null check (length(btrim(titolo)) between 1 and 200),
 importo numeric(10,2) not null check (importo >= 0),
 stato text not null default 'bozza' check (stato in ('bozza', 'inviato', 'accettato', 'rifiutato')),
 data date not null default current_date,
 scadenza date,
 note text not null default '' check (length(note) <= 5000),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique (id, user_id),
 foreign key (cliente_id, user_id) references public.clienti(id, user_id) on delete cascade,
 foreign key (project_id, user_id) references public.projects(id, user_id) on delete set null (project_id)
);
create index preventivi_cliente on public.preventivi(cliente_id);

create table public.incassi (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles(id) on delete cascade,
 preventivo_id uuid not null,
 data date not null default current_date,
 importo numeric(10,2) not null check (importo > 0),
 note text not null default '' check (length(note) <= 2000),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 foreign key (preventivo_id, user_id) references public.preventivi(id, user_id) on delete cascade
);
create index incassi_preventivo on public.incassi(preventivo_id);

create table public.formazione (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles(id) on delete cascade,
 titolo text not null check (length(btrim(titolo)) between 1 and 200),
 tipo text not null default 'corso' check (tipo in ('corso', 'video', 'libro', 'articolo', 'documentazione', 'altro')),
 link text not null default '' check (length(link) <= 500),
 stato text not null default 'da_fare' check (stato in ('da_fare', 'in_corso', 'finito')),
 ore_previste numeric(6,2) check (ore_previste is null or ore_previste >= 0),
 ore_fatte numeric(6,2) not null default 0 check (ore_fatte >= 0),
 note text not null default '' check (length(note) <= 5000),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

do $$declare t text; begin
 foreach t in array array['hotel_contratto','hotel_assenze','hotel_buste_paga','clienti','preventivi','incassi','formazione'] loop
  execute format('create trigger touch_timestamp before update on public.%I for each row execute function public.touch_updated_at()',t);
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from anon,authenticated',t);
  execute format('grant select,insert,update,delete on public.%I to authenticated',t);
  execute format('create policy own_select on public.%I for select to authenticated using(user_id=(select auth.uid()))',t);
  execute format('create policy own_insert on public.%I for insert to authenticated with check(user_id=(select auth.uid()))',t);
  execute format('create policy own_update on public.%I for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()))',t);
  execute format('create policy own_delete on public.%I for delete to authenticated using(user_id=(select auth.uid()))',t);
 end loop;
end; $$;

commit;
