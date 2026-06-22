import Link from "next/link";
import { tutteLeZone, tutteLeRegioni } from "@/lib/zone";

export const metadata = {
  title: "Spesa a km zero per città: spacci, produttori bio e prodotti locali | ECO-VISA",
  description:
    "Scegli la tua città e scopri spacci aziendali, produttori biologici e prodotti locali con impronta ecologica misurata. Compra vicino a te, riduci la CO₂ di trasporto.",
  alternates: { canonical: "https://ecovisa.it/spesa-km0/" },
};

export default async function SpesaKm0Index() {
  const [zone, regioni] = await Promise.all([tutteLeZone(), tutteLeRegioni()]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="title-pangea text-5xl text-green-700">Spesa a km zero, città per città</h1>
      <p className="mt-3 max-w-2xl text-green-900/80">
        Trova spacci aziendali, produttori biologici e prodotti del territorio
        vicino a te. Ogni prodotto ha un&apos;impronta di trasporto misurata: così
        sai quanta CO₂ risparmi comprando locale.
      </p>

      {regioni.length > 0 && (
        <section className="mt-8">
          <h2 className="label mb-3">Sfoglia per regione</h2>
          <div className="flex flex-wrap gap-2">
            {regioni.map((r) => (
              <Link
                key={r.slug}
                href={`/spesa-km0/regione/${r.slug}`}
                className="rounded-full border border-[#d6e6c4] bg-leaf px-4 py-1.5 text-sm font-bold text-green-800 transition hover:border-lime-500"
              >
                {r.nome}{" "}
                <span className="font-normal text-green-900/55">({r.zone.length})</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <h2 className="label mb-3 mt-10">Tutte le città</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
