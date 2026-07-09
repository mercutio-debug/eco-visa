import { notFound } from "next/navigation";
import Link from "next/link";
import {
  PRODUCTS,
  getProduct,
  alternativesFor,
  KM0_STORES,
} from "@/lib/data";
import { computeFootprint } from "@/lib/footprint";
import { Semaforo, SemaforoIngrediente } from "@/components/Semaforo";
import { ProductTools, type AltDTO, type Km0DTO } from "@/components/ProductTools";

export function generateStaticParams() {
  return PRODUCTS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const p = getProduct(slug);
  return { title: p ? `${p.name} — ECO-VISA` : "Prodotto — ECO-VISA" };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = getProduct(slug);
  if (!product) notFound();

  const fp = computeFootprint(product.plant, product.ingredients);

  const alternatives: AltDTO[] = alternativesFor(slug).map(({ product: p, footprint }) => ({
    slug: p.slug,
    name: p.name,
    companyName: p.company.name,
    plant: p.plant,
    totalCo2Kg: footprint.totalCo2Kg,
    score: footprint.score,
    level: footprint.level,
  }));

  const km0: Km0DTO[] = KM0_STORES.filter((s) => s.category === product.category).map((s) => ({
    id: s.id,
    name: s.name,
    city: s.city,
    type: s.type,
  }));

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <Link href="/prodotti" className="text-sm font-bold text-green-700 hover:text-lime-500">
        ← Tutti i prodotti
      </Link>

      {/* intestazione */}
      <div className="mt-3 flex flex-col justify-between gap-6 md:flex-row md:items-start">
        <div>
          <div className="text-xs font-bold uppercase tracking-wide text-lime-500">
            {product.category}
          </div>
          <h1 className="title-pangea text-4xl text-green-700 md:text-5xl">
            {product.name}
          </h1>
        </div>
        <div className="card flex items-center gap-4 p-4">
          <Semaforo level={fp.level} score={fp.score} consigli={fp.consigli} />
          <div className="border-l border-[#e8f1dc] pl-4 text-right">
            <div className="font-display text-3xl text-green-800">
              {fp.totalCo2Kg.toLocaleString("it-IT")} kg
            </div>
            <div className="text-xs text-green-900/60">CO₂ di trasporto</div>
            <div className="mt-1 text-xs text-green-900/60">
              {fp.totalKm.toLocaleString("it-IT")} km percorsi
            </div>
          </div>
        </div>
      </div>

      {/* dati produttore */}
      <div className="mt-8 grid gap-5 md:grid-cols-3">
        <div className="card p-5">
          <h3 className="label mb-2">Produttore</h3>
          <p className="font-display text-xl text-green-800">{product.company.name}</p>
          <p className="text-sm text-green-900/70">P.IVA {product.company.vat}</p>
          <p className="text-sm text-green-900/70">Sede: {product.company.city}</p>
          {product.company.website && (
            <p className="text-sm text-green-700">{product.company.website}</p>
          )}
        </div>
        <div className="card p-5">
          <h3 className="label mb-2">Stabilimento di produzione</h3>
          <p className="font-display text-xl text-green-800">{product.plant}</p>
          <p className="text-sm text-green-900/70">
            È il punto da cui si misura la distanza di ogni materia prima.
          </p>
        </div>
        <div className="card p-5">
          <h3 className="label mb-2">Sintesi impronta</h3>
          <p className="text-sm text-green-900/80">
            {fp.ingredients.length} materie prime · {fp.totalKm.toLocaleString("it-IT")} km
            totali · {fp.totalCo2Kg.toLocaleString("it-IT")} kg di CO₂ stimati per il
            trasporto fino a {product.plant}.
          </p>
        </div>
      </div>

      {/* nota: il semaforo è un giudizio qualitativo, non una somma di CO₂ */}
      <div className="mt-6 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-lime-500/40 bg-leaf/40 p-3 text-sm text-green-900/80">
        <span>
          💡 Il semaforo <strong>non somma la CO₂</strong> degli ingredienti: dà un
          giudizio <strong>qualitativo della composizione</strong> — ogni materia prima
          ha il suo colore (qui sotto), e l&apos;insieme determina il risultato.
        </span>
        <Link href="/semaforo" className="font-bold text-green-700 underline">
          Come funziona il semaforo →
        </Link>
      </div>

      {/* tabella ingredienti */}
      <h2 className="title-pangea mt-8 text-3xl text-green-700">Ingredienti e origine</h2>
      <div className="card mt-4 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="eco-table">
            <thead>
              <tr>
                <th>Colore</th>
                <th>Materia prima</th>
                <th>Origine</th>
                <th>Trasporto</th>
                <th className="text-right">Km</th>
                <th className="text-right">CO₂</th>
              </tr>
            </thead>
            <tbody>
              {fp.ingredients.map((ing, i) => (
                <tr key={i}>
                  <td><SemaforoIngrediente tier={ing.tier} /></td>
                  <td className="font-semibold text-green-900">{ing.name}</td>
                  <td>
                    {ing.origin}
                    {!ing.resolved && (
                      <span className="ml-1 text-xs text-traffic-red">(non riconosciuta)</span>
                    )}
                  </td>
                  <td>
                    {ing.legs.map((l, j) => (
                      <span key={j} className="mr-1 inline-block">
                        {l.mode === "nave" ? "🚢" : "🚚"} {l.from}→{l.to}
                        {j < ing.legs.length - 1 ? " · " : ""}
                      </span>
                    ))}
                  </td>
                  <td className="text-right">{ing.totalKm.toLocaleString("it-IT")}</td>
                  <td className="text-right">
                    {(ing.co2g / 1000).toLocaleString("it-IT", {
                      maximumFractionDigits: 0,
                    })}{" "}
                    kg
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={4}>Totale impronta del trasporto</td>
                <td className="text-right">{fp.totalKm.toLocaleString("it-IT")} km</td>
                <td className="text-right">
                  {fp.totalCo2Kg.toLocaleString("it-IT")} kg
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* strumenti interattivi: alternative + km0 */}
      <ProductTools baseCo2Kg={fp.totalCo2Kg} alternatives={alternatives} km0={km0} />

      {/* rimando a biofido */}
      <div className="mt-8 rounded-2xl border border-[#e3eed7] bg-leaf p-6">
        <h3 className="font-display text-2xl text-green-800">Cerchi solo prodotti biologici?</h3>
        <p className="mt-1 text-green-900/80">
          Con <strong>BioFido</strong> trovi i produttori biologici intorno a te,
          per categoria merceologica e raggio scelto.
        </p>
        <Link href="/biofido" className="btn-lime mt-4">
          Apri BioFido
        </Link>
      </div>
    </div>
  );
}
