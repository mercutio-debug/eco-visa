import Link from "next/link";
import Image from "next/image";
import { computeFootprint } from "@/lib/footprint";
import { getProduct } from "@/lib/data";
import { Semaforo } from "@/components/Semaforo";
import { HomeSearch } from "@/components/HomeSearch";
import { CalcolatoreImpronta } from "@/components/CalcolatoreImpronta";

const BIOFIDO_URL = "https://mercutio-debug.github.io/biofido/";
const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export default function Home() {
  const demo = getProduct("biscotti-al-farro-del-melograno")!;
  const fp = computeFootprint(demo.plant, demo.ingredients);

  return (
    <div>
      {/* HERO */}
      <section className="relative">
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

            {/* barra di ricerca prodotti */}
            <HomeSearch />

            <div className="mt-7 flex flex-col items-start gap-3">
              <Link href="/prodotti" className="btn-ghost">
                Esplora le schede prodotto
              </Link>
              <Link href="/calcola" className="btn-lime">
                Calcola l'impronta del tuo prodotto
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

      {/* SEMAFORO IN PRIMO PIANO — gratis, senza registrazione */}
      <section id="semaforo" className="mx-auto max-w-6xl px-4 pb-4 pt-2">
        <div className="rounded-3xl border-2 border-lime-500 bg-leaf/40 p-6 md:p-8">
          <div className="text-center">
            <span className="inline-block rounded-full bg-lime-500 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">
              Provalo subito — gratis, senza registrazione
            </span>
            <h2 className="title-pangea mt-3 text-4xl text-green-700 md:text-5xl">
              Che semaforo ha il tuo prodotto?
            </h2>
            <p className="mx-auto mt-2 max-w-2xl text-green-900/80">
              Inserisci lo stabilimento e le materie prime: scopri in tempo reale
              se l&apos;impronta del prodotto è verde, gialla o rossa.
            </p>
          </div>
          <div className="mt-7">
            <CalcolatoreImpronta />
          </div>
        </div>
      </section>

      {/* MANIFESTO — sintesi del testo motivazionale (vedi /abbonamenti) */}
      <section className="mx-auto max-w-6xl px-4 py-6">
        <div className="card relative overflow-hidden p-7 md:p-9">
          <span className="absolute inset-y-0 left-0 w-2 bg-lime-500" />
          <div className="grid items-center gap-5 md:grid-cols-[1fr_auto]">
            <div>
              <div className="text-xs font-bold uppercase tracking-wide text-lime-500">
                Per chi fa qualità
              </div>
              <p className="mt-2 text-xl font-semibold leading-snug text-green-900 md:text-2xl">
                Hai investito una vita per fornire qualità e prodotti di altissimo
                livello. In un mercato che ragiona solo sul prezzo più basso,
                ECO-VISA ti fa{" "}
                <span className="text-green-700">mostrare il tuo valore vero</span>:
                la qualità e la sostenibilità di ciò che produci. Qui non vince chi
                taglia i costi a discapito della qualità, della sicurezza e
                dell&apos;ambiente, ma{" "}
                <span className="text-green-700">
                  chi offre il miglior prodotto possibile
                </span>
                .
              </p>
            </div>
            <Link href="/abbonamenti" className="btn-lime whitespace-nowrap">
              Scopri gli abbonamenti
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
            <h3 className="font-display text-3xl text-green-800">
              Cerchi prodotti biologici intorno a te, scarica la nostra app BioFido!
            </h3>
            {/* cornice attorno all'icona BioFido */}
            <div className="mt-4 flex justify-center rounded-2xl border-2 border-[var(--lime-500)] bg-leaf/40 p-6">
              <Image
                src={`${BASE}/brand/biofido-solologo.png`}
                alt="BioFido"
                width={300}
                height={210}
                className="h-24 w-auto"
              />
            </div>
            <p className="mt-2 max-w-md text-green-900/80">
              Il segugio del biologico: trova i produttori, i negozi e le
              attività bio intorno a te (fino a 70 km) e fatti guidare fin lì.
              Aprila dal telefono e tocca <strong>“Aggiungi a schermata Home”</strong>:
              la usi come un&apos;app, gratis.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <a
                href={BIOFIDO_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-lime"
              >
                🐾 Apri e installa BioFido
              </a>
            </div>
            <p className="mt-3 text-xs text-green-900/55">
              Funziona su Android e iPhone dal browser. Presto anche sugli store.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
