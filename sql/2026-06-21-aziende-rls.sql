-- =====================================================================
-- Sicurezza tabella `aziende`: nascondere P.IVA e codice fiscale al pubblico
-- Eseguire nel pannello Supabase → SQL Editor (ref kvpxnxsjiyiixqksinzr)
-- Data: 2026-06-21
-- =====================================================================

-- 1) VISTA PUBBLICA: espone SOLO le colonne non sensibili.
--    Niente `piva`, niente `codice_fiscale`.
--    security_invoker = false (default): la vista bypassa la RLS della
--    tabella base, così il pubblico legge i campi sicuri di tutte le righe,
--    mentre la tabella base resta blindata (punto 2).
create or replace view public.aziende_pubbliche
with (security_invoker = false) as
select id, owner, nome, citta_sede, sito_web, descrizione, plan,
       indirizzo, cap, provincia, lat, lon, immagine, created_at
from public.aziende;

grant select on public.aziende_pubbliche to anon, authenticated;

-- 2) BLINDA la tabella base
alter table public.aziende enable row level security;

-- 2a) rimuove TUTTE le policy esistenti (anche quella permissiva su anon)
do $$
declare p record;
begin
  for p in select policyname from pg_policies
           where schemaname = 'public' and tablename = 'aziende'
  loop
    execute format('drop policy %I on public.aziende', p.policyname);
  end loop;
end $$;

-- 2b) assicura che `owner` venga valorizzato in automatico agli insert
alter table public.aziende alter column owner set default auth.uid();

-- 3) POLICY: lettura/scrittura solo al proprietario (o all'admin)
create policy "aziende_select_owner_admin" on public.aziende
  for select to authenticated
  using (
    auth.uid() = owner
    or (auth.jwt() ->> 'email') = 'mauriziocapitelli@yahoo.it'
  );

create policy "aziende_insert_owner" on public.aziende
  for insert to authenticated
  with check (auth.uid() = owner);

create policy "aziende_update_owner_admin" on public.aziende
  for update to authenticated
  using (
    auth.uid() = owner
    or (auth.jwt() ->> 'email') = 'mauriziocapitelli@yahoo.it'
  )
  with check (
    auth.uid() = owner
    or (auth.jwt() ->> 'email') = 'mauriziocapitelli@yahoo.it'
  );

create policy "aziende_delete_owner_admin" on public.aziende
  for delete to authenticated
  using (
    auth.uid() = owner
    or (auth.jwt() ->> 'email') = 'mauriziocapitelli@yahoo.it'
  );

-- 4) (opzionale) forza il reload dello schema di PostgREST se la vista
--    non risulta subito disponibile dall'app:
-- notify pgrst, 'reload schema';
