"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { computeFootprint } from "@/lib/footprint";
import { prefetchGeocode } from "@/lib/geo";
import { Semaforo } from "@/components/Semaforo";

/**
 * Vetrina pubblica dei prodotti delle AZIENDE ISCRITTE (dal database), non i
 * prodotti demo. Ogni prodotto è subito pubblico (moderazione successiva lato
 * admin). Mostra semaforo + link alla scheda pubblica (passaporto /embed).
 */
const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

type Prod = {
  id: string;
  nome: string;
  categoria: string | null;
  stabilimento_citta: string;
  immagine: string | null;
  azienda_id: string;
};
type Ing = { prodotto_id: string; nome: string; origine: string };
type Voce = { p: Prod; ingredienti: { name: string; origin: string }[]; azienda: string };

export function VetrinaAziende() {
  const [items, setItems] = useState<Voce[]>([]);
  const [, setV] = useState(0); // forza il ricalcolo CO₂ dopo la geolocalizzazione OSM
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: prods } = await supabase
        .from("prodotti")
        .select("id, nome, categoria, stabilimento_citta, immagine, azienda_id")
        .order("created_at", { ascending: false });
      const lista = (prods as Prod[]) ?? [];
      if (lista.length === 0) {
        setLoading(false);
        return;
      }

      const ids = lista.map((p) => p.id);
      const { data: ings } = await supabase
        .from("ingredienti")
        .select("prodotto_id, nome, origine")
        .in("prodotto_id", ids);
      const aziendaIds = [...new Set(lista.map((p) => p.azienda_id))];
      const { data: az } = await supabase
        .from("aziende")
        .select("id, nome")
        .in("id", aziendaIds);

      const nomeAz = new Map((az ?? []).map((a: { id: string; nome: string }) => [a.id, a.nome]));
      const byProd = new Map<string, { name: string; origin: string }[]>();
      ((ings as Ing[]) ?? []).forEach((i) => {
        const a = byProd.get(i.prodotto_id) ?? [];
        a.push({ name: i.nome, origin: i.origine });
        byProd.set(i.prodotto_id, a);
      });

      const built: Voce[] = lista.map((p) => ({
        p,
        ingredienti: byProd.get(p.id) ?? [],
        azienda: nomeAz.get(p.azienda_id) ?? "",
      }));
      setItems(built);
      setLoading(false);

      // risolve le località su OpenStreetMap e poi ricalcola i semafori
      const names = new Set<string>();
      built.forEach((b) => {
        if (b.p.stabilimento_citta) names.add(b.p.stabilimento_citta);
        b.ingredienti.forEach((i) => i.origin && names.add(i.origin));
      });
      for (const n of names) await prefetchGeocode(n);
      setV((v) => v + 1);
    })();
  }, []);

  if (loading) {
    return <p className="mt-10 text-green-900/60">Carico i prodotti delle aziende…</p>;
  }
  if (items.length === 0) return null;

  return (
    <section className="mt-14">
      <h2 className="font-display text-3xl text-green-800">
        Prodotti delle aziende iscritte
      </h2>
      <p className="mt-1 text-green-900/70">
        Schede reali pubblicate dalle aziende su ECO-VISA, con il loro semaforo.
      </p>

      <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {items.map(({ p, ingredienti, azienda }) => {
          const fp = computeFootprint(p.stabilimento_citta, ingredienti);
          return (
            <a
              key={p.id}
              href={`${BASE}/embed/?id=${p.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="card overflow-hidden p-0 transition hover:-translate-y-1"
            >
              {p.immagine && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.immagine} alt="" className="h-36 w-full object-cover" />
              )}
              <div className="p-5">
                {p.categoria && (
                  <div className="text-xs font-bold uppercase tracking-wide text-lime-500">
                    {p.categoria}
                  </div>
                )}
                <h3 className="font-display text-2xl leading-tight text-green-800">
                  {p.nome}
                </h3>
                <p className="mt-1 text-sm text-green-900/70">
                  {azienda || "Azienda"} · {p.stabilimento_citta}
                </p>
                <div className="mt-4 flex items-center justify-between">
                  <Semaforo level={fp.level} size="sm" />
                  <div className="text-right">
                    <div className="font-display text-2xl text-green-800">
                      {fp.totalCo2Kg.toLocaleString("it-IT")} kg
                    </div>
                    <div className="text-[11px] text-green-900/60">CO₂ trasporto</div>
                  </div>
                </div>
              </div>
            </a>
          );
        })}
      </div>
    </section>
  );
}
