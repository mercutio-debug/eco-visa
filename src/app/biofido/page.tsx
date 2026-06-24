"use client";

import Link from "next/link";
import { useAuth } from "@/lib/useAuth";

// La mappa pubblica di BioFido legge lo STESSO database di ECO-VISA: si aggiorna
// DA SOLA quando un'azienda si iscrive da qui. La mostriamo EMBEDDED, così
// l'utente resta sempre su ECO-VISA (nessun salto di sito). L'iscrizione avviene
// nella propria pagina, spuntando "Iscriviti anche a BioFido" dopo la
// certificazione biologica.
const BIOFIDO_MAPPA = "https://biofido.it/";

export default function BioFidoPage() {
  const { user, loading } = useAuth();
  const enrolled = user?.user_metadata?.vuole_biofido === true;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <h1 className="font-display text-3xl text-green-800">
        BioFido — la mappa del bio a chilometro zero
      </h1>
      <p className="mt-1 max-w-2xl text-green-900/75">
        Trova produttori, negozi e attività biologiche vicino a te. Comparire qui
        è incluso nel tuo account ECO-VISA: non serve un secondo sito.
      </p>

      {/* Stato iscrizione — tutto interno a ECO-VISA, solo link interni */}
      {!loading && user && !enrolled && (
        <div className="card mt-5 border-2 border-badge-yellow bg-[#fffbe9] p-5">
          <h2 className="font-display text-xl text-green-800">
            Vuoi comparire sulla mappa?
          </h2>
          <p className="mt-1 text-green-900/80">
            Dalla tua pagina inserisci la <strong>certificazione biologica</strong> e
            salva: comparirai <strong>automaticamente</strong> qui, con lo stesso account.
          </p>
          <Link href="/dashboard" className="btn-lime mt-3 inline-block">
            Vai alla tua pagina
          </Link>
        </div>
      )}
      {!loading && user && enrolled && (
        <div className="card mt-5 border-2 border-[var(--lime-500)] bg-leaf/40 p-5">
          <h2 className="font-display text-xl text-green-800">
            La tua azienda è su BioFido ✓
          </h2>
          <p className="mt-1 text-green-900/80">
            Modifichi categoria, città e contatti dalla{" "}
            <Link href="/dashboard" className="font-bold text-green-700 hover:text-lime-500">
              tua pagina
            </Link>
            .
          </p>
        </div>
      )}
      {!loading && !user && (
        <div className="mt-5 rounded-2xl border border-[#e3eed7] bg-white p-5 text-sm text-green-900/80">
          Sei un&apos;azienda biologica?{" "}
          <Link href="/registrati" className="font-bold text-green-700 hover:text-lime-500">
            Iscriviti
          </Link>{" "}
          per comparire sulla mappa di BioFido.
        </div>
      )}

      {/* Mappa pubblica EMBEDDED: si aggiorna da sola dal database condiviso */}
      <div className="mt-6">
        <iframe
          src={BIOFIDO_MAPPA}
          title="BioFido — mappa delle attività biologiche"
          className="h-[calc(100dvh-220px)] min-h-[480px] w-full rounded-2xl border border-[#e3eed7]"
          allow="geolocation"
          referrerPolicy="no-referrer-when-downgrade"
        />
      </div>
    </div>
  );
}
