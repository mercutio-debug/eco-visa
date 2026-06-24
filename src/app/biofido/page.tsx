"use client";

import { useEffect } from "react";

// Ora BioFido ha il suo dominio (biofido.it). Questa pagina interna non serve
// più: reindirizza al sito vero. Lì l'utente trova la mappa aggiornata e il
// banner cookie/privacy del dominio biofido.it.
const BIOFIDO = "https://biofido.it/";

export default function BioFidoRedirect() {
  useEffect(() => {
    window.location.replace(BIOFIDO);
  }, []);

  return (
    <div className="mx-auto max-w-xl px-4 py-20 text-center">
      <h1 className="font-display text-2xl text-green-800">Ti portiamo su BioFido…</h1>
      <p className="mt-3 text-green-900/75">
        BioFido ora è su <strong>biofido.it</strong> — la mappa del biologico a
        chilometro zero. Se non vieni reindirizzato automaticamente:
      </p>
      <a href={BIOFIDO} className="btn-lime mt-5 inline-block">
        🐾 Vai su biofido.it
      </a>
    </div>
  );
}
