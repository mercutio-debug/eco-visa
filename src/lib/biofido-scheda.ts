/**
 * Iscrizione a BioFido GESTITA DA ECO-VISA (login unico, nessun salto di sito).
 * Spuntare il flag su ECO-VISA scrive la stessa tabella Supabase
 * `biofido_businesses` letta dall'app BioFido: la mappa (anche quella pubblica su
 * GitHub Pages) si aggiorna da sola, perché legge il database condiviso.
 *
 * Il segnaposto si costruisce dai dati che l'azienda ha GIÀ inserito su ECO-VISA
 * (nome + città della scheda anagrafica): niente form duplicati.
 */
import { supabase } from "./supabase";
import { prefetchGeocode } from "./geo";
import { formatPrezzo } from "./prezzo";

export type BioCategory = "agricola" | "negozio" | "ristorante" | "artigiano";

export const BIO_CATEGORIES: { id: BioCategory; label: string; emoji: string }[] = [
  { id: "agricola", label: "Azienda agricola", emoji: "🌾" },
  { id: "negozio", label: "Negozio prodotti bio", emoji: "🛒" },
  { id: "ristorante", label: "Ristorante / agriturismo", emoji: "🍽️" },
  { id: "artigiano", label: "Artigiano", emoji: "🛠️" },
];

export type BioPlan = "free" | "silver" | "gold";

/** Vero se l'azienda ha già un segnaposto sulla mappa di BioFido. */
export async function isOnBioMap(owner: string): Promise<boolean> {
  const { data } = await supabase
    .from("biofido_businesses")
    .select("id")
    .eq("owner", owner)
    .limit(1)
    .maybeSingle();
  return !!data;
}

/**
 * Iscrive l'azienda a BioFido: imposta il flag e crea/aggiorna il segnaposto
 * sulla mappa a partire dai dati anagrafici (nome + città → coordinate).
 */
export async function enrollBioFido(
  owner: string,
  data: { nome: string; citta: string; categoria: BioCategory; lat?: number | null; lon?: number | null },
): Promise<{ error?: string }> {
  if (!data.nome.trim() || !data.citta.trim()) {
    return { error: "Completa prima nome e città nella Scheda anagrafica." };
  }
  // Preferisco la posizione PRECISA scelta sulla scheda anagrafica (indirizzo +
  // segnaposto sulla mappa); se manca, ripiego sul centroide del comune.
  let p: { lat: number; lon: number } | null =
    data.lat != null && data.lon != null ? { lat: Number(data.lat), lon: Number(data.lon) } : null;
  if (!p) p = await prefetchGeocode(data.citta);
  if (!p) {
    return { error: "Città non riconosciuta: controlla la città nella Scheda anagrafica." };
  }
  // contrassegno sull'account
  const { error: flagErr } = await supabase.auth.updateUser({
    data: { vuole_biofido: true },
  });
  if (flagErr) return { error: flagErr.message };
  // crea o aggiorna il segnaposto (mantiene il piano se esiste già)
  const { data: ex } = await supabase
    .from("biofido_businesses")
    .select("id, plan")
    .eq("owner", owner)
    .limit(1)
    .maybeSingle();
  const payload = {
    owner,
    name: data.nome,
    category: data.categoria,
    plan: ((ex as { plan?: string } | null)?.plan as BioPlan) ?? "free",
    city: data.citta,
    lat: p.lat,
    lon: p.lon,
  };
  const { error } = ex
    ? await supabase.from("biofido_businesses").update(payload).eq("id", (ex as { id: string | number }).id)
    : await supabase.from("biofido_businesses").insert(payload);
  if (error) return { error: error.message };
  // popola subito descrizione/sito/prodotti dalla scheda ECO-VISA
  await syncBioFido(owner);
  return {};
}

/**
 * Allinea la scheda BioFido ai dati ECO-VISA dell'azienda: descrizione, sito,
 * PRODOTTI (con prezzo e foto) e piano. Senza questo, la scheda sulla mappa
 * resterebbe scarna (solo nome/città) anche per un Gold. No-op se non iscritta.
 */
