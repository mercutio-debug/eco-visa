import { Semaforo } from "@/components/Semaforo";
import type { Giudizio } from "@/lib/footprint";

/**
 * Legenda del semaforo: una scheda d'esempio per ogni tonalità, con la
 * spiegazione di COSA determina quel colore. Riusata su ECO-VISA (pagina
 * prodotti) e sotto la mappa di BioFido (stesso criterio, è ciò che ci distingue).
 */
const VOCI: { level: Giudizio; titolo: string; criterio: string }[] = [
  {
    level: "super_green",
    titolo: "KM0",
    criterio:
      "Tutte le materie prime a km0 (entro 70 km dallo stabilimento). Es. un olio con olive dello stesso comune.",
  },
  {
    level: "verde",
    titolo: "Verde",
    criterio: "Materie prime vicine, entro 400 km. Filiera corta del territorio.",
  },
  {
    level: "verde_chiaro",
    titolo: "Verde chiaro",
    criterio:
      "Ingredienti entro i 1000 km. Per essere verde NON serve avere tutto verde: vanno bene anche dei gialli, purché non superino la metà.",
  },
  {
    level: "giallo_chiaro",
    titolo: "Giallo chiaro",
    criterio: "Materie prime tra i 1000 e i 1300 km.",
  },
  {
    level: "giallo",
    titolo: "Giallo",
    criterio: "Materie prime tra i 1300 e i 1600 km.",
  },
  {
    level: "giallo_scuro",
    titolo: "Giallo scuro",
    criterio: "Materie prime tra i 1600 e i 2000 km. Pesa più del giallo chiaro.",
  },
  {
    level: "rosso_chiaro",
    titolo: "Rosso chiaro",
    criterio: "Materie prime da oltre 2000 km, ma ancora in Europa.",
  },
  {
    level: "rosso_scuro",
    titolo: "Rosso scuro",
    criterio: "Materie prime da fuori Europa: America o Africa.",
  },
  {
    level: "rosso_scurissimo",
    titolo: "Rosso scurissimo",
    criterio:
      "Materie prime da Asia o Oceania: la filiera più lunga. Anche un solo ingrediente così impedisce il verde (al massimo giallo scuro).",
  },
];

export function LegendaSemaforo() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {VOCI.map((v) => (
        <div key={v.level} className="card flex flex-col gap-3 p-5">
          <div className="text-xs font-bold uppercase tracking-wide text-lime-500">
            Esempio semaforo {v.titolo}
          </div>
          <Semaforo level={v.level} />
          <p className="text-sm text-green-900/75">{v.criterio}</p>
        </div>
      ))}
    </div>
  );
}
