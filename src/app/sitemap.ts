import type { MetadataRoute } from "next";
import { PRODUCTS } from "@/lib/data";
import { tutteLeZone, tutteLeRegioni } from "@/lib/zone";
import { tutteLeAziendePubbliche } from "@/lib/azienda-pubblica";

// Sitemap statica (output: export → genera /sitemap.xml al build). Dominio
// canonico di produzione (Hostinger a root): ecovisa.it.
const BASE = "https://ecovisa.it";

export const dynamic = "force-static";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const statiche: MetadataRoute.Sitemap = [
    { url: `${BASE}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${BASE}/prodotti/`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${BASE}/spesa-km0/`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${BASE}/servizi-extra/`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE}/calcola/`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE}/biofido/`, changeFrequency: "weekly", priority: 0.6 },
    { url: `${BASE}/abbonamenti/`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE}/termini-vendita/`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE}/condizioni-venditori/`, changeFrequency: "yearly", priority: 0.3 },
  ];
  const prodotti: MetadataRoute.Sitemap = PRODUCTS.map((p) => ({
    url: `${BASE}/prodotti/${p.slug}/`,
    changeFrequency: "monthly",
    priority: 0.6,
  }));
  const zone: MetadataRoute.Sitemap = (await tutteLeZone()).map((z) => ({
    url: `${BASE}/spesa-km0/${z.slug}/`,
    changeFrequency: "weekly",
    priority: 0.8,
  }));
  const regioni: MetadataRoute.Sitemap = (await tutteLeRegioni()).map((r) => ({
    url: `${BASE}/spesa-km0/regione/${r.slug}/`,
    changeFrequency: "weekly",
    priority: 0.7,
  }));
  let aziende: MetadataRoute.Sitemap = [];
  try {
    aziende = (await tutteLeAziendePubbliche()).map((a) => ({
      url: `${BASE}/azienda/${a.slug}/`,
      changeFrequency: "weekly",
      priority: 0.7,
    }));
  } catch {
    aziende = [];
  }
  return [...statiche, ...prodotti, ...regioni, ...zone, ...aziende];
}
