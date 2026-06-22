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

/* ------------------------------------------------------------------ *
 *  Hub regionali — raggruppano le città per regione: poche pagine,
 *  ricche di contenuto e di link interni (rafforzano le pagine-città).
 * ------------------------------------------------------------------ */

/** Città (slug) → regione italiana. Le città non mappate non entrano negli hub
 *  regionali ma mantengono comunque la loro pagina-città. */
const CITY_REGION: Record<string, string> = {
  torino: "Piemonte", cuneo: "Piemonte", asti: "Piemonte", alessandria: "Piemonte",
  novara: "Piemonte", biella: "Piemonte", vercelli: "Piemonte", verbania: "Piemonte",
  aosta: "Valle d'Aosta",
  genova: "Liguria", savona: "Liguria", "la-spezia": "Liguria", imperia: "Liguria",
  milano: "Lombardia", bergamo: "Lombardia", brescia: "Lombardia", como: "Lombardia",
  pavia: "Lombardia", monza: "Lombardia", mantova: "Lombardia", cremona: "Lombardia",
  varese: "Lombardia", lecco: "Lombardia", lodi: "Lombardia", sondrio: "Lombardia",
  trento: "Trentino-Alto Adige", bolzano: "Trentino-Alto Adige",
  venezia: "Veneto", verona: "Veneto", padova: "Veneto", vicenza: "Veneto",
  treviso: "Veneto", rovigo: "Veneto", belluno: "Veneto",
  trieste: "Friuli-Venezia Giulia", udine: "Friuli-Venezia Giulia",
  pordenone: "Friuli-Venezia Giulia", gorizia: "Friuli-Venezia Giulia",
  bologna: "Emilia-Romagna", modena: "Emilia-Romagna", parma: "Emilia-Romagna",
  "reggio-emilia": "Emilia-Romagna", ferrara: "Emilia-Romagna", ravenna: "Emilia-Romagna",
  forli: "Emilia-Romagna", rimini: "Emilia-Romagna", piacenza: "Emilia-Romagna", cesena: "Emilia-Romagna",
  firenze: "Toscana", pisa: "Toscana", siena: "Toscana", lucca: "Toscana",
  livorno: "Toscana", arezzo: "Toscana", grosseto: "Toscana", prato: "Toscana",
  pistoia: "Toscana", massa: "Toscana", carrara: "Toscana",
  perugia: "Umbria", terni: "Umbria",
  ancona: "Marche", pesaro: "Marche", macerata: "Marche", "ascoli-piceno": "Marche", fermo: "Marche",
  roma: "Lazio", latina: "Lazio", frosinone: "Lazio", viterbo: "Lazio", rieti: "Lazio",
  "l-aquila": "Abruzzo", pescara: "Abruzzo", chieti: "Abruzzo", teramo: "Abruzzo",
  campobasso: "Molise", isernia: "Molise",
  napoli: "Campania", salerno: "Campania", caserta: "Campania", avellino: "Campania", benevento: "Campania",
  bari: "Puglia", lecce: "Puglia", taranto: "Puglia", brindisi: "Puglia",
  foggia: "Puglia", andria: "Puglia", barletta: "Puglia", trani: "Puglia",
  potenza: "Basilicata", matera: "Basilicata",
  catanzaro: "Calabria", cosenza: "Calabria", "reggio-calabria": "Calabria",
  crotone: "Calabria", "vibo-valentia": "Calabria",
  palermo: "Sicilia", catania: "Sicilia", messina: "Sicilia", siracusa: "Sicilia",
  trapani: "Sicilia", ragusa: "Sicilia", agrigento: "Sicilia", caltanissetta: "Sicilia", enna: "Sicilia",
  cagliari: "Sardegna", sassari: "Sardegna", nuoro: "Sardegna", oristano: "Sardegna",
};

export type Regione = {
  slug: string;
  nome: string;
  zone: Zona[];
  nStores: number;
  nBio: number;
  nProdotti: number;
  categorie: string[];
};

/** Regione di una città (per breadcrumb dalla pagina-città), null se non mappata. */
export function regioneDiCitta(citta: string): { nome: string; slug: string } | null {
  const nome = CITY_REGION[citySlug(citta)];
  return nome ? { nome, slug: citySlug(nome) } : null;
}

export async function tutteLeRegioni(): Promise<Regione[]> {
  const zone = await tutteLeZone();
  const map = new Map<string, Zona[]>();
  for (const z of zone) {
    const reg = CITY_REGION[citySlug(z.citta)];
    if (!reg) continue;
    map.set(reg, [...(map.get(reg) ?? []), z]);
  }
  return [...map.entries()]
    .map(([nome, zs]) => ({
      slug: citySlug(nome),
      nome,
      zone: zs.sort((a, b) => a.citta.localeCompare(b.citta, "it")),
      nStores: zs.reduce((s, z) => s + z.stores.length, 0),
      nBio: zs.reduce((s, z) => s + z.bio.length, 0),
      nProdotti: zs.reduce((s, z) => s + z.prodotti.length, 0),
      categorie: [...new Set(zs.flatMap((z) => z.categorie))].sort((a, b) =>
        a.localeCompare(b, "it"),
      ),
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "it"));
}

export async function regioneBySlug(slug: string): Promise<Regione | null> {
  return (await tutteLeRegioni()).find((r) => r.slug === slug) ?? null;
}
