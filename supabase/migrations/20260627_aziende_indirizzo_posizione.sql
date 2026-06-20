-- Indirizzo preciso + coordinate della sede dell'azienda.
-- Servono a posizionare il segnaposto (mappa di ricerca ECO-VISA e mappa BioFido)
-- sul punto ESATTO dell'attività, non sul centroide del comune.
-- L'utente geocodifica l'indirizzo ("Localizza") e può poi rifinire trascinando
-- il pin sulla mini-mappa della scheda anagrafica.

alter table public.aziende add column if not exists indirizzo text;
alter table public.aziende add column if not exists cap text;
alter table public.aziende add column if not exists provincia text;
alter table public.aziende add column if not exists lat double precision;
alter table public.aziende add column if not exists lon double precision;
