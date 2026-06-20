-- "Servizio extra prenotabile": un prodotto Gold può diventare un servizio che
-- il cliente prenota dalla scheda BioFido (visite, laboratori, esperienze). Il
-- flag viene sincronizzato su biofido_businesses.products[].prenotabile.

alter table public.prodotti add column if not exists prenotabile boolean not null default false;
