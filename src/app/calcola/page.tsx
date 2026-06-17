import { CalcolatoreImpronta } from "@/components/CalcolatoreImpronta";

export default function CalcolaPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="title-pangea text-5xl text-green-700">Calcola l&apos;impronta</h1>
      <p className="mt-3 max-w-2xl text-green-900/80">
        Indica lo stabilimento di produzione e, per ogni materia prima, la
        località d&apos;origine: il calcolo della CO₂ di trasporto e il semaforo si
        aggiornano in tempo reale. È gratis e senza registrazione.
      </p>
      <div className="mt-8">
        <CalcolatoreImpronta />
      </div>
    </div>
  );
}
