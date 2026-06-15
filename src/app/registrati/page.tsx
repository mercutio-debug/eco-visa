import Link from "next/link";

export const metadata = {
  title: "Iscrivi la tua azienda — ECO-VISA",
  description:
    "Registra la tua azienda su ECO-VISA: carica i tuoi stabilimenti e i tuoi prodotti e mostra l'impronta ecologica delle materie prime.",
};

export default function RegistratiPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <div className="text-xs font-bold uppercase tracking-wide text-lime-500">
        Area aziende
      </div>
      <h1 className="title-pangea mt-2 text-4xl text-green-700 md:text-5xl">
        Iscrivi la tua azienda
      </h1>
      <p className="mt-4 text-lg text-green-900/80">
        Stiamo preparando l&apos;area riservata alle aziende. A breve potrai:
      </p>

      <ul className="mt-6 space-y-3">
        {[
          "Creare un account con username e password",
          "Compilare la scheda anagrafica della tua azienda e dei tuoi stabilimenti di produzione",
          "Inserire i tuoi prodotti con tutti gli ingredienti e la loro origine",
          "Vedere in automatico il calcolo della CO₂ di trasporto per ogni prodotto",
        ].map((t) => (
          <li key={t} className="flex items-start gap-3">
            <span className="mt-1 inline-block h-2.5 w-2.5 flex-none rounded-full bg-lime-500" />
            <span className="text-green-900/90">{t}</span>
          </li>
        ))}
      </ul>

      <div className="card mt-10 p-6">
        <h2 className="font-display text-2xl text-green-800">Registrazione in arrivo 🚧</h2>
        <p className="mt-2 text-green-900/80">
          La funzione di iscrizione è in fase di attivazione. Torna a breve: stiamo
          collegando il sistema di account e il salvataggio delle schede.
        </p>
        <Link href="/" className="btn-lime mt-5 inline-block">
          ← Torna alla home
        </Link>
      </div>
    </div>
  );
}
