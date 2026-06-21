"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { geocode, prefetchGeocode } from "@/lib/geo";
import type { AziendaMarker } from "./MappaAziendeMappa";

const Mappa = dynamic(() => import("./MappaAziendeMappa"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[420px] items-center justify-center rounded-2xl bg-leaf text-green-700">
      Carico la mappa…
    </div>
  ),
});

/**
 * Aziende DI ESEMPIO mostrate dopo quelle registrate: così la mappa non è mai
 * vuota e si capisce subito come appare (verde = ha prodotti col semaforo). Le
 * città scelte sono nel dizionario geografico, quindi si posizionano subito.
 */
const DEMO_AZIENDE: { nome: string; citta: string; conSemaforo: boolean }[] = [
  { nome: "Cascina Verde — Ortaggi Bio", citta: "Cuneo", conSemaforo: true },
  { nome: "Frantoio del Borgo", citta: "Bari", conSemaforo: true },
  { nome: "Caseificio Valle Pulita", citta: "Parma", conSemaforo: true },
  { nome: "Apicoltura Monti Liguri", citta: "Genova", conSemaforo: true },
  { nome: "Cantina Colline Senesi", citta: "Siena", conSemaforo: false },
];

/**
 * Mappa pubblica delle AZIENDE ISCRITTE su ECO-VISA (anche solo ECO-VISA).
 * Legge le aziende dal DB, geolocalizza la sede e mostra i segnaposto: verdi se
 * l'azienda ha già caricato almeno un prodotto col semaforo, grigi altrimenti.
 * In coda aggiunge alcune aziende DI ESEMPIO (etichettate "(esempio)").
 */
export function MappaAziende() {
  const [markers, setMarkers] = useState<AziendaMarker[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      // Vista pubblica (senza P.IVA / cod. fiscale): select("*") qui è sicuro.
      const { data: az } = await supabase.from("aziende_pubbliche").select("*");
      const lista = ((az as { id: string; nome: string; citta_sede: string | null; plan?: string | null }[]) ?? []).filter(
        (a) => a.citta_sede,
      );

      const ms: AziendaMarker[] = [];

      // 1) aziende REGISTRATE (prima)
      if (lista.length > 0) {
        const { data: pr } = await supabase.from("prodotti").select("azienda_id");
        const conProdotti = new Set(
          ((pr as { azienda_id: string }[]) ?? []).map((p) => p.azienda_id),
        );
        // geolocalizza le sedi su OpenStreetMap
        for (const a of lista) await prefetchGeocode(a.citta_sede as string);
        for (const a of lista) {
          const g = geocode(a.citta_sede as string);
          if (!g) continue;
          ms.push({
            id: a.id,
            nome: a.nome,
            citta: a.citta_sede as string,
            lat: g.lat,
            lon: g.lon,
            conSemaforo: conProdotti.has(a.id),
            plan: a.plan ?? "free",
          });
        }
      }

      // 2) esempi dimostrativi (DOPO le registrate) — piani vari per mostrare i 3 livelli
      const DEMO_PLAN = ["gold", "silver", "free", "silver", "free"];
      DEMO_AZIENDE.forEach((d, i) => {
        const g = geocode(d.citta);
        if (!g) return;
        ms.push({
          id: `esempio-${i}`,
          nome: `${d.nome} (esempio)`,
          citta: d.citta,
          lat: g.lat,
          lon: g.lon,
          conSemaforo: d.conSemaforo,
          plan: DEMO_PLAN[i] ?? "free",
        });
      });

      setMarkers(ms);
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex h-[420px] items-center justify-center rounded-2xl bg-leaf text-green-700">
        Carico le aziende…
      </div>
    );
  }
  if (markers.length === 0) {
    return (
      <p className="rounded-2xl bg-leaf/50 p-6 text-center text-green-900/70">
        Ancora nessuna azienda iscritta sulla mappa. Iscriviti e caricala tu per primo!
      </p>
    );
  }

  const conSem = markers.filter((m) => m.conSemaforo).length;

  return (
    <div>
      <div className="card overflow-hidden p-2">
        <Mappa markers={markers} />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-green-900/75">
        <span className="inline-flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-full bg-[#5baf38]" /> Con prodotti
          col semaforo ({conSem})
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-full bg-[#9aa0a6]" /> Iscritte, ancora
          senza prodotti ({markers.length - conSem})
        </span>
      </div>
      <p className="mt-2 text-xs text-green-900/55">
        I segnaposto con la dicitura «(esempio)» sono dimostrativi: mostrano come
        appariranno le aziende reali sulla mappa.
      </p>
    </div>
  );
}
