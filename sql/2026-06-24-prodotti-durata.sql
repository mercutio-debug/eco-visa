-- =====================================================================
-- Servizi speciali: colonna "durata" sui prodotti (ECO-VISA)
-- Eseguire nel pannello Supabase → SQL Editor (ref kvpxnxsjiyiixqksinzr)
-- Data: 2026-06-24
--
-- Quando un prodotto viene salvato come "servizio speciale" (visita guidata,
-- laboratorio, esperienza…) l'azienda può indicare anche la DURATA.
-- (La descrizione estesa usa la colonna `descrizione` già esistente, la foto
--  extra la colonna `foto2` già esistente.)
-- Finché questa colonna non esiste, il salvataggio funziona comunque saltando
-- il campo (fallback nel codice): dopo la migrazione la durata viene salvata.
-- =====================================================================

alter table public.prodotti add column if not exists durata text;

-- (facoltativo) ricarica lo schema di PostgREST se l'app non vede subito la colonna:
-- notify pgrst, 'reload schema';
