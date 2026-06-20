"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  loadAziendaPubblica,
  type AziendaPubblica,
  type ProdottoPubblico,
  type ServizioPubblico,
} from "@/lib/azienda-pubblica";
import { computeFootprint } from "@/lib/footprint";
import { useGeoResolve } from "@/lib/useGeoResolve";
import { Semaforo } from "@/components/Semaforo";
import { AlberiCompensazione } from "@/components/AlberiCompensazione";
import { formatPrezzo } from "@/lib/prezzo";
import { PLAN_MAP, type Plan } from "@/lib/piani";
import { RichiestaServizioModal } from "@/components/RichiestaServizioModal";
import { ContattaAziendaModal } from "@/components/ContattaAziendaModal";

type Dati = { azienda: AziendaPubblica; prodotti: ProdottoPubblico[]; servizi: ServizioPubblico[] };

/** prezzo numerico → "€ 9,50" (it-IT). */
const euroNum = (n: number) =>
  "€ " + n.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const TIPO_SERVIZIO: Record<string, string> = {
  visita: "Visita guidata",
  laboratorio: "Laboratorio didattico",
  esperienza: "Esperienza",
};

function Contenuto() {
  const params = useSearchParams();
  const id = params.get("id");
  const [dati, setDati] = useState<Dati | null>(null);
  const [loading, setLoading] = useState(true);
  const [prenota, setPrenota] = useState<ProdottoPubblico | null>(null);
  const [prenotaServizio, setPrenotaServizio] = useState<ServizioPubblico | null>(null);
  const [contatta, setContatta] = useState(false);

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
  // Widget differenziato per piano (look diverso da BioFido, stesse funzioni):
  // la "scheda ricca" (copertina, descrizione, sito) è riservata a Silver/Gold.
  const plan = (azienda.plan as Plan) ?? "free";
  const ricco = (PLAN_MAP[plan] ?? PLAN_MAP.free).richProfile;

  return (
    <>
      <Link href="/prodotti" className="text-sm font-bold text-green-700 hover:text-lime-500">
        ← Tutte le schede prodotto
      </Link>

      {ricco && azienda.immagine && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={azienda.immagine}
          alt={azienda.nome}
          className="mt-3 h-48 w-full rounded-2xl object-cover md:h-64"
        />
      )}

      <div className="mt-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wide text-lime-500">Azienda</span>
          {plan === "gold" && (
            <span className="rounded-full bg-badge-yellow px-2 py-0.5 text-[10px] font-bold text-[#7a1f00]">
              ★ GOLD · in evidenza
            </span>
          )}
          {plan === "silver" && (
            <span className="rounded-full bg-[#c9d3da] px-2 py-0.5 text-[10px] font-bold text-[#33414a]">
              SILVER
            </span>
          )}
        </div>
        <h1 className="title-pangea text-4xl text-green-700 md:text-5xl">{azienda.nome}</h1>
        <p className="mt-1 text-green-900/70">
          {azienda.citta_sede ?? ""}
          {ricco && azienda.sito_web && (
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
        {ricco && azienda.descrizione && (
          <p className="mt-3 max-w-2xl whitespace-pre-line text-green-900/80">
            {azienda.descrizione}
          </p>
        )}

        {azienda.owner && (
          <button
            type="button"
            onClick={() => setContatta(true)}
            className="mt-4 inline-flex items-center gap-2 rounded-full border border-green-600 px-4 py-1.5 text-sm font-bold text-green-700 hover:bg-leaf"
          >
            ✉️ Contatta l&apos;azienda
          </button>
        )}
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
                <div className="flex items-center gap-2">
                  <h3 className="font-display text-xl leading-tight text-green-800">{p.nome}</h3>
                  {p.prenotabile && (
                    <span className="shrink-0 rounded-full bg-badge-yellow px-2 text-[10px] font-bold text-[#7a1f00]">
                      PRENOTABILE
                    </span>
                  )}
                </div>
                {p.prezzo && (
                  <div className="mt-1 text-lg font-bold text-green-800">{formatPrezzo(p.prezzo)}</div>
                )}
                <p className="mt-1 text-xs text-green-900/60">Stabilimento: {p.stabilimento_citta}</p>

                {p.prenotabile && azienda.owner && (
                  <button
                    type="button"
                    onClick={() => setPrenota(p)}
                    className="btn-lime mt-3 w-full justify-center text-sm"
                  >
                    ✨ Prenota / richiedi
                  </button>
                )}

                <div className="mt-3">
                  <Semaforo level={fp.level} score={fp.score} />
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-[#e8f1dc] pt-3">
                  <span className="text-sm font-semibold text-green-900/70">
                    Impronta di trasporto
                  </span>
                  <div className="text-right">
                    <div className="font-display text-2xl text-green-800">
                      {fp.totalCo2Kg.toLocaleString("it-IT")} kg
                    </div>
                    <div className="text-[11px] text-green-900/60">
                      CO₂ · {fp.totalKm.toLocaleString("it-IT")} km
                    </div>
                  </div>
                </div>

                <AlberiCompensazione co2Kg={fp.totalCo2Kg} />

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

      {/* Servizi extra prenotabili (visite, laboratori, esperienze) — come su BioFido */}
      {dati.servizi.length > 0 && (
        <>
          <h2 className="mt-10 font-display text-2xl text-green-800">Servizi extra prenotabili</h2>
          <p className="mt-1 text-sm text-green-900/70">
            Esperienze e attività da prenotare direttamente con l&apos;azienda.
          </p>
          <ul className="mt-4 grid gap-4 sm:grid-cols-2">
            {dati.servizi.map((s) => (
              <li
                key={s.id}
                className="rounded-2xl border-2 border-badge-yellow bg-[#fffbe9] p-4"
              >
                <div className="flex items-start gap-3">
                  {s.immagine && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.immagine} alt={s.nome} className="h-16 w-16 shrink-0 rounded-lg object-cover" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] font-bold uppercase tracking-wide text-lime-600">
                      {TIPO_SERVIZIO[s.tipo] ?? "Servizio"}
                    </div>
                    <div className="font-semibold text-green-800">{s.nome}</div>
                    {s.descrizione && (
                      <p className="mt-0.5 text-xs text-green-900/65">{s.descrizione}</p>
                    )}
                  </div>
                  {s.prezzo != null && (
                    <div className="shrink-0 text-sm font-bold text-green-800">{euroNum(s.prezzo)}</div>
                  )}
                </div>
                {azienda.owner && (
                  <button
                    type="button"
                    onClick={() => setPrenotaServizio(s)}
                    className="btn-lime mt-3 w-full justify-center text-sm"
                  >
                    ✨ Prenota / richiedi
                  </button>
                )}
              </li>
            ))}
          </ul>
        </>
      )}

      {prenota && azienda.owner && (
        <RichiestaServizioModal
          ownerId={azienda.owner}
          ownerPlan={(azienda.plan as Plan) ?? "free"}
          servizioNome={prenota.nome}
          prezzo={prenota.prezzo}
          aziendaNome={azienda.nome}
          onClose={() => setPrenota(null)}
        />
      )}

      {prenotaServizio && azienda.owner && (
        <RichiestaServizioModal
          ownerId={azienda.owner}
          ownerPlan={(azienda.plan as Plan) ?? "free"}
          servizioNome={prenotaServizio.nome}
          prezzo={prenotaServizio.prezzo != null ? euroNum(prenotaServizio.prezzo) : null}
          descrizione={prenotaServizio.descrizione}
          aziendaNome={azienda.nome}
          onClose={() => setPrenotaServizio(null)}
        />
      )}

      {contatta && azienda.owner && (
        <ContattaAziendaModal
          ownerId={azienda.owner}
          aziendaNome={azienda.nome}
          onClose={() => setContatta(false)}
        />
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
