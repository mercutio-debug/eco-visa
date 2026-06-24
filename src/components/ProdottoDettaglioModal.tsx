"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import type { ProdottoPubblico } from "@/lib/azienda-pubblica";
import { formatPrezzo } from "@/lib/prezzo";

/**
 * Scheda prodotto "aperta": foto grandi (prodotto + etichetta), descrizione
 * completa, confezione/contenuto e i tasti per prenotare o aggiungere al
 * carrello. Si apre cliccando la card prodotto nella scheda azienda.
 */
export function ProdottoDettaglioModal({
  p,
  ownerPresente,
  onClose,
  onPrenota,
  onCarrello,
}: {
  p: ProdottoPubblico;
  ownerPresente: boolean;
  onClose: () => void;
  onPrenota: () => void;
  onCarrello: () => void;
}) {
  const volume =
    p.contenuto != null ? `${p.contenuto} ${p.unita ?? ""}`.trim() : null;
  const esaurito = p.in_shop && p.giacenza === 0;

  // blocca lo scroll della pagina sotto mentre il modale è aperto
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const contenuto = (
    <div
      className="fixed inset-0 z-[2000] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="card max-h-[92vh] w-full max-w-2xl overflow-y-auto p-0"
        onClick={(e) => e.stopPropagation()}
      >
        {/* galleria foto */}
        {(p.immagine || p.foto2) && (
          <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
            {p.immagine && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.immagine} alt={p.nome} className="h-64 w-full object-cover sm:rounded-tl-2xl" />
            )}
            {p.foto2 && (
              <figure className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.foto2} alt={`${p.nome} — etichetta`} className="h-64 w-full object-cover sm:rounded-tr-2xl" />
                <figcaption className="absolute bottom-0 left-0 right-0 bg-black/45 py-1 text-center text-xs font-semibold text-white">
                  Etichetta
                </figcaption>
              </figure>
            )}
          </div>
        )}

        <div className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              {p.categoria && (
                <div className="text-xs font-bold uppercase tracking-wide text-lime-500">{p.categoria}</div>
              )}
              <h3 className="font-display text-2xl text-green-800">{p.nome}</h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Chiudi"
              className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-leaf text-green-800 hover:bg-leaf/70"
            >
              ✕
            </button>
          </div>

          {p.prezzo && <div className="mt-2 text-2xl font-bold text-green-800">{formatPrezzo(p.prezzo)}</div>}

          {(p.confezione || volume) && (
            <p className="mt-2 text-sm font-semibold text-green-900/75">
              {[p.confezione, volume].filter(Boolean).join(" · ")}
            </p>
          )}
          {p.durata && (
            <p className="mt-1 text-sm font-semibold text-green-900/75">⏱ Durata: {p.durata}</p>
          )}
          {p.stabilimento_citta && (
            <p className="mt-1 text-xs text-green-900/60">Stabilimento: {p.stabilimento_citta}</p>
          )}

          {p.descrizione && (
            <p className="mt-3 whitespace-pre-line text-green-900/80">{p.descrizione}</p>
          )}

          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            {p.prenotabile && ownerPresente && (
              <button
                type="button"
                onClick={() => {
                  onPrenota();
                  onClose();
                }}
                className="btn-lime flex-1 justify-center text-sm"
              >
                ✨ Prenota / richiedi
              </button>
            )}
            {p.in_shop &&
              (esaurito ? (
                <div className="flex-1 rounded-lg bg-[#f3dada] py-2 text-center text-sm font-bold text-traffic-red">
                  Esaurito
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    onCarrello();
                    onClose();
                  }}
                  className="btn-lime flex-1 justify-center text-sm"
                >
                  🛒 Aggiungi al carrello
                </button>
              ))}
          </div>
          {p.in_shop && !esaurito && typeof p.giacenza === "number" && (
            <div className="mt-2 text-xs font-semibold text-green-900/60">Disponibili: {p.giacenza}</div>
          )}
        </div>
      </div>
    </div>
  );

  // Portale su document.body: il modale non viene "agganciato" da eventuali
  // antenati con transform (che lo renderebbero decentrato o non cliccabile).
  return typeof document !== "undefined" ? createPortal(contenuto, document.body) : null;
}
