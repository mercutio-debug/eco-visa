-- Codice fiscale dell'azienda (puo coincidere con la P.IVA).
alter table public.aziende add column if not exists codice_fiscale text;
