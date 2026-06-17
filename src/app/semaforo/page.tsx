import Link from "next/link";
import { Semaforo } from "@/components/Semaforo";
import {
  SOGLIA_VERDE_KM,
  SOGLIA_GIALLO_KM,
  TRUCK_G_PER_KM,
  SHIP_G_PER_KM,
} from "@/lib/footprint";

export const metadata = {
  title: "Come funziona il semaforo — ECO-VISA",
  description:
    "Il criterio oggettivo del semaforo ecologico ECO-VISA: distanza media di trasporto delle materie prime, fattori di CO₂ e soglie.",
};

export default function SemaforoPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="title-pangea text-4xl text-green-700 md:text-5xl">
        Come funziona il semaforo
      </h1>
      <p className="mt-4 text-lg text-green-900/85">
        Il semaforo di ECO-VISA misura l&apos;<strong>impronta di trasporto delle
        materie prime</strong>: quanti chilometri percorrono, in media, gli
        ingredienti dal luogo d&apos;origine allo stabilimento di produzione. Non è
        l&apos;intera impronta di carbonio del prodotto (non include produzione,
        confezionamento o distribuzione finale): è una misura trasparente e
        confrontabile della <strong>filiera a chilometro zero</strong>.
      </p>

      {/* Criterio */}
      <section className="card mt-8 p-6">
        <h2 className="font-display text-2xl text-green-800">Il criterio</h2>
        <p className="mt-2 text-green-900/80">
          Il colore dipende dalla <strong>distanza media</strong> percorsa dalle
          materie prime. È un criterio <strong>oggettivo</strong> perché non
          dipende dalla quantità né dal numero di ingredienti: conta solo quanto
          vengono da lontano.
        </p>

        <div className="mt-5 space-y-3">
          <div className="flex items-center gap-4 rounded-xl border border-[#e3eed7] bg-white p-4">
            <Semaforo level="verde" size="sm" />
            <div>
              <div className="font-semibold text-green-800">Verde — fino a {SOGLIA_VERDE_KM} km</div>
              <div className="text-sm text-green-900/70">
                Filiera corta, locale o regionale (entro 70 km = chilometro zero puro).
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4 rounded-xl border border-[#e3eed7] bg-white p-4">
            <Semaforo level="giallo" size="sm" />
            <div>
              <div className="font-semibold text-green-800">
                Giallo — da {SOGLIA_VERDE_KM} a {SOGLIA_GIALLO_KM} km
              </div>
              <div className="text-sm text-green-900/70">
                Scala nazionale o europea, trasporto su gomma.
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4 rounded-xl border border-[#e3eed7] bg-white p-4">
            <Semaforo level="rosso" size="sm" />
            <div>
              <div className="font-semibold text-green-800">
                Rosso — oltre {SOGLIA_GIALLO_KM} km, o materie prime da fuori UE
              </div>
              <div className="text-sm text-green-900/70">
                Filiera lunga o intercontinentale (via nave o aereo).
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Come calcoliamo la CO2 */}
      <section className="card mt-6 p-6">
        <h2 className="font-display text-2xl text-green-800">Come stimiamo la CO₂</h2>
        <p className="mt-2 text-green-900/80">
          Oltre al colore, mostriamo una stima della CO₂ di trasporto, con fattori
          di emissione in linea con i valori pubblicati (EU / ISPRA):
        </p>
        <ul className="mt-3 space-y-2 text-green-900/85">
          <li>🚚 <strong>Camion (Europa)</strong>: {TRUCK_G_PER_KM} g CO₂ per km.</li>
          <li>🚢 <strong>Nave (fuori UE)</strong>: {SHIP_G_PER_KM} g CO₂ per km della tratta marittima, più il camion dal porto allo stabilimento.</li>
          <li>📏 La distanza stradale è stimata con un fattore +30% rispetto alla linea d&apos;aria.</li>
        </ul>
        <p className="mt-3 text-sm text-green-900/60">
          Le distanze sono calcolate geolocalizzando le località su OpenStreetMap.
          Il criterio e le soglie sono pubblici proprio per poter essere verificati.
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
