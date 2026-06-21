import type { MetadataRoute } from "next";
import { PRODUCTS } from "@/lib/data";
import { tutteLeZone } from "@/lib/zone";

// Sitemap statica (output: export → genera /sitemap.xml al build). Dominio
// canonico di produzione (Hostinger a root): ecovisa.it.
const BASE = "https://ecovisa.it";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const statiche: MetadataRoute.Sitemap = [
    { url: `${BASE}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${BASE}/prodotti/`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${BASE}/spesa-km0/`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${BASE}/biofido/`, changeFrequency: "weekly", priority: 0.6 },
    { url: `${BASE}/abbonamenti/`, changeFrequency: "monthly", priority: 0.5 },
  ];
  const prodotti: MetadataRoute.Sitemap = PRODUCTS.map((p) => ({
    url: `${BASE}/prodotti/${p.slug}/`,
    changeFrequency: "monthly",
    priority: 0.6,
  }));
  const zone: MetadataRoute.Sitemap = tutteLeZone().map((z) => ({
    url: `${BASE}/spesa-km0/${z.slug}/`,
    changeFrequency: "weekly",
    priority: 0.8,
  }));
  return [...statiche, ...prodotti, ...zone];
}
