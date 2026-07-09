import { notFound } from "next/navigation";
import Link from "next/link";
import { tutteLeZone, zonaBySlug, regioneDiCitta } from "@/lib/zone";
import { Semaforo } from "@/components/Semaforo";

// Pagina SEO statica: una landing "Spesa a km zero a {Città}" per ogni località
// con spacci, produttori bio o prodotti. Generata al build (output: export).

export async function generateStaticParams() {
  const zone = await tutteLeZone();
  return zone.map((z) => ({ citta: z.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ citta: string }>;
}) {
  const { citta } = await params;
  const z = await zonaBySlug(citta);
  if (!z) return { title: "Spesa a km zero — ECO-VISA" };
  const cat = z.categorie.slice(0, 4).join(", ");
  return {
    title: `Spesa a km zero a ${z.citta}: spacci, produttori bio e prodotti locali | ECO-VISA`,
    description:
      `A ${z.citta}: ${z.stores.length} punti vendita diretti, ${z.bio.length} produttori biologici e ` +
      `${z.prodotti.length} prodotti con impronta del trasporto misurata${cat ? ` (${cat})` : ""}. ` +
      `Compra vicino a te e scopri quanta CO₂ di trasporto risparmi.`,
    alternates: { canonical: `https://ecovisa.it/spesa-km0/${z.slug}/` },
  };
}

export default async function ZonaPage({
  params,
}: {
  params: Promise<{ citta: string }>;
}) {
  const { citta } = await params;
  const z = await zonaBySlug(citta);
  if (!z) notFound();

  const altre = (await tutteLeZone()).filter((x) => x.slug !== z.slug);
  const regione = regioneDiCitta(z.citta);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `Spesa a km zero a ${z.citta}`,
    about: `Spacci aziendali, produttori biologici e prodotti locali a ${z.citta}`,
    hasPart: [
      ...z.stores.map((s) => ({ "@type": "LocalBusiness", name: s.name, address: { "@type": "PostalAddress", addressLocality: z.citta } })),
      ...z.bio.map((b) => ({ "@type": "LocalBusiness", name: b.name, address: { "@type": "PostalAddress", addressLocality: z.citta } })),
    ],
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
        {regione && (
          <>
            /{" "}
            <Link
              href={`/spesa-km0/regione/${regione.slug}`}
              className="font-bold text-green-700 hover:text-lime-500"
            >
              {regione.nome}
            </Link>{" "}
          </>
        )}
        / <span>{z.citta}</span>
      </nav>

      <h1 className="title-pangea mt-2 text-4xl text-green-700 md:text-5xl">
        Spesa a km zero a {z.citta}
      </h1>
      <p className="mt-3 max-w-2xl text-green-900/80">
        Spacci aziendali, produttori biologici e prodotti del territorio di{" "}
        <strong>{z.citta}</strong>: compra direttamente da chi produce e scopri
        l&apos;impronta del trasporto di trasporto di ogni prodotto.
      </p>

      {z.categorie.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {z.categorie.map((c) => (
            <span
              key={c}
              className="rounded-full bg-leaf px-3 py-1 text-xs font-bold text-green-800"
            >
              {c}
            </span>
          ))}
        </div>
      )}

      {/* Spacci e negozi diretti */}
      {z.stores.length > 0 && (
        <section className="mt-10">
          <h2 className="title-pangea text-2xl text-green-700">
            Spacci e vendita diretta a {z.citta}
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {z.stores.map((s) => (
              <div key={s.id} className="card p-5">
                <div className="text-xs font-bold uppercase tracking-wide text-lime-500">
                  {s.category}
                </div>
                <h3 className="font-display text-xl text-green-800">{s.name}</h3>
                <p className="mt-1 text-sm text-green-900/70">{s.type}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Produttori biologici → rimando a BioFido */}
      {z.bio.length > 0 && (
        <section className="mt-10">
          <h2 className="title-pangea text-2xl text-green-700">
            Produttori biologici a {z.citta}
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {z.bio.map((b) => (
              <div key={b.id} className="card p-5">
                <div className="text-xs font-bold uppercase tracking-wide text-lime-500">
                  {b.category}
                </div>
                <h3 className="font-display text-xl text-green-800">{b.name}</h3>
                <p className="mt-1 text-sm text-green-900/70">Produttore bio · {z.citta}</p>
              </div>
            ))}
          </div>
          <Link href="/biofido" className="btn-lime mt-4 inline-block">
            Vedi tutti i produttori bio sulla mappa
          </Link>
        </section>
      )}

      {/* Prodotti con impronta */}
      {z.prodotti.length > 0 && (
        <section className="mt-10">
          <h2 className="title-pangea text-2xl text-green-700">
            Prodotti locali con impronta misurata
          </h2>
          <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {z.prodotti.map((p, i) => {
              const inner = (
                <>
                  <div className="text-xs font-bold uppercase tracking-wide text-lime-500">
                    {p.category}
                    {p.real && (
                      <span className="ml-2 rounded-full bg-leaf px-2 py-0.5 text-[10px] text-green-800">
                        azienda iscritta
                      </span>
                    )}
                  </div>
                  <h3 className="font-display text-2xl leading-tight text-green-800">
                    {p.name}
                  </h3>
                  <p className="mt-1 text-sm text-green-900/70">{p.company}</p>
                  <div className="mt-4 flex items-center justify-between">
                    <Semaforo level={p.level} size="sm" />
                    <div className="text-right">
                      <div className="font-display text-2xl text-green-800">
                        {p.totalCo2Kg.toLocaleString("it-IT")} kg
                      </div>
                      <div className="text-[11px] text-green-900/60">CO₂ trasporto</div>
                    </div>
                  </div>
                </>
              );
              return p.slug ? (
                <Link
                  key={p.slug}
                  href={`/prodotti/${p.slug}`}
                  className="card p-5 transition hover:-translate-y-1"
                >
                  {inner}
                </Link>
              ) : (
                <div key={`${p.company}-${p.name}-${i}`} className="card p-5">
                  {inner}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* CTA azienda */}
      <div className="mt-12 rounded-2xl border border-[#e3eed7] bg-leaf p-6">
        <h2 className="font-display text-2xl text-green-800">
          Sei un&apos;azienda di {z.citta}?
        </h2>
        <p className="mt-1 text-green-900/80">
          Mostra l&apos;impronta del trasporto dei tuoi prodotti e fatti trovare da chi
          cerca prodotti locali a {z.citta}. La scheda base è gratuita.
        </p>
        <Link href="/registrati" className="btn-lime mt-4 inline-block">
          Iscrivi la tua azienda
        </Link>
      </div>

      {/* Hub di link alle altre città (crawlability) */}
      {altre.length > 0 && (
        <section className="mt-12 border-t border-[#e8f1dc] pt-6">
          <h2 className="label mb-3">Spesa a km zero in altre città</h2>
          <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
            {altre.map((x) => (
              <Link
                key={x.slug}
                href={`/spesa-km0/${x.slug}`}
                className="font-bold text-green-700 hover:text-lime-500"
              >
                {x.citta}
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
