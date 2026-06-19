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
  ingredienti: IngredientInput[];
};

export type AziendaPubblica = {
  id: string;
  nome: string;
  citta_sede: string | null;
  sito_web: string | null;
};

type ProdRow = {
  id: string;
  nome: string;
  categoria: string | null;
  stabilimento_citta: string | null;
  immagine: string | null;
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
): Promise<{ azienda: AziendaPubblica; prodotti: ProdottoPubblico[] } | null> {
  const { data: az } = await supabase
    .from("aziende")
    .select("id,nome,citta_sede,sito_web")
    .eq("id", id)
    .maybeSingle();
  if (!az) return null;

  const { data: pr } = await supabase
    .from("prodotti")
    .select("id,nome,categoria,stabilimento_citta,immagine,azienda_id")
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
    ingredienti: ingredientiDi(ingRows, p.id),
  }));

  return { azienda: az as AziendaPubblica, prodotti };
}

export type ProdottoConAzienda = ProdottoPubblico & {
  aziendaId: string;
  aziendaNome: string;
};

/** Tutti i prodotti delle aziende iscritte (per l'elenco "Schede prodotto"). */
export async function loadProdottiIscritti(): Promise<ProdottoConAzienda[]> {
  const { data: pr } = await supabase
    .from("prodotti")
    .select("id,nome,categoria,stabilimento_citta,immagine,azienda_id");
  const prods = (pr as ProdRow[]) ?? [];
  if (!prods.length) return [];

  const aziendaIds = [...new Set(prods.map((p) => p.azienda_id))];
  const { data: az } = await supabase
    .from("aziende")
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
    ingredienti: ingredientiDi(ingRows, p.id),
    aziendaId: p.azienda_id,
    aziendaNome: nomeById.get(p.azienda_id) ?? "Azienda",
  }));
}
