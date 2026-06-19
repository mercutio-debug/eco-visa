"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/useAuth";
import { SchedaBioFido } from "@/components/SchedaBioFido";

// L'app BioFido (mappa) vive su questo indirizzo: la mostriamo incorporata solo
// per la VISUALIZZAZIONE (non serve login per guardare la mappa). L'iscrizione e
// la gestione avvengono qui su ECO-VISA, con lo stesso account: niente login
// doppio. Un domani BioFido potrà avere un suo dominio: basta cambiare l'URL.
const BIOFIDO_APP = "https://mercutio-debug.github.io/biofido/";

export default function BioFidoPage() {
  const { user, loading } = useAuth();
  // contrassegno salvato alla registrazione (spunta "Iscrivimi anche a BioFido")
  const enrolled = user?.user_metadata?.vuole_biofido === true;

  const [busy, setBusy] = useState(false);
  const [justEnrolled, setJustEnrolled] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function iscriviABioFido() {
    setBusy(true);
    setErr(null);
    const { error } = await supabase.auth.updateUser({
      data: { vuole_biofido: true },
    });
    setBusy(false);
    if (error) {
      setErr(error.message);
      return;
    }
    setJustEnrolled(true);
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      {/* Azienda loggata su ECO-VISA ma NON ancora iscritta a BioFido */}
      {!loading && user && !enrolled && !justEnrolled && (
        <div className="card mb-6 border-2 border-cape-red p-6">
          <div className="text-xs font-bold uppercase tracking-wide text-lime-500">
            Sei su ECO-VISA
          </div>
          <h2 className="mt-1 font-display text-2xl text-green-800">
            Per adesso sei iscritto solo a ECO-VISA
          </h2>
          <p className="mt-2 max-w-2xl text-green-900/80">
            Se sei un&apos;azienda <strong>biologica</strong>, iscriviti anche a{" "}
            <strong>BioFido</strong> — la mappa del bio a chilometro zero. Stesso
            account e stesse credenziali: in un clic.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button className="btn-lime" onClick={iscriviABioFido} disabled={busy}>
              {busy ? "Iscrizione…" : "🐾 Iscrivimi a BioFido"}
            </button>
            <Link href="/dashboard" className="btn-ghost">
              Vai alla tua pagina
            </Link>
          </div>
          {err && <p className="mt-3 text-sm font-semibold text-traffic-red">{err}</p>}
        </div>
      )}

      {/* Iscritto a BioFido: compila/aggiorna QUI la scheda per comparire sulla mappa */}
      {(enrolled || justEnrolled) && user && (
        <>
          {justEnrolled && (
            <div className="card mb-4 border-2 border-[var(--lime-500)] bg-leaf/40 p-5">
              <h2 className="font-display text-2xl text-green-800">
                Ora sei iscritto a BioFido ✅
              </h2>
              <p className="mt-1 text-green-900/80">
                Ultimo passo: compila la scheda qui sotto e salva per comparire sulla mappa.
              </p>
            </div>
          )}
          <SchedaBioFido ownerId={user.id} />
        </>
      )}

      {/* Visitatore non loggato: invito leggero a iscriversi */}
      {!loading && !user && (
        <div className="mb-6 rounded-2xl border border-[#e3eed7] bg-white p-5 text-sm text-green-900/80">
          Sei un&apos;azienda biologica?{" "}
          <Link href="/registrati" className="font-bold text-green-700 hover:text-lime-500">
            Iscriviti
          </Link>{" "}
          per comparire sulla mappa di BioFido.
        </div>
      )}

      {/* Mappa BioFido (solo visualizzazione: non serve login per guardarla) */}
      <iframe
        src={BIOFIDO_APP}
        title="BioFido — mappa delle attività biologiche"
        className="h-[calc(100dvh-160px)] min-h-[520px] w-full rounded-2xl border border-[#e3eed7]"
        allow="geolocation; clipboard-write"
        referrerPolicy="no-referrer-when-downgrade"
      />
      <p className="mt-2 text-center text-xs text-green-900/55">
        Se la mappa non chiede la posizione, consenti la geolocalizzazione oppure{" "}
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
