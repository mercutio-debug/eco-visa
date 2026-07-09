import { notFound } from "next/navigation";
import {
  tutteLeAziendePubbliche,
  aziendaBySlug,
  loadAziendaPubblica,
} from "@/lib/azienda-pubblica";
import { AziendaScheda, type DatiAzienda } from "@/components/AziendaScheda";

// Pagina pubblica condivisibile di un'azienda: URL pulito /azienda/{slug},
// contenuto nell'HTML (indicizzabile), Open Graph + JSON-LD. Generata al build
// dalle aziende iscritte. Le aziende nate dopo l'ultimo build restano comunque
// raggiungibili dal fallback /azienda?id=.

export const dynamicParams = false;

export async function generateStaticParams() {
  const aziende = await tutteLeAziendePubbliche();
  return aziende.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const a = await aziendaBySlug(slug);
  if (!a) return { title: "Azienda — ECO-VISA" };
  const luogo = a.citta ? ` a ${a.citta}` : "";
  return {
    title: `${a.nome}${a.citta ? ` · ${a.citta}` : ""} — impronta del trasporto dei prodotti | ECO-VISA`,
    description:
      `${a.nome}${luogo}: prodotti locali con impronta del trasporto di trasporto misurata. ` +
      `Scopri la filiera, l'impronta di CO₂ e contatta direttamente l'azienda su ECO-VISA.`,
    alternates: { canonical: `https://ecovisa.it/azienda/${slug}/` },
    openGraph: {
      title: `${a.nome}${a.citta ? ` · ${a.citta}` : ""} — ECO-VISA`,
      description: `Prodotti locali e impronta del trasporto di ${a.nome}${luogo}.`,
      url: `https://ecovisa.it/azienda/${slug}/`,
      type: "profile",
      // anteprima link: copertina dell'azienda se presente, altrimenti l'immagine
      // di default del sito (campagna). URL assoluto risolto via metadataBase.
      images: [a.immagine || "/demo/onboarding/img/campagna.jpg"],
    },
  };
}

export default async function AziendaSlugPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const a = await aziendaBySlug(slug);
  if (!a) notFound();
  const dati = (await loadAziendaPubblica(a.id)) as DatiAzienda | null;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: a.nome,
    url: `https://ecovisa.it/azienda/${slug}/`,
    ...(a.citta
      ? { address: { "@type": "PostalAddress", addressLocality: a.citta, addressCountry: "IT" } }
      : {}),
    ...(dati && dati.prodotti.length
      ? {
          makesOffer: dati.prodotti.map((p) => ({
            "@type": "Offer",
            itemOffered: { "@type": "Product", name: p.nome, category: p.categoria ?? undefined },
          })),
        }
      : {}),
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <AziendaScheda id={a.id} initial={dati} />
    </div>
  );
}
