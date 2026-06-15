import Link from "next/link";
import { computeFootprint } from "@/lib/footprint";
import { getProduct } from "@/lib/data";
import { Semaforo } from "@/components/Semaforo";
import { BioFidoBadge } from "@/components/Logo";

export default function Home() {
  const demo = getProduct("biscotti-al-farro-di-zia-pina")!;
  const fp = computeFootprint(demo.plant, demo.ingredients);

  return (
    <div>
      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 md:grid-cols-2 md:py-24">
          <div>
            <span className="inline-block rounded-full bg-leaf px-3 py-1 text-xs font-bold uppercase tracking-wide text-green-800">
              Impronta ecologica delle materie prime
            </span>
            <h1 className="title-pangea mt-4 text-5xl md:text-7xl">
              Quanto è<br />
              <span className="text-green-800">sostenibile</span><br />
              ciò che metti in tavola?
            </h1>
            <p className="mt-5 max-w-md text-lg text-green-900/80">
              ECO-VISA calcola i chilometri e la CO₂ del trasporto di ogni
              materia prima — dal luogo d'origine al tuo stabilimento — e assegna
              un semaforo ecologico ai tuoi prodotti. Più una materia prima
              arriva da lontano, peggiore è il punteggio.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/calcola" className="btn-lime">
                Calcola l'impronta del tuo prodotto
              </Link>
              <Link href="/prodotti" className="btn-ghost">
                Esplora le schede prodotto
              </Link>
            </div>
          </div>

          {/* card demo prodotto */}
          <div className="card p-6">
            <div className="text-xs font-bold uppercase tracking-wide text-lime-500">
              Esempio di scheda
            </div>
            <h3 className="font-display text-2xl text-green-800">{demo.name}</h3>
            <p className="text-sm text-green-900/70">
              Stabilimento: {demo.plant} · {demo.company.name}
            </p>
            <div className="my-4 h-px bg-[#e8f1dc]" />
            <div className="flex items-center justify-between gap-4">
              <Semaforo level={fp.level} score={fp.score} />
              <div className="text-right">
                <div className="font-display text-3xl text-green-800">
                  {fp.totalCo2Kg.toLocaleString("it-IT")} kg
                </div>
                <div className="text-xs text-green-900/60">CO₂ di trasporto</div>
              </div>
            </div>
            <Link
              href={`/prodotti/${demo.slug}`}
              className="mt-5 inline-flex text-sm font-bold text-green-700 hover:text-lime-500"
            >
              Vedi la scheda completa →
            </Link>
          </div>
        </div>
      </section>

      {/* COME FUNZIONA */}
      <section id="come-funziona" className="mx-auto max-w-6xl px-4 py-12">
        <h2 className="title-pangea text-4xl text-green-700">Come funziona</h2>
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {[
            {
              n: "1",
              t: "Scheda azienda e stabilimento",
              d: "Registri i dati dell'azienda e, soprattutto, lo stabilimento di produzione: è il punto di partenza di tutti i calcoli.",
            },
            {
              n: "2",
              t: "Ingredienti e origine",
              d: "Per ogni materia prima indichi la località di provenienza. Il geolocalizzatore calcola in automatico i chilometri fino allo stabilimento.",
            },
            {
              n: "3",
              t: "CO₂ e semaforo",
              d: "Camion in Europa (800 g/km) e nave fuori dall'Europa (30 g/km) + camion dal porto. Il totale diventa un semaforo verde/giallo/rosso.",
            },
          ].map((s) => (
            <div key={s.n} className="card p-6">
              <div className="font-display text-4xl text-lime-400">{s.n}</div>
              <h3 className="mt-2 font-display text-xl text-green-800">{s.t}</h3>
              <p className="mt-1 text-sm text-green-900/75">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* SERVIZI */}
      <section className="mx-auto max-w-6xl px-4 py-12">
        <div className="grid gap-5 md:grid-cols-2">
          <div className="panel-dark rounded-2xl p-8">
            <h3 className="font-display text-3xl">Trova alternative più ecologiche</h3>
            <p className="mt-2 max-w-md text-[#e9f6d8]">
              Per ogni prodotto, ECO-VISA suggerisce alternative simili con un
              punteggio migliore — e, in base alla tua posizione, ti mostra gli
              <strong> spacci aziendali e i negozi diretti entro 70 km </strong>
              (Spesa km0).
            </p>
            <Link href="/prodotti" className="btn-lime mt-5">
              Scopri come
            </Link>
          </div>
          <div className="rounded-2xl border border-[#e3eed7] bg-white p-8">
            <div className="flex items-center gap-3">
              <BioFidoBadge size={56} />
              <h3 className="font-display text-3xl">
                <span className="text-cape-red">Bio</span>
                <span className="text-green-700">fido</span>
              </h3>
            </div>
            <p className="mt-2 max-w-md text-green-900/80">
              Il segugio del biologico: una ricerca geolocalizzata dei soli
              produttori biologici intorno a te, con la loro categoria
              merceologica. Imposta il raggio e annusa il bio più vicino.
            </p>
            <Link href="/biofido" className="btn-ghost mt-5">
              Apri BioFido
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
