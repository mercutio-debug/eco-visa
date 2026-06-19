"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  loadAziendaPubblica,
  type AziendaPubblica,
  type ProdottoPubblico,
} from "@/lib/azienda-pubblica";
import { computeFootprint } from "@/lib/footprint";
import { useGeoResolve } from "@/lib/useGeoResolve";
import { Semaforo } from "@/components/Semaforo";

type Dati = { azienda: AziendaPubblica; prodotti: ProdottoPubblico[] };

function Contenuto() {
  const params = useSearchParams();
  const id = params.get("id");
  const [dati, setDati] = useState<Dati | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    loadAziendaPubblica(id).then((r) => {
      setDati(r);
      setLoading(false);
    });
  }, [id]);

  // Risolve su OpenStreetMap stabilimenti + origini, poi ricalcola i semafori
  const nomiLuoghi = useMemo(() => {
    if (!dati) return [];
    const s = new Set<string>();
    for (const p of dati.prodotti) {
      if (p.stabilimento_citta) s.add(p.stabilimento_citta);
      p.ingredienti.forEach((i) => i.origin && s.add(i.origin));
    }
    return [...s];
  }, [dati]);
  const { version } = useGeoResolve(nomiLuoghi);

  const prodottiConFp = useMemo(() => {
    if (!dati) return [];
    return dati.prodotti.map((p) => ({
      p,
      fp: computeFootprint(p.stabilimento_citta, p.ingredienti),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dati, version]);

  if (loading) {
    return <p className="mt-10 text-green-900/70">Carico la scheda dell&apos;azienda…</p>;
  }
  if (!dati) {
    return (
      <div className="mt-10">
        <p className="text-green-900/70">Azienda non trovata.</p>
        <Link href="/prodotti" className="mt-3 inline-block font-bold text-green-700 hover:text-lime-500">
          ← Tutte le schede prodotto
        </Link>
      </div>
    );
  }

  const { azienda } = dati;

  return (
    <>
      <Link href="/prodotti" className="text-sm font-bold text-green-700 hover:text-lime-500">
        ← Tutte le schede prodotto
      </Link>

      <div className="mt-3">
        <div className="text-xs font-bold uppercase tracking-wide text-lime-500">Azienda</div>
        <h1 className="title-pangea text-4xl text-green-700 md:text-5xl">{azienda.nome}</h1>
        <p className="mt-1 text-green-900/70">
          {azienda.citta_sede ?? ""}
          {azienda.sito_web && (
            <>
              {azienda.citta_sede ? " · " : ""}
              <a
                href={azienda.sito_web.startsWith("http") ? azienda.sito_web : `https://${azienda.sito_web}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-green-700 hover:text-lime-500"
              >
                {azienda.sito_web}
              </a>
            </>
          )}
        </p>
      </div>

      <h2 className="mt-8 font-display text-2xl text-green-800">
        I prodotti ({prodottiConFp.length})
      </h2>
      {prodottiConFp.length === 0 ? (
        <p className="mt-3 text-green-900/70">
          Questa azienda non ha ancora pubblicato prodotti.
        </p>
      ) : (
        <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {prodottiConFp.map(({ p, fp }) => (
            <div key={p.id} className="card overflow-hidden p-0">
              {p.immagine && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.immagine} alt={p.nome} className="h-40 w-full object-cover" />
              )}
              <div className="p-5">
                {p.categoria && (
                  <div className="text-xs font-bold uppercase tracking-wide text-lime-500">
                    {p.categoria}
                  </div>
                )}
                <h3 className="font-display text-xl leading-tight text-green-800">{p.nome}</h3>
                <p className="mt-1 text-xs text-green-900/60">Stabilimento: {p.stabilimento_citta}</p>

                <div className="mt-3 flex items-center justify-between">
                  <Semaforo level={fp.level} size="sm" />
                  <div className="text-right">
                    <div className="font-display text-2xl text-green-800">
                      {fp.totalCo2Kg.toLocaleString("it-IT")} kg
                    </div>
                    <div className="text-[11px] text-green-900/60">CO₂ trasporto</div>
                  </div>
                </div>

                {p.ingredienti.length > 0 && (
                  <ul className="mt-3 border-t border-[#e8f1dc] pt-2 text-xs text-green-900/70">
                    {fp.ingredients.map((ing, i) => (
                      <li key={i} className="flex justify-between gap-2">
                        <span className="truncate">{ing.name}</span>
                        <span className="shrink-0 text-green-900/50">
                          {ing.origin}
                          {ing.resolved ? ` · ${ing.totalKm.toLocaleString("it-IT")} km` : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

export default function AziendaPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <Suspense fallback={<p className="text-green-900/70">Carico…</p>}>
        <Contenuto />
      </Suspense>
    </div>
  );
}
