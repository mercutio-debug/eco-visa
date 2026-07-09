import Link from "next/link";
import { Semaforo, SemaforoIngrediente } from "@/components/Semaforo";
import { SOGLIE_TIER_KM, TRUCK_G_PER_KM, SHIP_G_PER_KM } from "@/lib/footprint";

export const metadata = {
  title: "Come funziona il semaforo — ECO-VISA",
  description:
    "Il criterio del semaforo della filiera ECO-VISA: ogni materia prima ha una tonalità in base a distanza e geografia; il semaforo grande è un punteggio pesato.",
};

export default function SemaforoPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="title-pangea text-4xl text-green-700 md:text-5xl">
        Come funziona il semaforo
      </h1>
      <p className="mt-3 text-sm text-green-900/60">Ultimo aggiornamento: giugno 2026</p>

      <p className="mt-6 text-lg text-green-900/85">
        Il semaforo misura l&apos;<strong>impronta del trasporto delle materie
        prime</strong>: quanto vengono da lontano. Non è una somma matematica (che
        penalizzerebbe i prodotti con tanti ingredienti), ma un{" "}
        <strong>punteggio pesato</strong>: ogni materia prima ha la sua tonalità, e
        il semaforo grande pesa l&apos;insieme — con un freno per le filiere più lunghe.
      </p>

      <p className="mt-4 rounded-xl bg-leaf/50 px-4 py-3 text-green-900/85">
        🚦 <strong>Cosa misura il semaforo:</strong> valuta <strong>solo la distanza
        delle materie prime</strong> (quanto è corta la filiera). Non è un giudizio
        ambientale complessivo del prodotto.
      </p>

      {/* Colore di ogni materia prima */}
      <section className="card mt-8 p-6">
        <h2 className="font-display text-2xl text-green-800">
          1. La tonalità di ogni materia prima
        </h2>
        <p className="mt-2 text-green-900/80">
          In base a <strong>distanza</strong> e <strong>geografia</strong> dello stabilimento,
          ogni ingrediente prende una delle 9 tonalità (3 verdi · 3 gialli · 3 rossi):
        </p>
        <ul className="mt-4 space-y-2 text-sm">
          <li className="flex items-center gap-3">
            <SemaforoIngrediente tier="super_green" />
            <span><strong>KM0</strong> — entro {SOGLIE_TIER_KM.super_green} km</span>
          </li>
          <li className="flex items-center gap-3">
            <SemaforoIngrediente tier="verde" />
            <span>Verde — entro {SOGLIE_TIER_KM.verde} km</span>
          </li>
          <li className="flex items-center gap-3">
            <SemaforoIngrediente tier="verde_chiaro" />
            <span>Verde chiaro — entro {SOGLIE_TIER_KM.verde_chiaro} km</span>
          </li>
          <li className="flex items-center gap-3">
            <SemaforoIngrediente tier="giallo_chiaro" />
            <span>Giallo chiaro — {SOGLIE_TIER_KM.verde_chiaro}–{SOGLIE_TIER_KM.giallo_chiaro} km</span>
          </li>
          <li className="flex items-center gap-3">
            <SemaforoIngrediente tier="giallo" />
            <span>Giallo — {SOGLIE_TIER_KM.giallo_chiaro}–{SOGLIE_TIER_KM.giallo} km</span>
          </li>
          <li className="flex items-center gap-3">
            <SemaforoIngrediente tier="giallo_scuro" />
            <span>Giallo scuro — {SOGLIE_TIER_KM.giallo}–{SOGLIE_TIER_KM.giallo_scuro} km</span>
          </li>
          <li className="flex items-center gap-3">
            <SemaforoIngrediente tier="rosso_chiaro" />
            <span>Rosso chiaro — oltre {SOGLIE_TIER_KM.giallo_scuro} km, ma in <strong>Europa</strong></span>
          </li>
          <li className="flex items-center gap-3">
            <SemaforoIngrediente tier="rosso_scuro" />
            <span>Rosso scuro — <strong>fuori Europa</strong> (America o Africa)</span>
          </li>
          <li className="flex items-center gap-3">
            <SemaforoIngrediente tier="rosso_scurissimo" />
            <span>Rosso scurissimo — materie prime da <strong>Asia o Oceania</strong></span>
          </li>
        </ul>
      </section>

      {/* Il giudizio complessivo */}
      <section className="card mt-6 p-6">
        <h2 className="font-display text-2xl text-green-800">
          2. Il punteggio del semaforo grande
        </h2>
        <p className="mt-2 text-green-900/80">
          Ogni materia prima vale un <strong>punteggio qualità</strong> (più è vicina,
          più è alto). Il prodotto è la <strong>media pesata</strong> dei punteggi — così
          tanti ingredienti vicini contano davvero, e un singolo ingrediente esotico non
          rovina tutto.
        </p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-green-900/85">
          <li>Un prodotto resta <strong>verde</strong> anche con qualche ingrediente giallo, purché non superino la metà.</li>
          <li>Il <strong>giallo scuro</strong> pesa più del giallo chiaro; il rosso pesa molto.</li>
          <li>
            <strong>Freno duro:</strong> anche un solo ingrediente <em>rosso scurissimo</em> (Asia o Oceania)
            impedisce il verde — il prodotto non supera mai il giallo scuro.
          </li>
          <li>Quando c&apos;è una materia prima lontana, mostriamo un <strong>consiglio</strong> con alternative più vicine.</li>
        </ul>
        <div className="mt-4 flex flex-wrap gap-6">
          <Semaforo level="super_green" score={100} />
          <Semaforo level="rosso_scurissimo" score={8} />
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
          <li>🚚 Camion (Europa e Nord Africa): {TRUCK_G_PER_KM} g CO₂ per km.</li>
          <li>🚢 Nave (resto del mondo): {SHIP_G_PER_KM} g CO₂ per km + camion dal porto allo stabilimento.</li>
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

      <p className="mt-8 border-t border-[#e3eed7] pt-4 text-xs text-green-900/55">
        I dati sono inseriti e dichiarati dalle aziende, uniche responsabili della loro
        veridicità e del loro aggiornamento. ECO-VISA e BioFido sono una vetrina che promuove
        la cultura della filiera corta: la verifica dei dati è a totale carico delle aziende
        iscritte.
      </p>
    </div>
  );
}
