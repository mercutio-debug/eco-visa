-- Codice fiscale dell'azienda (puo coincidere con la P.IVA).
-- Idempotente: si puo rieseguire senza errori.
alter table public.aziende add column if not exists codice_fiscale text;
alter table public.dati_fatturazione add column if not exists codice_fiscale text;
