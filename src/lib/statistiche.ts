import { supabase } from "./supabase";

const GIORNO_MS = 24 * 60 * 60 * 1000;

/**
 * Registra una visita alla scheda dell'azienda (fire-and-forget): non deve mai
 * bloccare o rallentare la pagina pubblica. Da chiamare quando un visitatore
 * apre la scheda di un'azienda.
 */
export async function registraVisita(owner: string, prodottoId?: string): Promise<void> {
  if (!owner) return;
  try {
    await supabase.from("biofido_visite").insert({ owner, prodotto_id: prodottoId ?? null });
  } catch {
    /* il conteggio visite è "best effort": ignoriamo gli errori */
  }
}

export type Statistiche = {
  totale: number;
  ultimi7: number;
  ultimi30: number;
  /** conteggio per ciascuno degli ultimi 30 giorni (dal più vecchio al più recente) */
  perGiorno: { giorno: string; n: number }[];
};

/** Statistiche di visita dell'azienda loggata (RLS: vede solo le sue). */
export async function caricaStatistiche(owner: string): Promise<Statistiche> {
  const ora = Date.now();
  const da30 = new Date(ora - 30 * GIORNO_MS).toISOString();
  const soglia7 = ora - 7 * GIORNO_MS;

  const [{ count }, { data }] = await Promise.all([
    supabase
      .from("biofido_visite")
      .select("*", { count: "exact", head: true })
      .eq("owner", owner),
    supabase
      .from("biofido_visite")
      .select("created_at")
      .eq("owner", owner)
      .gte("created_at", da30),
  ]);

  const righe = (data as { created_at: string }[]) ?? [];
  const perMap = new Map<string, number>();
  let ultimi7 = 0;
  for (const r of righe) {
    if (new Date(r.created_at).getTime() >= soglia7) ultimi7++;
    const giorno = r.created_at.slice(0, 10); // YYYY-MM-DD
    perMap.set(giorno, (perMap.get(giorno) ?? 0) + 1);
  }

  const perGiorno: { giorno: string; n: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const g = new Date(ora - i * GIORNO_MS).toISOString().slice(0, 10);
    perGiorno.push({ giorno: g, n: perMap.get(g) ?? 0 });
  }

  return { totale: count ?? 0, ultimi7, ultimi30: righe.length, perGiorno };
}

export type ProdottoVisto = { id: string; nome: string; n: number };

/**
 * Prodotti più visti (apertura del passaporto/embed) dell'azienda loggata —
 * statistica "extra" del piano Gold per capire quali prodotti interessano di più.
 */
export async function caricaProdottiPiuVisti(owner: string, limite = 10): Promise<ProdottoVisto[]> {
  const { data } = await supabase
    .from("biofido_visite")
    .select("prodotto_id")
    .eq("owner", owner)
    .not("prodotto_id", "is", null);
  const righe = (data as { prodotto_id: string }[]) ?? [];
  if (righe.length === 0) return [];

  const conteggio = new Map<string, number>();
  for (const r of righe) conteggio.set(r.prodotto_id, (conteggio.get(r.prodotto_id) ?? 0) + 1);

  const ids = [...conteggio.keys()];
  const { data: prods } = await supabase.from("prodotti").select("id, nome").in("id", ids);
  const nomi = new Map(
    ((prods as { id: string; nome: string }[]) ?? []).map((p) => [p.id, p.nome]),
  );

  return [...conteggio.entries()]
    .map(([id, n]) => ({ id, nome: nomi.get(id) ?? "(prodotto rimosso)", n }))
    .sort((a, b) => b.n - a.n)
    .slice(0, limite);
}
