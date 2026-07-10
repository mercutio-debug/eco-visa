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
  /** durata dell'attività, se è un servizio speciale (es. "2 ore") */
  durata?: string | null;
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
  /** false = shop in attesa di approvazione (prodotti in_shop nascosti al pubblico) */
  shop_approvato?: boolean | null;
};

/** Servizio extra prenotabile (catalogo: visita, laboratorio, esperienza). */
export type ServizioPubblico = {
  id: string;
  nome: string;
  tipo: string;
  prezzo: number | null;
  descrizione: string | null;
  immagine: string | null;
  durata?: string | null;
  lingue?: string[] | null;
  foto2?: string | null;
};

type CatRow = {
  id: string | number;
  nome: string;
  tipo: string;
  prezzo: number | null;
  descrizione: string | null;
  immagine: string | null;
  numero?: number;
  durata?: string | null;
  lingue?: string[] | null;
  foto2?: string | null;
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
  durata?: string | null;
  azienda_id: string;
};
type IngRow = {
  prodotto_id: string;
  nome: string;
  origine: string;
  lat?: number | null;
  lon?: number | null;
};

/** mappa le righe ingredienti (snake_case) nel formato del calcolatore impronta */
function ingredientiDi(rows: IngRow[], prodottoId: string): IngredientInput[] {
  return rows
    .filter((r) => r.prodotto_id === prodottoId)
    .map((r) => ({ name: r.nome, origin: r.origine, lat: r.lat ?? null, lon: r.lon ?? null }));
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
      .select("*")
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
  // foto + descrizione del prodotto: Silver e Gold (Free = solo nome + semaforo).
  // Prezzo, tasto Ordina e foto2 restano Gold.
  const media = info.richProfile;
  const limite = info.maxProducts === Infinity ? prods.length : info.maxProducts;

  // Gate "Ci pensiamo noi": finché l'azienda non approva lo shop (shop_approvato
  // === false), i prodotti messi in vendita (in_shop) NON compaiono al pubblico.
  const shopOk = (az as AziendaPubblica).shop_approvato !== false;
  const visibili = shopOk ? prods : prods.filter((p) => !p.in_shop);

  const prodotti: ProdottoPubblico[] = visibili.slice(0, limite).map((p) => ({
    id: p.id,
    nome: p.nome,
    categoria: p.categoria,
    stabilimento_citta: p.stabilimento_citta ?? "",
    immagine: media ? p.immagine : null,
    prezzo: gold ? (p.prezzo ?? null) : null,
    prenotabile: info.canSell ? (p.prenotabile ?? false) : false,
    in_shop: gold ? (p.in_shop ?? false) : false,
    descrizione: media ? (p.descrizione ?? null) : null,
    foto2: gold ? (p.foto2 ?? null) : null,
    giacenza: gold ? (p.giacenza ?? null) : null,
    confezione: gold ? (p.confezione ?? null) : null,
    contenuto: gold ? (p.contenuto ?? null) : null,
    unita: gold ? (p.unita ?? null) : null,
    durata: gold ? (p.durata ?? null) : null,
    ingredienti: ingredientiDi(ingRows, p.id),
  }));

  // Esperienze in azienda prenotabili (catalogo: visite, laboratori, degustazioni):
  // legate all'owner. Vendibili da Silver e Gold (canSell). I prodotti ORDINABILI
  // dal catalogo (tipo 'prodotto') restano invece Gold (vedi sotto).
  let servizi: ServizioPubblico[] = [];
  let vendita: ServizioPubblico[] = [];
  const owner = (az as AziendaPubblica).owner;
  if (owner && info.canSell) {
    const { data: cat } = await supabase
      .from("catalogo")
      .select("id, nome, tipo, prezzo, descrizione, immagine, numero, durata, lingue, foto2")
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
      durata: c.durata ?? null,
      lingue: c.lingue ?? null,
      foto2: c.foto2 ?? null,
    }));

    // Prodotti in vendita (catalogo tipo 'prodotto'): ordinabili dal cliente.
    // Il tasto Ordina è una funzione Gold → carico la vendita solo per i Gold.
    if (gold) {
      const { data: catV } = await supabase
        .from("catalogo")
        .select("id, nome, tipo, prezzo, descrizione, immagine, numero, durata, lingue, foto2")
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
        durata: c.durata ?? null,
        lingue: c.lingue ?? null,
        foto2: c.foto2 ?? null,
      }));
    }
  }

  // Scheda azienda: Free = solo segnaposto (posizione + tipo + nome). Foto,
  // descrizione e sito compaiono solo da Silver in su (richProfile = media).
  const aziendaOut: AziendaPubblica = {
    ...(az as AziendaPubblica),
    immagine: media ? (az as AziendaPubblica).immagine : null,
    descrizione: media ? (az as AziendaPubblica).descrizione : null,
    sito_web: media ? (az as AziendaPubblica).sito_web : null,
  };
  return { azienda: aziendaOut, prodotti, servizi, vendita };
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

export type AziendaElenco = { id: string; nome: string; citta: string | null; slug: string; immagine: string | null };

/**
 * Elenco pubblico delle aziende iscritte, con uno slug STABILE e UNIVOCO per
 * la pagina condivisibile /azienda/[slug]. Ordino per id (stabile tra build) e
 * disambiguo i nomi duplicati con un suffisso derivato dall'id.
 */
export async function tutteLeAziendePubbliche(): Promise<AziendaElenco[]> {
  let rows: { id: string; nome: string; citta_sede: string | null; immagine: string | null }[] = [];
  try {
    const { data } = await supabase
      .from("aziende_pubbliche")
      .select("id,nome,citta_sede,immagine")
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
    return { id: r.id, nome: r.nome, citta: r.citta_sede, slug, immagine: r.immagine ?? null };
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
    .select("id,nome,plan,shop_approvato")
    .in("id", aziendaIds);
  const azById = new Map(
    ((az as { id: string; nome: string; plan?: string | null; shop_approvato?: boolean | null }[]) ??
      []).map((a) => [a.id, a]),
  );

  const { data: ing } = await supabase
    .from("ingredienti")
    .select("*")
    .in(
      "prodotto_id",
      prods.map((p) => p.id),
    );
  const ingRows = (ing as IngRow[]) ?? [];

  // Diritti per piano CORRENTE di ciascuna azienda: foto/prezzo solo Gold,
  // "prenotabile" solo per chi vende, numero prodotti limitato dal piano.
  // Su downgrade ciò che eccede il piano sparisce dall'elenco pubblico.
  const planDi = (id: string) => (azById.get(id)?.plan ?? "free") as Plan;
  // gate "Ci pensiamo noi": se l'azienda non ha approvato lo shop, i suoi prodotti
  // in vendita (in_shop) non compaiono nemmeno nell'elenco pubblico.
  const shopOkDi = (id: string) => azById.get(id)?.shop_approvato !== false;
  const contatore = new Map<string, number>();

  return prods
    .filter((p) => {
      if (p.in_shop && !shopOkDi(p.azienda_id)) return false;
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
