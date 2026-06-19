import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "BioFido — il segugio del biologico",
  description:
    "Trova produttori, negozi e attività biologiche vicino a te, fino a 70 km, e fatti guidare fin lì.",
};

// L'app BioFido vera vive su questo indirizzo (stessa app pubblicata sul Play
// Store). Qui la mostriamo incorporata, così l'utente resta sul portale ECO-VISA
// senza cambiare sito. Un domani BioFido potrà avere un suo dominio: basterà
// cambiare questo URL.
const BIOFIDO_APP = "https://mercutio-debug.github.io/biofido/";

export default function BioFidoPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-2 py-4">
      <iframe
        src={BIOFIDO_APP}
        title="BioFido — mappa delle attività biologiche"
        className="h-[calc(100dvh-120px)] min-h-[560px] w-full rounded-2xl border border-[#e3eed7]"
        allow="geolocation; clipboard-write"
        referrerPolicy="no-referrer-when-downgrade"
      />
      <p className="mt-2 text-center text-xs text-green-900/55">
        Se la mappa non chiede la tua posizione, consenti la geolocalizzazione
        oppure{" "}
        <a
          href={BIOFIDO_APP}
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-green-700 hover:text-lime-500"
        >
          apri BioFido a tutto schermo
        </a>
        .
      </p>
    </div>
  );
}
