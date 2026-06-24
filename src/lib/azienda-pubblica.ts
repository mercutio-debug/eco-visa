/**
 * Lettura PUBBLICA di aziende e prodotti iscritti (per la pagina azienda e per
 * l'elenco prodotti reali). Le tabelle aziende/prodotti/ingredienti sono in
 * sola lettura per chiunque (RLS), così le schede sono consultabili da tutti.
 */
import { supabase } from "./supabase";
import type { IngredientInput } from "./footprint";
import { PLAN_MAP, type Plan } from "./piani";

export type ProdottoPubblico = {
  id: string;
  nome: string;
  categoria: string | null;
  stabilimento_citta: string;
  immagine: string | null;
  prezzo?: string | null;
  prenotabile?: boolean;
  /** ordinabile dai clienti nello shop (Gold) */
  in_shop?: boolean;
  /** descrizione estesa del prodotto (Gold) */
  descrizione?: string | null;
  /** seconda foto, es. etichetta (Gold) */
  foto2?: string | null;
  /** giacenza a magazzino (Gold); null = non gestita */
  giacenza?: number | null;
  /** confezione (flacone, barattolo…), contenuto e unità (Gold) */
  confezione?: string | null;
  contenuto?: number | null;
  unita?: string | null;
  ingredienti: IngredientInput[];
};

export type AziendaPubblica = {
  id: string;
  nome: string;
  citta_sede: string | null;
  sito_web: string | null;
  descrizione?: string | null;
  immagine?: string | null;
  plan?: string | null;
  owner?: string | null;
  lat?: number | null;
  lon?: number | null;
};

/** Servizio extra prenotabile (catalogo: visita, laboratorio, esperienza). */
export type ServizioPubblico = {
  id: string;
  nome: string;
  tipo: string;
  prezzo: number | null;
  descrizione: string | null;
  immagine: string | null;
};

type CatRow = {
  id: string | number;
  nome: string;
  tipo: string;
  prezzo: number | null;
  descrizione: string | null;
  immagine: string | null;
  numero?: number;
};

type ProdRow = {
  id: string;
  nome: string;
  categoria: string | null;
  stabilimento_citta: string | null;
  immagine: string | null;
  prezzo?: string | null;
  prenotabile?: boolean | null;
  in_shop?: boolean | null;
  descrizione?: string | null;
  foto2?: string | null;
  giacenza?: number | null;
  confezione?: string | null;
  contenuto?: number | null;
  unita?: string | null;
  azienda_id: string;
};
type IngRow = { prodotto_id: string; nome: string; origine: string };

/** mappa le righe ingredienti (snake_case) nel formato del calcolatore impronta */
function ingredientiDi(rows: IngRow[], prodottoId: string): IngredientInput[] {
  return rows
    .filter((r) => r.prodotto_id === prodottoId)
    .map((r) => ({ name: r.nome, origin: r.origine }));
}

/** Azienda + i suoi prodotti (con ingredienti) per la pagina pubblica. */
export async function loadAziendaPubblica(
  id: string,
): Promise<{ azienda: AziendaPubblica; prodotti: ProdottoPubblico[]; servizi: ServizioPubblico[]; vendita: ServizioPubblico[] } | null> {
  // select("*"): la colonna "descrizione" potrebbe non esistere ancora nel DB;
  // selezionando tutte le colonne evito errori se manca (sarà semplicemente assente).
  const { data: az } = await supabase
    .from("aziende_pubbliche")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!az) return null;

  const { data: pr } = await supabase
    .from("prodotti")
    .select("*")
    .eq("azienda_id", id);
  const prods = (pr as ProdRow[]) ?? [];

  let ingRows: IngRow[] = [];
  if (prods.length) {
    const { data: ing } = await supabase
      .from("ingredienti")
      .select("prodotto_id,nome,origine")
      .in(
        "prodotto_id",
        prods.map((p) => p.id),
      );
    ingRows = (ing as IngRow[]) ?? [];
  }

  // Diritti per piano CORRENTE dell'azienda: su downgrade si nasconde ciò che
  // il nuovo piano non prevede (foto e prezzo solo Gold; "prenotabile" solo per
  // chi può vendere; numero di prodotti limitato dal piano). I dati restano nel
  // DB ma non vengono esposti finché l'azienda non risale di piano.
  const plan = (((az as AziendaPubblica).plan ?? "free") as Plan);
  const info = PLAN_MAP[plan] ?? PLAN_MAP.free;
  const gold = plan === "gold";
  const limite = info.maxProducts === Infinity ? prods.length : info.maxProducts;

  const prodotti: ProdottoPubblico[] = prods.slice(0, limite).map((p) => ({
    id: p.id,
    nome: p.nome,
    categoria: p.categoria,
    stabilimento_citta: p.stabilimento_citta ?? "",
    immagine: gold ? p.immagine : null,
    prezzo: gold ? (p.prezzo ?? null) : null,
    prenotabile: info.canSell ? (p.prenotabile ?? false) : false,
    in_shop: gold ? (p.in_shop ?? false) : false,
    descrizione: gold ? (p.descrizione ?? null) : null,
    foto2: gold ? (p.foto2 ?? null) : null,
    giacenza: gold ? (p.giacenza ?? null) : null,
    confezione: gold ? (p.confezione ?? null) : null,
    contenuto: gold ? (p.contenuto ?? null) : null,
    unita: gold ? (p.unita ?? null) : null,
    ingredienti: ingredientiDi(ingRows, p.id),
  }));

  // Servizi extra prenotabili (catalogo: visite, laboratori, esperienze):
  // legati all'owner dell'azienda. Lettura pubblica (RLS catalogo: select true).
  // Il catalogo è una funzione Gold → niente da mostrare sotto quel piano.
  let servizi: ServizioPubblico[] = [];
  let vendita: ServizioPubblico[] = [];
  const owner = (az as AziendaPubblica).owner;
  if (owner && gold) {
    const { data: cat } = await supabase
      .from("catalogo")
      .select("id, nome, tipo, prezzo, descrizione, immagine, numero")
      .eq("owner", owner)
      .neq("tipo", "prodotto")
      .order("numero");
    servizi = ((cat as CatRow[]) ?? []).map((c) => ({
      id: String(c.id),
      nome: c.nome,
      tipo: c.tipo,
      prezzo: c.prezzo ?? null,
      descrizione: c.descrizione ?? null,
      immagine: c.immagine ?? null,
    }));

    // Prodotti in vendita (catalogo tipo 'prodotto'): ordinabili dal cliente.
    const { data: catV } = await supabase
      .from("catalogo")
      .select("id, nome, tipo, prezzo, descrizione, immagine, numero")
      .eq("owner", owner)
      .eq("tipo", "prodotto")
      .order("numero");
    vendita = ((catV as CatRow[]) ?? []).map((c) => ({
      id: String(c.id),
      nome: c.nome,
      tipo: c.tipo,
      prezzo: c.prezzo ?? null,
      descrizione: c.descrizione ?? null,
      immagine: c.immagine ?? null,
    }));
  }

  return { azienda: az as AziendaPubblica, prodotti, servizi, vendita };
}

