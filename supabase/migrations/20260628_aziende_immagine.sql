-- Immagine di copertina dell'azienda (URL pubblico nel bucket `catalogo`).
-- Senza questa colonna il salvataggio della scheda anagrafica scartava in
-- automatico l'immagine (fallback "colonna assente"), quindi la foto non veniva
-- memorizzata anche quando l'upload allo storage andava a buon fine.

alter table public.aziende add column if not exists immagine text;
