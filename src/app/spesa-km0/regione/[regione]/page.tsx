import { notFound } from "next/navigation";
import Link from "next/link";
import { tutteLeRegioni, regioneBySlug } from "@/lib/zone";

// Hub SEO statico: una landing "Spesa a km zero in {Regione}" che raggruppa le
// città della regione, con conteggi e link alle pagine-città. Generata al build.

export async function generateStaticParams() {
  const regioni = await tutteLeRegioni();
  return regioni.map((r) => ({ regione: r.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ regione: string }>;
}) {
  const { regione } = await params;
  const r = await regioneBySlug(regione);
  if (!r) return { title: "Spesa a km zero — ECO-VISA" };
  const citta = r.zone.map((z) => z.citta).slice(0, 6).join(", ");
  return {
    title: `Spesa a km zero in ${r.nome}: spacci, produttori bio e prodotti locali | ECO-VISA`,
    description:
      `Spesa a chilometro zero in ${r.nome}: ${r.zone.length} città (${citta}), ` +
      `${r.nStores} spacci, ${r.nBio} produttori biologici e ${r.nProdotti} prodotti ` +
      `con impronta del trasporto misurata. Compra vicino a te e riduci la CO₂ di trasporto.`,
    alternates: { canonical: `https://ecovisa.it/spesa-km0/regione/${r.slug}/` },
  };
}

export default async function RegionePage({
  params,
}: {
  params: Promise<{ regione: string }>;
}) {
  const { regione } = await params;
  const r = await regioneBySlug(regione);
  if (!r) notFound();

  const altre = (await tutteLeRegioni()).filter((x) => x.slug !== r.slug);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `Spesa a km zero in ${r.nome}`,
    about: `Spacci aziendali, produttori biologici e prodotti locali in ${r.nome}`,
    hasPart: r.zone.map((z) => ({
      "@type": "WebPage",
      name: `Spesa a km zero a ${z.citta}`,
      url: `https://ecovisa.it/spesa-km0/${z.slug}/`,
    })),
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <nav className="text-sm text-green-900/60">
        <Link href="/spesa-km0" className="font-bold text-green-700 hover:text-lime-500">
          Spesa a km zero
        </Link>{" "}
        / <span>{r.nome}</span>
      </nav>

      <h1 className="title-pangea mt-2 text-4xl text-green-700 md:text-5xl">
        Spesa a km zero in {r.nome}
      </h1>
      <p className="mt-3 max-w-2xl text-green-900/80">
        Spacci aziendali, produttori biologici e prodotti del territorio in{" "}
        <strong>{r.nome}</strong>: scegli la tua città e compra direttamente da chi
        produce, scoprendo l&apos;impronta del trasporto di trasporto di ogni prodotto.
      </p>

      <p className="mt-4 text-sm font-bold text-green-900/70">
        {r.zone.length} città · {r.nStores} spacci · {r.nBio} produttori bio ·{" "}
        {r.nProdotti} prodotti
      </p>

      {r.categorie.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {r.categorie.map((c) => (
            <span
              key={c}
              className="rounded-full bg-leaf px-3 py-1 text-xs font-bold text-green-800"
            >
              {c}
            </span>
          ))}
        </div>
      )}

      {/* Città della regione */}
      <section className="mt-10">
        <h2 className="title-pangea text-2xl text-green-700">
          Città in {r.nome}
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {r.zone.map((z) => (
            <Link
              key={z.slug}
              href={`/spesa-km0/${z.slug}`}
              className="card p-5 transition hover:-translate-y-1"
            >
              <h3 className="font-display text-2xl text-green-800">{z.citta}</h3>
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
      </section>

      {/* CTA azienda */}
      <div className="mt-12 rounded-2xl border border-[#e3eed7] bg-leaf p-6">
        <h2 className="font-display text-2xl text-green-800">
          Sei un&apos;azienda in {r.nome}?
        </h2>
        <p className="mt-1 text-green-900/80">
          Mostra l&apos;impronta del trasporto dei tuoi prodotti e fatti trovare da chi
          cerca prodotti locali nella tua zona. La scheda base è gratuita.
        </p>
        <Link href="/registrati" className="btn-lime mt-4 inline-block">
          Iscrivi la tua azienda
        </Link>
      </div>

      {/* Altre regioni (crawlability) */}
      {altre.length > 0 && (
        <section className="mt-12 border-t border-[#e8f1dc] pt-6">
          <h2 className="label mb-3">Spesa a km zero in altre regioni</h2>
          <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
            {altre.map((x) => (
              <Link
                key={x.slug}
                href={`/spesa-km0/regione/${x.slug}`}
                className="font-bold text-green-700 hover:text-lime-500"
              >
                {x.nome}
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
