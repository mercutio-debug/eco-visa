"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  loadAziendaPubblica,
  tutteLeAziendePubbliche,
  type AziendaPubblica,
  type ProdottoPubblico,
  type ServizioPubblico,
} from "@/lib/azienda-pubblica";
import { computeFootprint } from "@/lib/footprint";
import { useGeoResolve } from "@/lib/useGeoResolve";
import { supabase } from "@/lib/supabase";
import { addToCart } from "@/lib/carrello";
import { Semaforo } from "@/components/Semaforo";
import { AlberiCompensazione } from "@/components/AlberiCompensazione";
import { formatPrezzo } from "@/lib/prezzo";
import { PLAN_MAP, type Plan } from "@/lib/piani";
import { RichiestaServizioModal } from "@/components/RichiestaServizioModal";
import { ContattaAziendaModal } from "@/components/ContattaAziendaModal";
import { OrdineProdottoModal } from "@/components/OrdineProdottoModal";
import { SegnalaModal } from "@/components/SegnalaModal";
import { ProdottoDettaglioModal } from "@/components/ProdottoDettaglioModal";

const MappaPosizione = dynamic(() => import("@/components/MappaPosizione"), { ssr: false });

export type DatiAzienda = {
  azienda: AziendaPubblica;
  prodotti: ProdottoPubblico[];
  servizi: ServizioPubblico[];
  vendita: ServizioPubblico[];
};

/** prezzo numerico → "€ 9,50" (it-IT). */
const euroNum = (n: number) =>
  "€ " + n.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const TIPO_SERVIZIO: Record<string, string> = {
  visita: "Visita guidata",
  laboratorio: "Laboratorio didattico",
  esperienza: "Esperienza",
};

/**
 * Scheda pubblica di un'azienda. Usata sia dalla pagina statica condivisibile
 * /azienda/[slug] (con `initial` = dati al build → contenuto nell'HTML,
 * indicizzabile) sia dal fallback /azienda?id= (initial assente → caricamento
 * client). In entrambi i casi, a runtime ricarica i dati live per accuratezza.
 */
