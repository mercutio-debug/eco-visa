import Link from "next/link";
import { PRODUCTS } from "@/lib/data";
import { computeFootprint } from "@/lib/footprint";
import { Semaforo } from "@/components/Semaforo";
import { ProdottiIscritti } from "@/components/ProdottiIscritti";
// NB: niente <VetrinaAziende /> qui — ripeteva "Dalle aziende iscritte" (duplicazione rimossa).

export const metadata = { title: "Prodotti — ECO-VISA" };

export default function ProdottiPage() {
  const items = PRODUCTS.map((p) => ({
    p,
    fp: computeFootprint(p.plant, p.ingredients),
  }));

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

      {/* Sotto, gli esempi dimostrativi */}
      <h2 className="mt-10 font-display text-2xl text-green-800">Esempi dimostrativi</h2>
      <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {items.map(({ p, fp }) => (
          <Link key={p.slug} href={`/prodotti/${p.slug}`} className="card p-5 transition hover:-translate-y-1">
            <div className="text-xs font-bold uppercase tracking-wide text-lime-500">
              {p.category}
            </div>
            <h2 className="font-display text-2xl leading-tight text-green-800">
              {p.name}
            </h2>
            <p className="mt-1 text-sm text-green-900/70">
              {p.company.name} · {p.plant}
            </p>
            <div className="mt-4 flex items-center justify-between">
              <Semaforo level={fp.level} size="sm" />
              <div className="text-right">
                <div className="font-display text-2xl text-green-800">
                  {fp.totalCo2Kg.toLocaleString("it-IT")} kg
                </div>
                <div className="text-[11px] text-green-900/60">CO₂ trasporto</div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
