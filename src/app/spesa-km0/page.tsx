import Link from "next/link";
import { tutteLeZone } from "@/lib/zone";

export const metadata = {
  title: "Spesa a km zero per città: spacci, produttori bio e prodotti locali | ECO-VISA",
  description:
    "Scegli la tua città e scopri spacci aziendali, produttori biologici e prodotti locali con impronta ecologica misurata. Compra vicino a te, riduci la CO₂ di trasporto.",
  alternates: { canonical: "https://ecovisa.it/spesa-km0/" },
};

export default function SpesaKm0Index() {
  const zone = tutteLeZone();

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="title-pangea text-5xl text-green-700">Spesa a km zero, città per città</h1>
      <p className="mt-3 max-w-2xl text-green-900/80">
        Trova spacci aziendali, produttori biologici e prodotti del territorio
        vicino a te. Ogni prodotto ha un&apos;impronta di trasporto misurata: così
        sai quanta CO₂ risparmi comprando locale.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {zone.map((z) => (
          <Link
            key={z.slug}
            href={`/spesa-km0/${z.slug}`}
            className="card p-5 transition hover:-translate-y-1"
          >
            <h2 className="font-display text-2xl text-green-800">{z.citta}</h2>
            <p className="mt-1 text-sm text-green-900/70">
              {z.stores.length} spacci · {z.bio.length} produttori bio ·{" "}
              {z.prodotti.length} prodotti
            </p>
            {z.categorie.length > 0 && (
              <p className="mt-2 text-xs text-green-900/60">
                {z.categorie.slice(0, 4).join(" · ")}
              </p>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
