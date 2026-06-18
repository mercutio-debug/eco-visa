import Link from "next/link";
import { Semaforo, SemaforoIngrediente } from "@/components/Semaforo";
import { SOGLIE_TIER_KM, TRUCK_G_PER_KM, SHIP_G_PER_KM } from "@/lib/footprint";

export const metadata = {
  title: "Come funziona il semaforo — ECO-VISA",
  description:
    "Il criterio del semaforo ecologico ECO-VISA: ogni materia prima ha un colore in base alla distanza, il semaforo grande è un giudizio proporzionale.",
};

export default function SemaforoPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="title-pangea text-4xl text-green-700 md:text-5xl">
        Come funziona il semaforo
      </h1>
      <p className="mt-3 text-sm text-green-900/60">Ultimo aggiornamento: giugno 2026</p>

      <p className="mt-6 text-lg text-green-900/85">
        Il semaforo misura l&apos;<strong>impronta di trasporto delle materie
        prime</strong>: quanto vengono da lontano. Non è una somma matematica (che
        penalizzerebbe i prodotti con tanti ingredienti), ma un{" "}
        <strong>giudizio proporzionale</strong>: ogni materia prima ha il suo
        colore, e il semaforo grande riassume l&apos;insieme.
      </p>

      {/* Colore di ogni materia prima */}
      <section className="card mt-8 p-6">
        <h2 className="font-display text-2xl text-green-800">
          1. Il colore di ogni materia prima
        </h2>
        <p className="mt-2 text-green-900/80">
          In base alla distanza dallo stabilimento, ogni ingrediente prende un colore:
        </p>
        <ul className="mt-4 space-y-2 text-sm">
          <li className="flex items-center gap-3">
            <SemaforoIngrediente tier="km0" />
            <span><strong>Super Green · km0</strong> — entro {SOGLIE_TIER_KM.km0} km</span>
          </li>
          <li className="flex items-center gap-3">
            <SemaforoIngrediente tier="verde_intenso" />
            <span>Verde intenso — entro {SOGLIE_TIER_KM.verde_intenso} km</span>
          </li>
          <li className="flex items-center gap-3">
            <SemaforoIngrediente tier="verde_chiaro" />
            <span>Verde chiaro — entro {SOGLIE_TIER_KM.verde_chiaro} km</span>
          </li>
          <li className="flex items-center gap-3">
            <SemaforoIngrediente tier="verde_pallido" />
            <span>Verde pallido — entro {SOGLIE_TIER_KM.verde_pallido} km (copre l&apos;Italia)</span>
          </li>
          <li className="flex items-center gap-3">
            <SemaforoIngrediente tier="giallo" />
            <span>Giallo — da {SOGLIE_TIER_KM.verde_pallido} a {SOGLIE_TIER_KM.giallo} km</span>
          </li>
          <li className="flex items-center gap-3">
            <SemaforoIngrediente tier="rosso" />
            <span>Rosso — oltre {SOGLIE_TIER_KM.giallo} km</span>
          </li>
        </ul>
      </section>

      {/* Il giudizio complessivo */}
      <section className="card mt-6 p-6">
        <h2 className="font-display text-2xl text-green-800">
          2. Il giudizio del semaforo grande
        </h2>
        <p className="mt-2 text-green-900/80">
          Il semaforo grande non somma i chilometri: guarda le <strong>proporzioni</strong>
          dei colori delle materie prime.
        </p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-green-900/85">
          <li><strong>Super Green</strong>: tutte le materie prime verdi.</li>
          <li><strong>Verde</strong>: più della metà verdi (il resto giallo).</li>
          <li><strong>Verde chiaro</strong>: metà verdi e metà gialle.</li>
          <li><strong>Giallo</strong>: oltre metà gialle, oppure maggioranza verde ma con almeno una rossa.</li>
          <li><strong>Rosso</strong>: metà o più rosse.</li>
          <li><strong>Rosso intenso</strong>: tutte rosse (con l&apos;invito a usare materie prime locali).</li>
        </ul>
        <div className="mt-4 flex flex-wrap gap-6">
          <Semaforo level="verde_plus" score={100} />
          <Semaforo level="rosso_intenso" score={5} />
        </div>
      </section>

      {/* CO2 */}
      <section className="card mt-6 p-6">
        <h2 className="font-display text-2xl text-green-800">3. Le distanze e la CO₂</h2>
        <p className="mt-2 text-green-900/80">
          Le distanze sono calcolate geolocalizzando le località su OpenStreetMap.
          Mostriamo anche una stima della CO₂ con fattori in linea con i valori
          pubblicati (EU / ISPRA):
        </p>
        <ul className="mt-3 space-y-2 text-green-900/85">
          <li>🚚 Camion (Europa): {TRUCK_G_PER_KM} g CO₂ per km.</li>
          <li>🚢 Nave (fuori UE): {SHIP_G_PER_KM} g CO₂ per km + camion dal porto allo stabilimento.</li>
        </ul>
        <p className="mt-3 text-sm text-green-900/60">
          Il criterio è pubblico proprio per poter essere verificato da chiunque.
        </p>
      </section>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/calcola" className="btn-lime">
          Calcola l&apos;impronta del tuo prodotto
        </Link>
        <Link href="/registrati" className="btn-ghost">
          Pubblica i tuoi prodotti su ECO-VISA
        </Link>
      </div>
    </div>
  );
}
