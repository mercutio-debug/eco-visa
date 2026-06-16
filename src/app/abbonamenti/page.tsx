import type { Metadata } from "next";
import {
  ManifestoQualita,
  PianiAbbonamento,
  SociFondatori,
} from "@/components/Abbonamenti";

export const metadata: Metadata = {
  title: "Abbonamenti — ECO-VISA",
  description:
    "I piani ECO-VISA per le aziende: mostra il valore vero dei tuoi prodotti, non il prezzo più basso. Schede impronta, badge incorporabile e visibilità nella directory.",
};

export default function AbbonamentiPage() {
  return (
    <div className="space-y-12 py-10">
      <header className="mx-auto max-w-6xl px-4">
        <div className="text-xs font-bold uppercase tracking-wide text-lime-500">
          Per le aziende
        </div>
        <h1 className="title-pangea text-4xl text-green-700 md:text-5xl">
          Abbonamenti
        </h1>
        <p className="mt-3 max-w-2xl text-lg text-green-900/80">
          Su ECO-VISA non vince chi costa meno: vince chi fa il prodotto
          migliore. Misura e mostra il valore vero di ciò che produci.
        </p>
      </header>

      <ManifestoQualita />

      <section className="mx-auto max-w-6xl px-4">
        <PianiAbbonamento />
      </section>

      <SociFondatori />
    </div>
  );
}
