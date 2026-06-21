/**
 * SEO programmatica — "zone" (città). Aggrega per città gli spacci km0, i
 * produttori bio e i prodotti, così generiamo al build una landing per ogni
 * località: motore di acquisizione organica, statico (output: export).
 *
 * Dati REALI: ai prodotti dimostrativi unisce i prodotti delle aziende iscritte
 * letti da Supabase (`loadProdottiIscritti`, lettura pubblica). Se il DB è vuoto
 * o irraggiungibile al build, restano i soli dati statici. Le funzioni sono
 * async: generateStaticParams, le pagine e la sitemap le awaitano.
 */
import {
  PRODUCTS,
  BIO_PRODUCERS,
  KM0_STORES,
  type BioProducer,
  type Km0Store,
} from "./data";
import { computeFootprint } from "./footprint";
import { loadProdottiIscritti } from "./azienda-pubblica";

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
  /** slug della scheda statica; vuoto per i prodotti reali (nessuna pagina /prodotti/[slug]) */
  slug: string;
  name: string;
  category: string;
  company: string;
  totalCo2Kg: number;
  level: ReturnType<typeof computeFootprint>["level"];
  /** true se proviene da un'azienda realmente iscritta (Supabase) */
  real?: boolean;
};

export type Zona = {
  slug: string;
  citta: string;
  stores: Km0Store[];
  bio: BioProducer[];
  prodotti: ZonaProdotto[];
  categorie: string[];
};

/** Prodotti reali delle aziende iscritte, raggruppati per città di stabilimento. */
async function prodottiRealiPerCitta(): Promise<Map<string, ZonaProdotto[]>> {
  const map = new Map<string, ZonaProdotto[]>();
  try {
    const list = await loadProdottiIscritti();
    for (const p of list) {
      const citta = (p.stabilimento_citta ?? "").trim();
      if (!citta) continue;
      const fp = computeFootprint(citta, p.ingredienti);
      const item: ZonaProdotto = {
        slug: "",
        name: p.nome,
        category: p.categoria ?? "Prodotto",
        company: p.aziendaNome,
        totalCo2Kg: fp.totalCo2Kg,
        level: fp.level,
        real: true,
      };
      map.set(citta, [...(map.get(citta) ?? []), item]);
    }
  } catch {
    // build offline o tabelle non leggibili: si prosegue con i soli dati statici
  }
  return map;
}

function buildZona(citta: string, reali: ZonaProdotto[]): Zona | null {
  const stores = KM0_STORES.filter((s) => s.city === citta);
  const bio = BIO_PRODUCERS.filter((b) => b.city === citta);
  const statici: ZonaProdotto[] = PRODUCTS.filter((p) => p.plant === citta).map(
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
  const prodotti = [...reali, ...statici];
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

export async function tutteLeZone(): Promise<Zona[]> {
  const reali = await prodottiRealiPerCitta();
  const citta = new Set<string>();
  KM0_STORES.forEach((s) => citta.add(s.city));
  BIO_PRODUCERS.forEach((b) => citta.add(b.city));
  PRODUCTS.forEach((p) => citta.add(p.plant));
  reali.forEach((_, c) => citta.add(c));
  return [...citta]
    .sort((a, b) => a.localeCompare(b, "it"))
    .map((c) => buildZona(c, reali.get(c) ?? []))
    .filter((z): z is Zona => z !== null);
}

export async function zonaBySlug(slug: string): Promise<Zona | null> {
  const zone = await tutteLeZone();
  return zone.find((z) => z.slug === slug) ?? null;
}
