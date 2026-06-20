"use client";

import { useEffect, useState } from "react";
import {
  caricaStatistiche,
  caricaProdottiPiuVisti,
  type Statistiche,
  type ProdottoVisto,
} from "@/lib/statistiche";
import { PLAN_MAP, type Plan } from "@/lib/piani";

function Numero({ n, label }: { n: number; label: string }) {
  return (
    <div className="rounded-2xl bg-leaf/40 p-4 text-center">
      <div className="font-display text-3xl text-green-700">{n.toLocaleString("it-IT")}</div>
      <div className="text-xs font-semibold text-green-900/65">{label}</div>
    </div>
  );
}

/**
 * Statistiche di visita della scheda. Bloccate nel piano Free; base nel piano
 * Silver (numeri); avanzate nel piano Gold (numeri + andamento 30 giorni).
 */
export function StatisticheCard({ ownerId, plan }: { ownerId: string; plan: Plan }) {
  const livello = PLAN_MAP[plan].statsLevel; // "none" | "base" | "advanced"
  const [s, setS] = useState<Statistiche | null>(null);
  const [prodotti, setProdotti] = useState<ProdottoVisto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (livello === "none") {
      setLoading(false);
      return;
    }
    caricaStatistiche(ownerId).then((r) => {
      setS(r);
      setLoading(false);
    });
    // statistica extra Gold: prodotti più visti
    if (livello === "advanced") {
      caricaProdottiPiuVisti(ownerId).then(setProdotti);
    }
  }, [ownerId, livello]);

  if (livello === "none") {
    return (
      <section className="card mt-6 p-6">
        <h2 className="font-display text-2xl text-green-800">📊 Statistiche</h2>
        <p className="mt-1 text-sm text-green-900/70">
          Le statistiche di visualizzazione del tuo passaporto ecologico si sbloccano dal piano{" "}
          <strong>Silver</strong> (base) e <strong>Gold</strong> (avanzate, con
          l&apos;andamento giorno per giorno).
        </p>
      </section>
    );
  }

  const max = s ? Math.max(1, ...s.perGiorno.map((d) => d.n)) : 1;
  const maxProd = prodotti.length ? Math.max(1, ...prodotti.map((p) => p.n)) : 1;

  return (
    <section className="card mt-6 p-6">
      <h2 className="font-display text-2xl text-green-800">
        📊 Statistiche {livello === "advanced" ? "(avanzate)" : "(base)"}
      </h2>
      <p className="mt-1 text-sm text-green-900/70">
        Quante persone hanno visualizzato il tuo passaporto ecologico (il semaforo incorporato sul tuo sito).
      </p>

      {loading ? (
        <p className="mt-4 text-sm text-green-900/60">Carico le statistiche…</p>
      ) : s ? (
        <>
          <div className="mt-4 grid grid-cols-3 gap-3">
            <Numero n={s.totale} label="Visite totali" />
            <Numero n={s.ultimi7} label="Ultimi 7 giorni" />
            <Numero n={s.ultimi30} label="Ultimi 30 giorni" />
          </div>

          {livello === "advanced" && (
            <div className="mt-6">
              <div className="label mb-2">Andamento ultimi 30 giorni</div>
              <div className="flex h-28 items-end gap-[3px]">
                {s.perGiorno.map((d) => (
                  <div
                    key={d.giorno}
                    title={`${d.giorno}: ${d.n} visite`}
                    style={{ height: `${Math.max(3, (d.n / max) * 100)}%` }}
                    className="flex-1 rounded-t bg-green-600/80 transition hover:bg-green-700"
                  />
                ))}
              </div>
              <div className="mt-1 flex justify-between text-[10px] text-green-900/45">
                <span>30 giorni fa</span>
                <span>oggi</span>
              </div>
            </div>
          )}

          {/* Statistica extra Gold: prodotti più visti (grafico a barre) */}
          {livello === "advanced" && prodotti.length > 0 && (
            <div className="mt-6">
              <div className="label mb-2">🏆 Prodotti più visti — quali interessano di più</div>
              <ul className="space-y-2">
                {prodotti.map((p) => (
                  <li key={p.id} className="flex items-center gap-3">
                    <span className="w-32 shrink-0 truncate text-sm text-green-900/85 sm:w-44" title={p.nome}>
                      {p.nome}
                    </span>
                    <div className="h-4 flex-1 overflow-hidden rounded-full bg-leaf/50">
                      <div
                        className="h-4 rounded-full bg-green-600"
                        style={{ width: `${Math.max(6, (p.n / maxProd) * 100)}%` }}
                      />
                    </div>
                    <span className="w-8 shrink-0 text-right text-sm font-bold text-green-800">
                      {p.n}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-green-900/55">
                Conta le aperture del passaporto di ciascun prodotto (embed sul tuo sito).
              </p>
            </div>
          )}

          {s.totale === 0 && (
            <p className="mt-4 rounded-xl bg-leaf/40 p-3 text-sm text-green-900/65">
              Ancora nessuna visita registrata. Appena qualcuno apre la tua scheda
              dalla mappa, lo vedrai qui.
            </p>
          )}
        </>
      ) : null}
    </section>
  );
}
