/**
 * Identità del portale corrente. ECO-VISA e BioFido condividono la logica della
 * scheda di iscrizione (automatismi e verifiche), ma differenziano l'interfaccia:
 *  - ECO-VISA accetta sia aziende convenzionali sia biologiche, e a chi è bio
 *    propone l'iscrizione anche a BioFido;
 *  - BioFido è RISERVATO alle aziende biologiche certificate (bio obbligatorio).
 */
export type Portale = "ecovisa" | "biofido";
export const PORTALE: Portale = "ecovisa";
export const NOME_PORTALE = "ECO-VISA";

/** Su ECO-VISA il biologico è opzionale (si può essere convenzionali). */
export const SOLO_BIO = false;

/** URL dell'altro portale (per le proposte di iscrizione incrociata). */
export const URL_ECOVISA = "https://ecovisa.it";
export const URL_BIOFIDO = "https://biofido.it/";