export function AziendaScheda({
  id,
  initial,
}: {
  id: string | null;
  initial?: DatiAzienda | null;
}) {
  const [dati, setDati] = useState<DatiAzienda | null>(initial ?? null);
  const [loading, setLoading] = useState(!initial);
  const [prenota, setPrenota] = useState<ProdottoPubblico | null>(null);
  const [prenotaServizio, setPrenotaServizio] = useState<ServizioPubblico | null>(null);
  const [ordina, setOrdina] = useState<ServizioPubblico | null>(null);
  const [segnala, setSegnala] = useState<ServizioPubblico | null>(null);
  const [dettaglio, setDettaglio] = useState<ProdottoPubblico | null>(null);
  const [contatta, setContatta] = useState(false);
  const [cartMsg, setCartMsg] = useState<string | null>(null);

  // 🛒 Aggiungi al carrello con gate login: ospiti → messaggio + pagina accedi;
  // loggati → prodotto nel carrello (il checkout completo arriva con la Fase B).
  const aggiungiCarrello = async (p: ProdottoPubblico) => {
    if (!dati) return;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      if (typeof window !== "undefined") {
        try {
          sessionStorage.setItem(
            "postLoginRedirect",
            window.location.pathname + window.location.search,
          );
        } catch {
          /* ignore */
        }
        // chi ordina è quasi sempre un CLIENTE → mando all'iscrizione cliente
        // (da lì può comunque accedere o passare all'area aziende).
        alert("Per ordinare questo prodotto accedi o crea un account cliente (è gratis).");
        window.location.href = "/registrati?tipo=cliente";
      }
      return;
    }
    addToCart({
      prodottoId: p.id,
      nome: p.nome,
      prezzo: p.prezzo ?? null,
      aziendaId: dati.azienda.id,
      aziendaNome: dati.azienda.nome,
      owner: dati.azienda.owner ?? null,
      immagine: p.immagine,
      giacenza: p.giacenza ?? null,
    });
    setCartMsg(`“${p.nome}” aggiunto al carrello`);
    setTimeout(() => setCartMsg(null), 2500);
  };

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    loadAziendaPubblica(id).then((r) => {
      if (r) setDati(r);
      setLoading(false);
    });
  }, [id]);

  // Sulla pagina dinamica /azienda/?id=, appena carico l'azienda riscrivo l'URL
  // nello slug pulito /azienda/[slug]/ (condivisibile + branded), SOLO se quella
  // pagina statica esiste già (azienda presente nell'ultimo build → niente 404).
  useEffect(() => {
    if (initial || !id || !dati) return;
    tutteLeAziendePubbliche().then((list) => {
      const found = list.find((a) => a.id === id);
      if (found && typeof window !== "undefined") {
        const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
        window.history.replaceState(null, "", `${base}/azienda/${found.slug}/`);
      }
    });
  }, [id, dati, initial]);

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

      {azienda.lat != null && azienda.lon != null && (
        <div className="mt-8">
          <h2 className="font-display text-2xl text-green-800">Dove si trova</h2>
          {azienda.citta_sede && (
            <p className="mt-1 text-sm text-green-900/70">{azienda.citta_sede}</p>
          )}
          <div className="mt-3">
            <MappaPosizione
              lat={Number(azienda.lat)}
              lon={Number(azienda.lon)}
              label={azienda.nome}
            />
          </div>
        </div>
      )}

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
                <button
                  type="button"
                  onClick={() => setDettaglio(p)}
                  className="block h-40 w-full overflow-hidden"
                  title="Apri la scheda del prodotto"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.immagine}
                    alt={p.nome}
                    className="h-40 w-full cursor-pointer object-cover transition-transform duration-300 hover:scale-150"
                  />
                </button>
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
                {(p.confezione || p.contenuto != null) && (
                  <p className="mt-1 text-xs font-semibold text-green-900/70">
                    {[
                      p.confezione,
                      p.contenuto != null ? `${p.contenuto} ${p.unita ?? ""}`.trim() : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                )}
                {p.durata && (
                  <p className="mt-1 text-xs font-semibold text-green-900/70">⏱ Durata: {p.durata}</p>
                )}

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

                {(p.descrizione || p.foto2) && (
                  <button
                    type="button"
                    onClick={() => setDettaglio(p)}
                    className="mt-3 w-full rounded-lg border border-green-600/40 py-2 text-sm font-bold text-green-700 hover:bg-leaf"
                  >
                    🔍 Dettagli e foto
                  </button>
                )}
                {p.in_shop &&
                  (p.giacenza === 0 ? (
                    <div className="mt-3 rounded-lg bg-[#f3dada] py-2 text-center text-sm font-bold text-traffic-red">
                      Esaurito
                    </div>
                  ) : (
                    <>
                      {typeof p.giacenza === "number" && (
                        <div className="mt-2 text-xs font-semibold text-green-900/60">
                          Disponibili: {p.giacenza}
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => aggiungiCarrello(p)}
                        className="btn-lime mt-1 w-full justify-center text-sm"
                      >
                        🛒 Aggiungi al carrello
                      </button>
                    </>
                  ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {dati.vendita.length > 0 && (
        <>
          <h2 className="mt-10 font-display text-2xl text-green-800">Prodotti in vendita</h2>
          <p className="mt-1 text-sm text-green-900/70">
            Acquista online direttamente dall&apos;azienda.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {dati.vendita.map((v) => (
              <div key={v.id} className="card overflow-hidden p-0">
                {v.immagine && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={v.immagine} alt={v.nome} className="h-40 w-full object-cover" />
                )}
                <div className="p-5">
                  <h3 className="font-display text-xl text-green-800">{v.nome}</h3>
                  {v.descrizione && (
                    <p className="mt-1 text-sm text-green-900/65">{v.descrizione}</p>
                  )}
                  {v.prezzo != null && (
                    <div className="mt-2 text-lg font-bold text-green-800">{euroNum(v.prezzo)}</div>
                  )}
                  {azienda.owner && (
                    <button
                      type="button"
                      onClick={() => setOrdina(v)}
                      className="btn-lime mt-3 w-full justify-center text-sm"
                    >
                      🛒 Ordina
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setSegnala(v)}
                    className="mt-2 block text-xs font-semibold text-green-900/45 hover:text-traffic-red"
                  >
                    ⚠️ Segnala annuncio
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
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
          prodottoId={prenota.id}
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
          voceId={prenotaServizio.id}
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

      {ordina && azienda.owner && (
        <OrdineProdottoModal
          prodottoId={ordina.id}
          owner={azienda.owner}
          prodottoNome={ordina.nome}
          prezzo={ordina.prezzo != null ? euroNum(ordina.prezzo) : null}
          aziendaNome={azienda.nome}
          portale="ECO-VISA"
          onClose={() => setOrdina(null)}
        />
      )}

      {segnala && (
        <SegnalaModal
          catalogoId={segnala.id}
          prodottoNome={segnala.nome}
          portale="ECO-VISA"
          onClose={() => setSegnala(null)}
        />
      )}

      {dettaglio && (
        <ProdottoDettaglioModal
          p={dettaglio}
          ownerPresente={!!azienda.owner}
          onClose={() => setDettaglio(null)}
          onPrenota={() => setPrenota(dettaglio)}
          onCarrello={() => aggiungiCarrello(dettaglio)}
        />
      )}

      {cartMsg && (
        <div className="fixed bottom-5 left-1/2 z-[300] -translate-x-1/2 rounded-full bg-green-800 px-5 py-2 text-sm font-bold text-white shadow-lg">
          🛒 {cartMsg}
        </div>
      )}
    </>
  );
}