/** Slug url-safe da un nome (minuscolo, accenti rimossi, spazi → -). */
export function aziendaSlug(nome: string): string {
  return (nome || "azienda")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "azienda";
}

export type AziendaElenco = { id: string; nome: string; citta: string | null; slug: string };

/**
 * Elenco pubblico delle aziende iscritte, con uno slug STABILE e UNIVOCO per
 * la pagina condivisibile /azienda/[slug]. Ordino per id (stabile tra build) e
 * disambiguo i nomi duplicati con un suffisso derivato dall'id.
 */
export async function tutteLeAziendePubbliche(): Promise<AziendaElenco[]> {
  let rows: { id: string; nome: string; citta_sede: string | null }[] = [];
  try {
    const { data } = await supabase
      .from("aziende_pubbliche")
      .select("id,nome,citta_sede")
      .order("id");
    rows = (data as typeof rows) ?? [];
  } catch {
    rows = [];
  }
  const used = new Set<string>();
  return rows.map((r) => {
    let slug = aziendaSlug(r.nome);
    if (used.has(slug)) slug = `${slug}-${r.id.slice(0, 4)}`;
    while (used.has(slug)) slug = `${slug}-${r.id.slice(0, 8)}`;
    used.add(slug);
    return { id: r.id, nome: r.nome, citta: r.citta_sede, slug };
  });
}

/** Risolve uno slug nell'azienda corrispondente (per la pagina statica). */
export async function aziendaBySlug(slug: string): Promise<AziendaElenco | null> {
  return (await tutteLeAziendePubbliche()).find((a) => a.slug === slug) ?? null;
}

export type ProdottoConAzienda = ProdottoPubblico & {
  aziendaId: string;
  aziendaNome: string;
};

/** Tutti i prodotti delle aziende iscritte (per l'elenco "Schede prodotto"). */
export async function loadProdottiIscritti(): Promise<ProdottoConAzienda[]> {
  const { data: pr } = await supabase.from("prodotti").select("*");
  const prods = (pr as ProdRow[]) ?? [];
  if (!prods.length) return [];

  const aziendaIds = [...new Set(prods.map((p) => p.azienda_id))];
  const { data: az } = await supabase
    .from("aziende_pubbliche")
    .select("id,nome,plan")
    .in("id", aziendaIds);
  const azById = new Map(
    ((az as { id: string; nome: string; plan?: string | null }[]) ?? []).map((a) => [a.id, a]),
  );

  const { data: ing } = await supabase
    .from("ingredienti")
    .select("prodotto_id,nome,origine")
    .in(
      "prodotto_id",
      prods.map((p) => p.id),
    );
  const ingRows = (ing as IngRow[]) ?? [];

  // Diritti per piano CORRENTE di ciascuna azienda: foto/prezzo solo Gold,
  // "prenotabile" solo per chi vende, numero prodotti limitato dal piano.
  // Su downgrade ciò che eccede il piano sparisce dall'elenco pubblico.
  const planDi = (id: string) => (azById.get(id)?.plan ?? "free") as Plan;
  const contatore = new Map<string, number>();

  return prods
    .filter((p) => {
      const info = PLAN_MAP[planDi(p.azienda_id)] ?? PLAN_MAP.free;
      const n = (contatore.get(p.azienda_id) ?? 0) + 1;
      contatore.set(p.azienda_id, n);
      return n <= info.maxProducts;
    })
    .map((p) => {
      const plan = planDi(p.azienda_id);
      const info = PLAN_MAP[plan] ?? PLAN_MAP.free;
      const gold = plan === "gold";
      return {
        id: p.id,
        nome: p.nome,
        categoria: p.categoria,
        stabilimento_citta: p.stabilimento_citta ?? "",
        immagine: gold ? p.immagine : null,
        prezzo: gold ? (p.prezzo ?? null) : null,
        prenotabile: info.canSell ? (p.prenotabile ?? false) : false,
        ingredienti: ingredientiDi(ingRows, p.id),
        aziendaId: p.azienda_id,
        aziendaNome: azById.get(p.azienda_id)?.nome ?? "Azienda",
      };
    });
}
