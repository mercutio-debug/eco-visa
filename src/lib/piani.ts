/**
 * Piani di abbonamento ECO-VISA.
 *
 * Stessa strategia di BioFido, adattata al servizio ECO-VISA: qui non c'è un
 * marketplace con commissioni, ma uno strumento che misura e mostra l'impronta
 * ecologica. I piani sbloccano più schede prodotto, il badge da incorporare sul
 * proprio sito e una migliore visibilità nella directory pubblica.
 *
 * Unica fonte di verità di prezzi e diritti: cambi qui e si aggiorna ovunque.
 */

export type Plan = "free" | "silver" | "gold";
export type StatsLevel = "none" | "base" | "advanced";

export type PlanInfo = {
  id: Plan;
  label: string;
  /** prezzo mensile in € (0 = gratuito) */
  monthlyPrice: number;
  /** prezzo annuale in € (~2 mesi gratis rispetto al mensile) */
  annualPrice: number;

  /** numero massimo di schede prodotto con impronta (Infinity = illimitate) */
  maxProducts: number;
  /** numero massimo di esperienze/attività prenotabili (Infinity = illimitate) */
  maxEvents: number;
  /** badge/widget ECO-VISA incorporabile sul sito dell'azienda */
  badgeEmbed: boolean;
  /** scheda azienda ricca (logo, storia, link) */
  richProfile: boolean;
  /** spinta nella directory pubblica /prodotti */
  directoryBoost: number;
  /** in evidenza tra gli spacci diretti «Spesa km0» */
  featuredKm0: boolean;
  /** livello di statistiche disponibili */
  statsLevel: StatsLevel;
  /** può offrire SERVIZI EXTRA prenotabili dal cliente (con pagamento) */
  canSell: boolean;
  /** commissione trattenuta sulle prenotazioni (0.15 = 15%) — come BioFido */
  commissionRate: number;
};

/** Ordine dei piani (per capire se un cambio è un downgrade). */
export const PLAN_RANK: Record<Plan, number> = { free: 0, silver: 1, gold: 2 };

/** Vero se passare da `from` a `to` è un downgrade (piano meno ricco). */
export function isDowngrade(from: Plan, to: Plan): boolean {
  return PLAN_RANK[to] < PLAN_RANK[from];
}

/**
 * Elenco leggibile di cosa NON sarà più visibile al pubblico passando dal
 * piano `from` al piano `to` (i dati restano salvati, tornano col re-upgrade).
 * Allineato ai gate di visualizzazione: foto/prezzo e catalogo = Gold;
 * servizi prenotabili = canSell; scheda ricca/badge = richProfile/badgeEmbed.
 */
export function perditeDowngrade(from: Plan, to: Plan): string[] {
  const a = PLAN_MAP[from];
  const b = PLAN_MAP[to];
  const perse: string[] = [];
  if (a.maxProducts > b.maxProducts) {
    const lim = b.maxProducts === Infinity ? "illimitati" : b.maxProducts;
    perse.push(`i prodotti oltre i ${lim} previsti dal piano (restano salvati ma nascosti)`);
  }
  if (from === "gold" && to !== "gold") {
    perse.push("le foto e i prezzi dei prodotti");
    perse.push("il catalogo (prodotti in vendita e servizi su prenotazione)");
  }
  if (a.canSell && !b.canSell) {
    perse.push("i servizi prenotabili e i pagamenti online dei clienti");
  }
  if (a.richProfile && !b.richProfile) {
    perse.push("la scheda ricca: copertina, descrizione e link al sito");
  }
  if (a.badgeEmbed && !b.badgeEmbed) {
    perse.push("il badge ECO-VISA da incorporare nel tuo sito");
  }
  if (a.statsLevel !== "none" && b.statsLevel === "none") {
    perse.push("le statistiche di visite e azioni");
  } else if (a.statsLevel === "advanced" && b.statsLevel === "base") {
    perse.push("le statistiche avanzate (resta quella base)");
  }
  return perse;
}

export const PLAN_MAP: Record<Plan, PlanInfo> = {
  free: {
    id: "free", label: "Gratuito", monthlyPrice: 0, annualPrice: 0,
    maxProducts: 1, maxEvents: 0, badgeEmbed: false, richProfile: false,
    directoryBoost: 0, featuredKm0: false, statsLevel: "none",
    canSell: false, commissionRate: 0,
  },
  silver: {
    id: "silver", label: "Silver", monthlyPrice: 9, annualPrice: 90,
    maxProducts: 10, maxEvents: 1, badgeEmbed: true, richProfile: true,
    directoryBoost: 10, featuredKm0: false, statsLevel: "base",
    canSell: true, commissionRate: 0.15,
  },
  gold: {
    id: "gold", label: "Gold", monthlyPrice: 19, annualPrice: 190,
    maxProducts: 100, maxEvents: Infinity, badgeEmbed: true, richProfile: true,
    directoryBoost: 25, featuredKm0: true, statsLevel: "advanced",
    canSell: true, commissionRate: 0.08,
  },
};
