/**
 * Lettura PUBBLICA di aziende e prodotti iscritti (per la pagina azienda e per
 * l'elenco prodotti reali). Le tabelle aziende/prodotti/ingredienti sono in
 * sola lettura per chiunque (RLS), così le schede sono consultabili da tutti.
 */
import { supabase } from "./supabase";
import type { IngredientInput } from "./footprint";

export type ProdottoPubblico = {
  id: string;
  nome: string;
  categoria: string | null;
  stabilimento_citta: string;
  immagine: string | null;
  prezzo?: string | null;
  prenotabile?: boolean;
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

  const prodotti: ProdottoPubblico[] = prods.map((p) => ({
    id: p.id,
    nome: p.nome,
    categoria: p.categoria,
    stabilimento_citta: p.stabilimento_citta ?? "",
    immagine: p.immagine,
    prezzo: p.prezzo ?? null,
    prenotabile: p.prenotabile ?? false,
    ingredienti: ingredientiDi(ingRows, p.id),
  }));

  // Servizi extra prenotabili (catalogo: visite, laboratori, esperienze):
  // legati all'owner dell'azienda. Lettura pubblica (RLS catalogo: select true).
  let servizi: ServizioPubblico[] = [];
  let vendita: ServizioPubblico[] = [];
  const owner = (az as AziendaPubblica).owner;
  if (owner) {
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
    .select("id,nome")
    .in("id", aziendaIds);
  const nomeById = new Map(
    ((az as { id: string; nome: string }[]) ?? []).map((a) => [a.id, a.nome]),
  );

  const { data: ing } = await supabase
    .from("ingredienti")
    .select("prodotto_id,nome,origine")
    .in(
      "prodotto_id",
      prods.map((p) => p.id),
    );
  const ingRows = (ing as IngRow[]) ?? [];

  return prods.map((p) => ({
    id: p.id,
    nome: p.nome,
    categoria: p.categoria,
    stabilimento_citta: p.stabilimento_citta ?? "",
    immagine: p.immagine,
    prezzo: p.prezzo ?? null,
    ingredienti: ingredientiDi(ingRows, p.id),
    aziendaId: p.azienda_id,
    aziendaNome: nomeById.get(p.azienda_id) ?? "Azienda",
  }));
}
