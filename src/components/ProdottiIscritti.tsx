"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  loadProdottiIscritti,
  type ProdottoConAzienda,
} from "@/lib/azienda-pubblica";
import { computeFootprint } from "@/lib/footprint";
import { useGeoResolve } from "@/lib/useGeoResolve";
import { Semaforo } from "@/components/Semaforo";

/**
 * Elenco dei prodotti delle AZIENDE ISCRITTE (dati reali da Supabase), mostrato
 * IN ALTO nella pagina "Schede prodotto"; gli esempi statici restano sotto.
 * Ogni scheda apre la pagina pubblica dell'azienda.
 */
export function ProdottiIscritti() {
  const [prodotti, setProdotti] = useState<ProdottoConAzienda[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProdottiIscritti().then((r) => {
      setProdotti(r);
      setLoading(false);
    });
  }, []);

  const nomiLuoghi = useMemo(() => {
    const s = new Set<string>();
    for (const p of prodotti) {
      if (p.stabilimento_citta) s.add(p.stabilimento_citta);
      p.ingredienti.forEach((i) => i.origin && s.add(i.origin));
    }
    return [...s];
  }, [prodotti]);
  const { version } = useGeoResolve(nomiLuoghi);

  const items = useMemo(
    () => prodotti.map((p) => ({ p, fp: computeFootprint(p.stabilimento_citta, p.ingredienti) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [prodotti, version],
  );

  if (loading) {
    return <p className="mt-4 text-sm text-green-900/60">Carico i prodotti delle aziende iscritte…</p>;
  }
  if (prodotti.length === 0) return null;

  return (
    <section className="mt-8">
      <h2 className="font-display text-2xl text-green-800">Dalle aziende iscritte</h2>
      <p className="mt-1 text-sm text-green-900/65">
        Prodotti reali pubblicati dalle aziende su ECO-VISA. Tocca una scheda per
        aprire la pagina dell&apos;azienda.
      </p>
      <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {items.map(({ p, fp }) => (
          <Link
            key={p.id}
            href={`/azienda/?id=${p.aziendaId}`}
            className="card overflow-hidden p-0 transition hover:-translate-y-1"
          >
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
              <p className="mt-1 text-sm text-green-900/70">{p.aziendaNome}</p>
              {p.prezzo && (
                <div className="mt-1 text-base font-bold text-green-800">{p.prezzo}</div>
              )}
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
          </Link>
        ))}
      </div>
    </section>
  );
}
