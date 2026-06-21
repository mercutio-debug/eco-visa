/**
 * SEO programmatica — "zone" (città). Aggrega i dataset pubblici (spacci km0,
 * produttori bio, prodotti con impronta) per città, così possiamo generare al
 * build una landing per ogni località: è il motore di acquisizione organica
 * (una pagina per "spesa a km zero a {Città}", indicizzabile e statica).
 *
 * Stessa sorgente dati statica usata dal resto del sito (lib/data). Quando le
 * aziende reali su Supabase saranno numerose, qui si aggiunge una fetch al
 * build per includerle nell'HTML statico (stesso schema, nessun redesign).
 */
import {
  PRODUCTS,
  BIO_PRODUCERS,
  KM0_STORES,
  type BioProducer,
  type Km0Store,
} from "./data";
import { computeFootprint } from "./footprint";

/** Slug url-safe da un nome di città (minuscolo, accenti rimossi, spazi → -). */
export function citySlug(city: string): string {
  return city
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export type ZonaProdotto = {
  slug: string;
  name: string;
  category: string;
  company: string;
  totalCo2Kg: number;
  level: ReturnType<typeof computeFootprint>["level"];
};

export type Zona = {
  slug: string;
  citta: string;
  stores: Km0Store[];
  bio: BioProducer[];
  prodotti: ZonaProdotto[];
  categorie: string[];
};

/** Tutte le città presenti nei dataset (spacci, produttori bio, stabilimenti). */
function tutteLeCitta(): string[] {
  const set = new Set<string>();
  KM0_STORES.forEach((s) => set.add(s.city));
  BIO_PRODUCERS.forEach((b) => set.add(b.city));
  PRODUCTS.forEach((p) => set.add(p.plant));
  return [...set].sort((a, b) => a.localeCompare(b, "it"));
}

/** Aggregato di una città; null se non c'è nulla da mostrare. */
export function zonaDi(citta: string): Zona | null {
  const stores = KM0_STORES.filter((s) => s.city === citta);
  const bio = BIO_PRODUCERS.filter((b) => b.city === citta);
  const prodotti: ZonaProdotto[] = PRODUCTS.filter((p) => p.plant === citta).map(
    (p) => {
      const fp = computeFootprint(p.plant, p.ingredients);
      return {
        slug: p.slug,
        name: p.name,
        category: p.category,
        company: p.company.name,
        totalCo2Kg: fp.totalCo2Kg,
        level: fp.level,
      };
    },
  );
  if (!stores.length && !bio.length && !prodotti.length) return null;
  const categorie = [
    ...new Set([
      ...stores.map((s) => s.category),
      ...bio.map((b) => b.category),
      ...prodotti.map((p) => p.category),
    ]),
  ].sort((a, b) => a.localeCompare(b, "it"));
  return { slug: citySlug(citta), citta, stores, bio, prodotti, categorie };
}

/** Tutte le zone con almeno un contenuto (per l'indice e generateStaticParams). */
export function tutteLeZone(): Zona[] {
  return tutteLeCitta()
    .map((c) => zonaDi(c))
    .filter((z): z is Zona => z !== null);
}

export function zonaBySlug(slug: string): Zona | null {
  const citta = tutteLeCitta().find((c) => citySlug(c) === slug);
  return citta ? zonaDi(citta) : null;
}
