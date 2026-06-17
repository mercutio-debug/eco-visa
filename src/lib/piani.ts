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
};

export const PLAN_MAP: Record<Plan, PlanInfo> = {
  free: {
    id: "free", label: "Gratuito", monthlyPrice: 0, annualPrice: 0,
    maxProducts: 1, badgeEmbed: false, richProfile: false,
    directoryBoost: 0, featuredKm0: false, statsLevel: "none",
  },
  silver: {
    id: "silver", label: "Silver", monthlyPrice: 9, annualPrice: 90,
    maxProducts: 10, badgeEmbed: true, richProfile: true,
    directoryBoost: 10, featuredKm0: false, statsLevel: "base",
  },
  gold: {
    id: "gold", label: "Gold", monthlyPrice: 24, annualPrice: 240,
    maxProducts: 100, badgeEmbed: true, richProfile: true,
    directoryBoost: 25, featuredKm0: true, statsLevel: "advanced",
  },
};
