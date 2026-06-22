"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { computeFootprint } from "@/lib/footprint";
import { prefetchGeocode } from "@/lib/geo";
import { Semaforo } from "@/components/Semaforo";
import { registraVisita } from "@/lib/statistiche";
import { PLAN_MAP, type Plan } from "@/lib/piani";

type Prod = {
  id: string;
  azienda_id: string;
  nome: string;
  categoria: string | null;
  stabilimento_citta: string;
};
type Ingr = { nome: string; origine: string };

export default function EmbedPage() {
  const [status, setStatus] = useState<"loading" | "ok" | "notfound" | "noplan">("loading");
  const [prod, setProd] = useState<Prod | null>(null);
  const [ingr, setIngr] = useState<Ingr[]>([]);
  const [azienda, setAzienda] = useState<string>("");
  const [, setVer] = useState(0);

  useEffect(() => {
    // sfondo trasparente: la striscia si fonde col sito che la ospita
    document.body.style.background = "transparent";

    const id = new URLSearchParams(window.location.search).get("id");
    if (!id) {
      setStatus("notfound");
      return;
    }
    (async () => {
      const { data: p } = await supabase
        .from("prodotti")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (!p) {
        setStatus("notfound");
        return;
      }
      const { data: ing } = await supabase
        .from("ingredienti")
        .select("nome, origine")
        .eq("prodotto_id", id);
      const { data: az } = await supabase
        .from("aziende_pubbliche")
        .select("nome, owner, plan")
        .eq("id", (p as Prod).azienda_id)
        .maybeSingle();

      // Il badge da incorporare è una funzione Silver/Gold: con un piano che
      // non lo prevede (es. dopo un downgrade) il widget non si mostra.
      const plan = ((az as { plan?: string | null })?.plan ?? "free") as Plan;
      if (!(PLAN_MAP[plan] ?? PLAN_MAP.free).badgeEmbed) {
        setStatus("noplan");
        return;
      }

      setProd(p as Prod);
      setIngr((ing as Ingr[]) ?? []);
      setAzienda((az as { nome?: string })?.nome ?? "");
      setStatus("ok");

      // conta la visualizzazione del passaporto (per prodotto) per le statistiche
      const owner = (az as { owner?: string })?.owner;
      if (owner) registraVisita(owner, { prodottoId: (p as Prod).id });

      // risolvi le località via OpenStreetMap, poi ricalcola
      const names = new Set<string>([(p as Prod).stabilimento_citta]);
      (ing as Ingr[] | null)?.forEach((i) => i.origine && names.add(i.origine));
      for (const n of names) await prefetchGeocode(n);
      setVer((v) => v + 1);
    })();
  }, []);

  if (status === "loading") {
    return (
      <div className="p-4 font-sans text-sm text-green-900/60">
        Carico il passaporto ecologico…
      </div>
    );
  }
  if (status === "noplan") {
    return (
      <div className="p-4 font-sans text-sm text-green-900/60">
        Badge non disponibile con il piano attuale dell&apos;azienda.
      </div>
    );
  }
  if (status === "notfound" || !prod) {
    return (
      <div className="p-4 font-sans text-sm text-traffic-red">
        Passaporto ecologico non trovato.
      </div>
    );
  }

  const fp = computeFootprint(
    prod.stabilimento_citta,
    ingr.map((i) => ({ name: i.nome, origin: i.origine }))
  );

  // Cliccando la striscia si apre la scheda completa dell'azienda su ECO-VISA,
  // in una NUOVA scheda (l'embed vive su siti di terzi: non dirottiamo la pagina).
  const schedaUrl = `https://ecovisa.it/azienda/?id=${prod.azienda_id}`;

  return (
    <div className="mx-auto max-w-md p-3">
      <a
        href={schedaUrl}
        target="_blank"
        rel="noopener noreferrer"
        title="Apri la scheda completa su ECO-VISA"
        className="block overflow-hidden rounded-2xl border border-[#e3eed7] bg-white shadow-md transition hover:shadow-lg"
      >
        <div className="flex items-center justify-between bg-green-800 px-4 py-2">
          <span className="text-xs font-bold uppercase tracking-wide text-lime-300">
            Passaporto ecologico
          </span>
          <span className="font-display text-sm text-white">ECO-VISA</span>
        </div>

        <div className="p-4">
          <div className="text-[11px] font-bold uppercase tracking-wide text-lime-600">
            {prod.categoria || "Prodotto"}
          </div>
          <h1 className="font-display text-2xl leading-tight text-green-800">
            {prod.nome}
          </h1>
          {azienda && (
            <p className="text-xs text-green-900/60">
              {azienda} · stabilimento {prod.stabilimento_citta}
            </p>
          )}

          <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-leaf/50 p-3">
            <Semaforo level={fp.level} score={fp.score} />
            <div className="text-right">
              <div className="font-display text-3xl text-green-800">
                {fp.totalCo2Kg.toLocaleString("it-IT")} kg
              </div>
              <div className="text-[11px] text-green-900/60">
                CO₂ trasporto · {fp.totalKm.toLocaleString("it-IT")} km
              </div>
            </div>
          </div>

          {ingr.length > 0 && (
            <ul className="mt-3 space-y-1">
              {ingr.map((i, idx) => (
                <li
                  key={idx}
                  className="flex items-center justify-between text-xs text-green-900/80"
                >
                  <span className="font-semibold">{i.nome}</span>
                  <span className="text-green-900/55">{i.origine}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t border-[#eef4e6] px-4 py-2 text-center text-[11px] font-semibold text-green-700">
          🌱 Apri la scheda completa su ECO-VISA → ecovisa.it
        </div>
      </a>
    </div>
  );
}
