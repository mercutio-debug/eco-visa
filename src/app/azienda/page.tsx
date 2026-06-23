"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { AziendaScheda } from "@/components/AziendaScheda";

// Fallback: /azienda?id=<uuid> (link diretti + aziende iscritte dopo l'ultimo
// build, non ancora presenti come pagina statica /azienda/[slug]).
function Contenuto() {
  const id = useSearchParams().get("id");
  return <AziendaScheda id={id} />;
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
