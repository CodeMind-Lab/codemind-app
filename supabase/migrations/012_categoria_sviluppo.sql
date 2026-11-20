-- 012 · Categoria "Sviluppo" (20/11/2026)
-- Due clienti di sviluppo avevano una categoria propria nell'agenda ('diliberto' e
-- 'casa'). Diventano una sola categoria, "dev" (Sviluppo): il cliente si riconosce
-- dal progetto collegato. Voci e obiettivi già salvati vengono spostati; il progetto
-- collegato resta, così un obiettivo legato a un cliente continua a contare solo le
-- sue ore.
--
-- Tutto in una transazione: se qualcosa non torna (per esempio un nome di vincolo
-- diverso), il database resta com'era.
begin;
alter table public.schedule_entries drop constraint if exists schedule_entries_category_check;
alter table public.weekly_goals drop constraint if exists weekly_goals_category_check;
update public.schedule_entries set category = 'dev' where category in ('diliberto', 'casa');
update public.weekly_goals set category = 'dev' where category in ('diliberto', 'casa');
alter table public.schedule_entries add constraint schedule_entries_category_check
  check (category in ('work', 'study', 'dev', 'gym', 'sleep', 'relax', 'personal'));
alter table public.weekly_goals add constraint weekly_goals_category_check
  check (category in ('work', 'study', 'dev', 'gym', 'sleep', 'relax', 'personal'));
commit;
