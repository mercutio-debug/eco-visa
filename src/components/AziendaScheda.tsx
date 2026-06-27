"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { registraVisita } from "@/lib/statistiche";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  loadAziendaPubblica,
  tutteLeAziendePubbliche,
  aziendaSlug,
  type AziendaPubblica,
  type ProdottoPubblico,
  type ServizioPubblico,
} from "@/lib/azienda-pubblica";
import { computeFootprint } from "@/lib/footprint";
import { useGeoResolve } from "@/lib/useGeoResolve";
import { supabase } from "@/lib/supabase";
import { addToCart } from "@/lib/carrello";
import { Semaforo, SemaforoIngrediente } from "@/components/Semaforo";
import { AlberiCompensazione } from "@/components/AlberiCompensazione";
import { formatPrezzo } from "@/lib/prezzo";
import { PLAN_MAP, type Plan } from "@/lib/piani";
import { createPortal } from "react-dom";
import { RichiestaServizioModal } from "@/components/RichiestaServizioModal";
import { PrenotaModal } from "@/components/PrenotaModal";
import { experiencesByOwners, type Experience } from "@/lib/bookings";
import { ContattaAziendaModal } from "@/components/ContattaAziendaModal";
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

/** Etichette delle lingue dei servizi (per i turisti stranieri). */
const LINGUE_LABEL: Record<string, string> = {
  it: "🇮🇹 Italiano", en: "🇬🇧 English", fr: "🇫🇷 Français", de: "🇩🇪 Deutsch",
  es: "🇪🇸 Español", pt: "🇵🇹 Português", nl: "🇳🇱 Nederlands", zh: "🇨🇳 中文",
  ru: "🇷🇺 Русский", ar: "🇸🇦 العربية",
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
  // esperienze (tabella condivisa `esperienze`) + apertura del modale di prenotazione
  const [esperienze, setEsperienze] = useState<Experience[]>([]);
  const [prenotaEsp, setPrenotaEsp] = useState(false);
  const [segnala, setSegnala] = useState<ServizioPubblico | null>(null);
  const [dettaglio, setDettaglio] = useState<ProdottoPubblico | null>(null);
  const [servDettaglio, setServDettaglio] = useState<ServizioPubblico | null>(null);
  const [contatta, setContatta] = useState(false);
  const [cartMsg, setCartMsg] = useState<string | null>(null);
  const [condiviso, setCondiviso] = useState(false);

  // "Condividi scheda": condivide l'URL CANONICO /azienda/{slug} (anteprima
  // ricca: nome + copertina), via menu nativo o copia link. Utile soprattutto
  // su mobile/in-app dove non c'è la barra dell'URL da copiare.
  async function condividiScheda(nome: string, citta: string | null) {
    let slug = aziendaSlug(nome);
    try {
      const lista = await tutteLeAziendePubbliche();
      const found = lista.find((x) => String(x.id) === String(id));
      if (found) slug = found.slug;
    } catch {
      /* offline: uso lo slug derivato dal nome */
    }
    const url = `${window.location.origin}/azienda/${slug}/`;
    const titolo = `${nome}${citta ? ` · ${citta}` : ""} — su ECO-VISA`;
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title: titolo, url });
        return;
      }
    } catch {
      return; /* condivisione annullata dall'utente */
    }
    try {
      await navigator.clipboard.writeText(url);
      setCondiviso(true);
      setTimeout(() => setCondiviso(false), 2500);
    } catch {
      /* clipboard non disponibile */
    }
  }

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

  // esperienze prenotabili dell'azienda (tabella condivisa con BioFido)
  useEffect(() => {
    const owner = dati?.azienda?.owner;
    if (!owner) return;
    experiencesByOwners([owner]).then((m) => setEsperienze(m[owner] ?? []));
  }, [dati?.azienda?.owner]);

  // conta una VISITA alla scheda pubblica (una sola volta per apertura)
  const vistaContata = useRef(false);
  useEffect(() => {
    const owner = dati?.azienda?.owner;
    if (owner && !vistaContata.current) {
      vistaContata.current = true;
      registraVisita(owner);
    }
  }, [dati]);

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
          className="mt-3 aspect-[16/9] w-full rounded-2xl object-cover object-top"
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

        <div className="mt-4 flex flex-wrap gap-2">
          {azienda.owner && (
            <button
              type="button"
              onClick={() => setContatta(true)}
              className="inline-flex items-center gap-2 rounded-full border border-green-600 px-4 py-1.5 text-sm font-bold text-green-700 hover:bg-leaf"
            >
              ✉️ Contatta l&apos;azienda
            </button>
          )}
          <button
            type="button"
            onClick={() => condividiScheda(azienda.nome, azienda.citta_sede)}
            className="inline-flex items-center gap-2 rounded-full border border-green-600 px-4 py-1.5 text-sm font-bold text-green-700 hover:bg-leaf"
          >
            🔗 {condiviso ? "Link copiato!" : "Condividi scheda"}
          </button>
        </div>
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
                  <Semaforo level={fp.level} score={fp.score} consigli={fp.consigli} />
                  <p className="mt-1 text-[11px] text-green-900/60">
                    Giudizio <strong>qualitativo della composizione</strong> (ogni materia
                    prima ha il suo colore, qui sotto), non una somma di CO₂.{" "}
                    <Link href="/semaforo" className="font-semibold text-green-700 underline">
                      Come funziona →
                    </Link>
                  </p>
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
                      <li key={i} className="flex items-center justify-between gap-2">
                        <span className="flex min-w-0 items-center gap-1">
                          <SemaforoIngrediente tier={ing.tier} />
                          <span className="truncate">{ing.name}</span>
                        </span>
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

      {/* Esperienze in azienda prenotabili (tabella `esperienze`, condivisa con BioFido) */}
      {esperienze.length > 0 && (
        <>
          <h2 className="mt-10 font-display text-2xl text-green-800">
            Esperienze in azienda prenotabili
          </h2>
          <p className="mt-1 text-sm text-green-900/70">
            Visite, laboratori e degustazioni da prenotare direttamente con l&apos;azienda.
          </p>
          <ul className="mt-4 grid gap-4 sm:grid-cols-2">
            {esperienze.map((e) => (
              <li
                key={e.id}
                className="rounded-2xl border-2 border-badge-yellow bg-[#fffbe9] p-4"
              >
                <div className="flex items-start gap-3">
                  {e.immagine && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={e.immagine} alt={e.titolo} className="h-16 w-16 shrink-0 rounded-lg object-cover" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-green-800">{e.titolo}</div>
                    {e.descrizione && (
                      <p className="mt-0.5 text-xs text-green-900/65">{e.descrizione}</p>
                    )}
                    <div className="mt-0.5 text-[11px] text-green-900/55">
                      {e.durataMin ? `~${e.durataMin} min · ` : ""}max {e.maxPersone} persone
                      {e.giorniSettimana?.length
                        ? ` · 🗓 ${e.giorniSettimana
                            .map((g) => ["", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"][g])
                            .join(", ")}`
                        : ""}
                      {e.orario ? ` · ${e.orario}` : ""}
                    </div>
                    {e.lingue?.length ? (
                      <div className="mt-0.5 text-[11px] text-green-900/55">
                        {e.lingue.map((l) => LINGUE_LABEL[l] ?? l).join(" · ")}
                      </div>
                    ) : null}
                  </div>
                  <div className="shrink-0 text-sm font-bold text-green-800">
                    {euroNum(e.prezzoCents / 100)}
                  </div>
                </div>
                {azienda.owner && (
                  <button
                    type="button"
                    onClick={() => setPrenotaEsp(true)}
                    className="btn-lime mt-3 w-full justify-center text-sm"
                  >
                    ✨ Prenota
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

      {prenotaEsp && azienda.owner && esperienze.length > 0 && (
        <PrenotaModal
          esperienze={esperienze}
          ownerPlan={(azienda.plan as Plan) ?? "free"}
          aziendaNome={azienda.nome}
          onClose={() => setPrenotaEsp(false)}
        />
      )}

      {contatta && azienda.owner && (
        <ContattaAziendaModal
          ownerId={azienda.owner}
          aziendaNome={azienda.nome}
          onClose={() => setContatta(false)}
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

      {servDettaglio &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 p-3 sm:p-4"
            onClick={() => setServDettaglio(null)}
          >
            <div
              className="card max-h-[88dvh] w-full max-w-lg overflow-y-auto overscroll-contain p-0"
              onClick={(e) => e.stopPropagation()}
            >
              {(servDettaglio.immagine || servDettaglio.foto2) && (
                <div className={`grid gap-1 ${servDettaglio.immagine && servDettaglio.foto2 ? "sm:grid-cols-2" : "grid-cols-1"}`}>
                  {[servDettaglio.immagine, servDettaglio.foto2].filter(Boolean).map((src, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={i}
                      src={src as string}
                      alt={servDettaglio.nome}
                      className="max-h-72 w-full bg-leaf/30 object-contain first:rounded-tl-2xl last:rounded-tr-2xl"
                    />
                  ))}
                </div>
              )}
              <div className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-xs font-bold uppercase tracking-wide text-lime-500">
                      {TIPO_SERVIZIO[servDettaglio.tipo] ?? "Servizio"}
                    </div>
                    <h3 className="font-display text-2xl text-green-800">{servDettaglio.nome}</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setServDettaglio(null)}
                    aria-label="Chiudi"
                    className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-leaf text-green-800 hover:bg-leaf/70"
                  >
                    ✕
                  </button>
                </div>
                {servDettaglio.prezzo != null && (
                  <div className="mt-2 text-2xl font-bold text-green-800">{euroNum(servDettaglio.prezzo)}</div>
                )}
                {servDettaglio.durata && (
                  <p className="mt-1 text-sm font-semibold text-green-900/75">⏱ Durata: {servDettaglio.durata}</p>
                )}
                {servDettaglio.lingue && servDettaglio.lingue.length > 0 && (
                  <p className="mt-1 text-sm font-semibold text-green-900/75">
                    🗣 Lingue: {servDettaglio.lingue.map((c) => LINGUE_LABEL[c] ?? c).join(" · ")}
                  </p>
                )}
                {servDettaglio.descrizione ? (
                  <p className="mt-3 whitespace-pre-line text-green-900/80">{servDettaglio.descrizione}</p>
                ) : (
                  <p className="mt-3 text-sm text-green-900/45">Nessuna descrizione disponibile.</p>
                )}
                {azienda.owner && (
                  <button
                    type="button"
                    onClick={() => {
                      const s = servDettaglio;
                      setServDettaglio(null);
                      setPrenotaServizio(s);
                    }}
                    className="btn-lime mt-5 w-full justify-center text-sm"
                  >
                    ✨ Prenota / richiedi
                  </button>
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}

      {cartMsg && (
        <div className="fixed bottom-5 left-1/2 z-[300] -translate-x-1/2 rounded-full bg-green-800 px-5 py-2 text-sm font-bold text-white shadow-lg">
          🛒 {cartMsg}
        </div>
      )}
    </>
  );
}
