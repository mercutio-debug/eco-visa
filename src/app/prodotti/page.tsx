import { ProdottiIscritti } from "@/components/ProdottiIscritti";
import { LegendaSemaforo } from "@/components/LegendaSemaforo";

export const metadata = { title: "Prodotti — ECO-VISA" };

export default function ProdottiPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="title-pangea text-5xl text-green-700">Schede prodotto</h1>
      <p className="mt-3 max-w-2xl text-green-900/80">
        Ogni prodotto ha una scheda pubblica, consultabile da tutti: elenco
        ingredienti, dati del produttore e un semaforo che indica quanto è
        ecologicamente sostenibile.
      </p>

      {/* In alto i prodotti reali delle aziende iscritte */}
      <ProdottiIscritti />

      {/* Legenda: una scheda d'esempio per ogni tonalità del semaforo */}
      <section className="mt-12">
        <h2 className="font-display text-2xl text-green-800">Come leggere il semaforo</h2>
        <p className="mt-1 max-w-2xl text-sm text-green-900/65">
          Una scheda d&apos;esempio per ogni tonalità: cosa determina il colore di un
          prodotto, dal verde a km0 fino alle filiere più lunghe.
        </p>
        <div className="mt-5">
          <LegendaSemaforo />
        </div>
      </section>
    </div>
  );
}