export async function syncBioFido(owner: string, plan?: BioPlan): Promise<void> {
  const { data: ex } = await supabase
    .from("biofido_businesses")
    .select("id")
    .eq("owner", owner)
    .limit(1)
    .maybeSingle();
  if (!ex) return;

  // dati anagrafici (descrizione, sito). select("*"): la colonna descrizione
  // potrebbe non esistere su DB più vecchi → evito errori.
  const { data: az } = await supabase.from("aziende").select("*").limit(1).maybeSingle();
  const a = az as {
    id?: string;
    descrizione?: string | null;
    sito_web?: string | null;
    immagine?: string | null;
  } | null;

  // prodotti → elenco {id, name, price, image, prenotabile, ingredients} per BioFido.
  // L'id lega la prenotazione al listino (il pagamento ricalcola dalla fonte vera).
  // GLI INGREDIENTI (geocodificati) servono perché il semaforo che un prodotto ha
  // su ECO-VISA appaia IDENTICO anche su BioFido (è il nostro elemento distintivo).
  type MP = { nome: string; origine: string; lat?: number; lon?: number };
  let products:
    | {
        id?: string;
        name: string;
        price?: string;
        image?: string;
        prenotabile?: boolean;
        ingredients?: MP[];
        in_shop?: boolean;
        giacenza?: number;
        foto2?: string;
        description?: string;
        category?: string;
      }[]
    | null = null;
  if (a?.id) {
    const { data: pr } = await supabase.from("prodotti").select("*").eq("azienda_id", a.id);
    const prodotti =
      (pr as {
        id: string;
        nome: string;
        prezzo?: string | null;
        immagine?: string | null;
        prenotabile?: boolean | null;
        in_shop?: boolean | null;
        giacenza?: number | null;
        foto2?: string | null;
        descrizione?: string | null;
        categoria?: string | null;
      }[]) ?? [];
    const ids = prodotti.map((p) => p.id);
    // ingredienti dei prodotti → geocodificati (lat/lon) per il semaforo BioFido
    const ingByProd = new Map<string, MP[]>();
    if (ids.length) {
      const { data: ing } = await supabase
        .from("ingredienti")
        .select("prodotto_id,nome,origine")
        .in("prodotto_id", ids);
      for (const r of (ing as { prodotto_id: string; nome: string; origine: string }[]) ?? []) {
        const g = await prefetchGeocode(r.origine);
        const arr = ingByProd.get(r.prodotto_id) ?? [];
        arr.push({ nome: r.nome, origine: r.origine, ...(g ? { lat: g.lat, lon: g.lon } : {}) });
        ingByProd.set(r.prodotto_id, arr);
      }
    }
    const list = prodotti
      .filter((p) => p.nome?.trim())
      .map((p) => {
        const ingredients = ingByProd.get(p.id);
        return {
          id: p.id,
          name: p.nome,
          ...(p.prezzo ? { price: formatPrezzo(p.prezzo) } : {}),
          ...(p.immagine ? { image: p.immagine } : {}),
          ...(p.prenotabile ? { prenotabile: true } : {}),
          ...(ingredients && ingredients.length ? { ingredients } : {}),
          ...(p.in_shop ? { in_shop: true } : {}),
          ...(p.giacenza != null ? { giacenza: p.giacenza } : {}),
          ...(p.foto2 ? { foto2: p.foto2 } : {}),
          ...(p.descrizione ? { description: p.descrizione } : {}),
          ...(p.categoria ? { category: p.categoria } : {}),
        };
      });
    products = list.length ? list : null;
  }

  const payload: Record<string, unknown> = {
    description: a?.descrizione ?? null,
    website: a?.sito_web ?? null,
    immagine: a?.immagine ?? null,
    products,
  };
  if (plan) payload.plan = plan;
  // se la colonna immagine non esiste ancora su biofido_businesses, riprovo senza
  let { error } = await supabase
    .from("biofido_businesses")
    .update(payload)
    .eq("id", (ex as { id: string | number }).id);
  if (error && /immagine/i.test(error.message)) {
    delete payload.immagine;
    ({ error } = await supabase
      .from("biofido_businesses")
      .update(payload)
      .eq("id", (ex as { id: string | number }).id));
  }
}

/** Disiscrive l'azienda: toglie il flag e rimuove il segnaposto dalla mappa. */
export async function unenrollBioFido(owner: string): Promise<{ error?: string }> {
  await supabase.auth.updateUser({ data: { vuole_biofido: false } });
  const { error } = await supabase
    .from("biofido_businesses")
    .delete()
    .eq("owner", owner);
  return { error: error?.message };
}
