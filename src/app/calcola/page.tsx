"use client";

import { useMemo, useState } from "react";
import { computeFootprint, type IngredientInput } from "@/lib/footprint";
import { allPlaceNames } from "@/lib/geo";
import { useGeoResolve } from "@/lib/useGeoResolve";
import { Semaforo } from "@/components/Semaforo";
import { PlaceAutocomplete } from "@/components/PlaceAutocomplete";

type Row = IngredientInput & { id: number };

let _id = 100;
const newRow = (name = "", origin = ""): Row => ({ id: _id++, name, origin });

export default function CalcolaPage() {
  const [company, setCompany] = useState("Dolciaria Zia Pina S.r.l.");
  const [vat, setVat] = useState("IT0123456789");
  const [product, setProduct] = useState("Biscotti al farro di zia Pina");
  const [plant, setPlant] = useState("Cuneo");
  const [rows, setRows] = useState<Row[]>([
    newRow("Farina di farro", "Siena"),
    newRow("Zucchero di canna", "Brasile"),
    newRow("Burro", "Romania"),
    newRow("Olio extravergine d'oliva", "Bari"),
  ]);

  const places = useMemo(() => allPlaceNames(), []);
  // risolve via OpenStreetMap qualunque località digitata (stabilimento + origini)
  const { version, loading: geoLoading } = useGeoResolve([
    plant,
    ...rows.map((r) => r.origin),
  ]);
  const fp = useMemo(
    () => computeFootprint(plant, rows.map(({ name, origin }) => ({ name, origin }))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [plant, rows, version]
  );

  function update(id: number, patch: Partial<Row>) {
    setRows((r) => r.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="title-pangea text-5xl text-green-700">Calcola l'impronta</h1>
      <p className="mt-3 max-w-2xl text-green-900/80">
        Compila la scheda del prodotto. Indica lo stabilimento di produzione e,
        per ogni materia prima, la località d'origine: il calcolo della CO₂ di
        trasporto e il semaforo si aggiornano in tempo reale.
      </p>

      <datalist id="places">
        {places.map((p) => (
          <option key={p} value={p} />
        ))}
      </datalist>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        {/* FORM */}
        <div>
          <div className="card p-6">
            <h2 className="font-display text-2xl text-green-800">Scheda azienda &amp; prodotto</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="label">Azienda produttrice</span>
                <input className="field mt-1" value={company} onChange={(e) => setCompany(e.target.value)} />
              </label>
              <label className="block">
                <span className="label">P. IVA</span>
                <input className="field mt-1" value={vat} onChange={(e) => setVat(e.target.value)} />
              </label>
              <label className="block">
                <span className="label">Nome prodotto</span>
                <input className="field mt-1" value={product} onChange={(e) => setProduct(e.target.value)} />
              </label>
              <label className="block">
                <span className="label">Stabilimento di produzione</span>
                <div className="mt-1">
                  <PlaceAutocomplete value={plant} onChange={setPlant} placeholder="es. Cuneo" />
                </div>
              </label>
            </div>
            {!fp.resolvedPlant && (
              <p className="mt-2 text-sm text-traffic-red">
                Stabilimento non riconosciuto: scegli una località dall'elenco (es. Cuneo).
              </p>
            )}
          </div>

          <div className="card mt-5 p-6">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-2xl text-green-800">Materie prime</h2>
              <button type="button" className="btn-ghost text-sm" onClick={() => setRows((r) => [...r, newRow()])}>
                + Aggiungi ingrediente
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {rows.map((row) => {
                const res = fp.ingredients.find(
                  (i) => i.name === row.name && i.origin.toLowerCase() === row.origin.toLowerCase()
                );
                return (
                  <div key={row.id} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-center">
                    <input
                      className="field"
                      placeholder="Materia prima (es. Farina)"
                      value={row.name}
                      onChange={(e) => update(row.id, { name: e.target.value })}
                    />
                    <PlaceAutocomplete
                      value={row.origin}
                      onChange={(v) => update(row.id, { origin: v })}
                      placeholder="Origine (es. Siena)"
                    />
                    <div className="flex items-center gap-2">
                      <span className="min-w-20 text-right text-sm font-semibold text-green-800">
                        {res && res.resolved
                          ? `${(res.co2g / 1000).toLocaleString("it-IT", { maximumFractionDigits: 0 })} kg`
                          : row.origin
                          ? "—"
                          : ""}
                      </span>
                      <button
                        type="button"
                        aria-label="Rimuovi"
                        className="rounded-full px-2 text-traffic-red hover:bg-leaf"
                        onClick={() => setRows((r) => r.filter((x) => x.id !== row.id))}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* RISULTATO */}
        <div className="lg:sticky lg:top-24 lg:self-start">
          <div className="panel-dark rounded-2xl p-6">
            <div className="text-xs font-bold uppercase tracking-wide text-lime-300">
              Preventivo ecologico
            </div>
            <h3 className="font-display text-2xl">{product || "Prodotto"}</h3>
            <p className="text-sm text-[#e6f4d3]">
              {company} · stabilimento {plant}
            </p>
            {geoLoading && (
              <p className="mt-1 text-xs text-lime-200">
                🔎 Cerco le località su OpenStreetMap…
              </p>
            )}

            <div className="my-4 rounded-xl bg-white p-4">
              <Semaforo level={fp.level} score={fp.score} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-white/10 p-3">
                <div className="font-display text-3xl">
                  {fp.totalCo2Kg.toLocaleString("it-IT")}
                </div>
                <div className="text-xs text-[#e6f4d3]">kg CO₂ trasporto</div>
              </div>
              <div className="rounded-xl bg-white/10 p-3">
                <div className="font-display text-3xl">
                  {fp.totalKm.toLocaleString("it-IT")}
                </div>
                <div className="text-xs text-[#e6f4d3]">km percorsi</div>
              </div>
            </div>

            <p className="mt-4 text-xs text-[#dceec2]">
              Camion in Europa: 800 g CO₂/km · Nave fuori UE: 30 g CO₂/km + camion
              dal porto allo stabilimento.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
