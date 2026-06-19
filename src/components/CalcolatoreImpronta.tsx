"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { computeFootprint, type IngredientInput } from "@/lib/footprint";
import { allPlaceNames } from "@/lib/geo";
import { useGeoResolve } from "@/lib/useGeoResolve";
import { Semaforo, SemaforoIngrediente } from "@/components/Semaforo";
import { AlberiCompensazione } from "@/components/AlberiCompensazione";
import { PlaceAutocomplete } from "@/components/PlaceAutocomplete";

/**
 * Calcolatore dell'impronta + semaforo, USABILE DA CHIUNQUE SENZA REGISTRAZIONE.
 * Riusato nella home (in primo piano) e nella pagina /calcola. Per PUBBLICARE il
 * prodotto e il suo semaforo su ECO-VISA serve invece registrarsi (CTA in fondo).
 */

type Row = IngredientInput & { id: number };
let _id = 100;
const newRow = (name = "", origin = ""): Row => ({ id: _id++, name, origin });

export function CalcolatoreImpronta({
  nascondiPubblica = false,
  vuoto = false,
  aziendaNome,
  onAggiungiProdotto,
}: {
  nascondiPubblica?: boolean;
  vuoto?: boolean;
  /** nome dell'azienda loggata: precompila "Azienda produttrice" nella dashboard */
  aziendaNome?: string;
  /** se presente, mostra il flag "Aggiungi ai miei prodotti" e salva il prodotto */
  onAggiungiProdotto?: (data: {
    nome: string;
    stabilimento: string;
    ingredienti: { nome: string; origine: string }[];
  }) => Promise<{ error?: string }>;
} = {}) {
  // Nella dashboard la cornice parte VUOTA (niente esempio Melograno); in home
  // resta l'esempio precompilato come dimostrazione. Il nome azienda, però, viene
  // precompilato con la propria azienda (modificabile/cancellabile).
  const [company, setCompany] = useState(vuoto ? aziendaNome ?? "" : "Dolciaria Il Melograno S.r.l.");
  const [product, setProduct] = useState(vuoto ? "" : "Biscotti al farro del Melograno");
  const [plant, setPlant] = useState(vuoto ? "" : "Cuneo");
  const [rows, setRows] = useState<Row[]>(
    vuoto
      ? [newRow(), newRow(), newRow()]
      : [
          newRow("Farina di farro", "Siena"),
          newRow("Zucchero di canna", "Brasile"),
          newRow("Burro", "Romania"),
          newRow("Olio extravergine d'oliva", "Bari"),
        ],
  );

  // Flag "Aggiungi ai miei prodotti" (solo in dashboard, quando c'è il handler)
  const [aggiungi, setAggiungi] = useState(false);
  const [salvandoProd, setSalvandoProd] = useState(false);
  const [prodMsg, setProdMsg] = useState<string | null>(null);
  const prodValido =
    product.trim() !== "" &&
    plant.trim() !== "" &&
    rows.some((r) => r.name.trim() && r.origin.trim());

  async function aggiungiAiProdotti() {
    if (!onAggiungiProdotto || !prodValido) return;
    setSalvandoProd(true);
    setProdMsg(null);
    const ingredienti = rows
      .filter((r) => r.name.trim() && r.origin.trim())
      .map((r) => ({ nome: r.name, origine: r.origin }));
    const { error } = await onAggiungiProdotto({ nome: product, stabilimento: plant, ingredienti });
    setSalvandoProd(false);
    if (error) {
      setProdMsg(error);
      return;
    }
    setProdMsg("Aggiunto ai tuoi prodotti ✓ — aggiungi foto e dettagli nella sezione «I tuoi prodotti».");
    setAggiungi(false);
    // svuoto per poterne aggiungere un altro (tengo il nome azienda)
    setProduct("");
    setPlant("");
    setRows([newRow(), newRow(), newRow()]);
  }

  // Se il nome azienda arriva dopo il primo render (caricamento dashboard), lo
  // precompilo UNA volta sola e solo se il campo è ancora vuoto — così l'utente
  // può comunque cancellarlo e scriverne un altro senza che ricompaia.
  const prefillato = useRef(false);
  useEffect(() => {
    if (vuoto && aziendaNome && !prefillato.current) {
      prefillato.current = true;
      setCompany((c) => (c ? c : aziendaNome));
    }
  }, [vuoto, aziendaNome]);

  const places = useMemo(() => allPlaceNames(), []);
  const { version, loading: geoLoading } = useGeoResolve([plant, ...rows.map((r) => r.origin)]);
  const fp = useMemo(
    () => computeFootprint(plant, rows.map(({ name, origin }) => ({ name, origin }))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [plant, rows, version],
  );

  // Righe effettivamente calcolate (stesso filtro di computeFootprint): servono
  // per allineare ogni riga al suo risultato PER INDICE. Non si può confrontare
  // per origine perché il calcolo restituisce il nome RISOLTO (es. "Brasile" →
  // "San Paolo", "Romania" → "Bucarest"): il confronto fallirebbe e la riga
  // mostrerebbe "—" pur avendo una distanza valida.
  const computedRows = useMemo(
    () => rows.filter((r) => r.name.trim() && r.origin.trim()),
    [rows],
  );

  function update(id: number, patch: Partial<Row>) {
    setRows((r) => r.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  }

  return (
    <div>
      <datalist id="places">
        {places.map((p) => (
          <option key={p} value={p} />
        ))}
      </datalist>

      <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        {/* FORM */}
        <div>
          <div className="card p-6">
            <h2 className="font-display text-2xl text-green-800">Prodotto e stabilimento</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="label">Azienda produttrice</span>
                <input className="field mt-1" value={company} onChange={(e) => setCompany(e.target.value)} />
              </label>
              <label className="block">
                <span className="label">Nome prodotto</span>
                <input className="field mt-1" value={product} onChange={(e) => setProduct(e.target.value)} />
              </label>
              <label className="block sm:col-span-2">
                <span className="label">Stabilimento di produzione</span>
                <div className="mt-1">
                  <PlaceAutocomplete value={plant} onChange={setPlant} placeholder="es. Cuneo" />
                </div>
              </label>
            </div>
            {plant.trim() && !fp.resolvedPlant && (
              <p className="mt-2 text-sm text-traffic-red">
                Stabilimento non riconosciuto: scegli una località dall&apos;elenco (es. Cuneo).
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
                const idx = computedRows.indexOf(row);
                const res = idx >= 0 ? fp.ingredients[idx] : undefined;
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
                      {res?.resolved && <SemaforoIngrediente tier={res.tier} />}
                      <span className="min-w-16 text-right text-xs font-semibold text-green-800">
                        {res?.resolved
                          ? `${res.totalKm.toLocaleString("it-IT")} km`
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
              Semaforo ecologico
            </div>
            <h3 className="font-display text-2xl">{product || "Prodotto"}</h3>
            <p className="text-sm text-[#e6f4d3]">
              {company} · stabilimento {plant}
            </p>
            {geoLoading && (
              <p className="mt-1 text-xs text-lime-200">🔎 Cerco le località su OpenStreetMap…</p>
            )}

            <div className="my-4 rounded-xl bg-white p-4">
              <Semaforo level={fp.level} score={fp.score} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-white/10 p-3">
                <div className="font-display text-3xl">{fp.totalCo2Kg.toLocaleString("it-IT")}</div>
                <div className="text-xs text-[#e6f4d3]">kg CO₂ trasporto</div>
              </div>
              <div className="rounded-xl bg-white/10 p-3">
                <div className="font-display text-3xl">{fp.totalKm.toLocaleString("it-IT")}</div>
                <div className="text-xs text-[#e6f4d3]">km percorsi</div>
              </div>
            </div>

            <AlberiCompensazione co2Kg={fp.totalCo2Kg} scuro />

            <p className="mt-4 text-xs text-[#dceec2]">
              Il colore dipende dalla distanza media delle materie prime: verde
              ≤ 200 km, giallo ≤ 700 km, rosso oltre o fuori UE.
            </p>
            <Link
              href="/semaforo"
              className="mt-1 inline-block text-xs font-semibold text-lime-300 hover:underline"
            >
              Come funziona il semaforo →
            </Link>

            {/* Verificare è gratis; pubblicare richiede registrazione */}
            {!nascondiPubblica && (
              <>
                <Link href="/registrati" className="btn-lime mt-5 inline-flex w-full justify-center">
                  Pubblica questo prodotto su ECO-VISA
                </Link>
                <p className="mt-2 text-center text-[11px] text-[#dceec2]">
                  Calcolare il semaforo è gratis e senza registrazione. Per pubblicare
                  prodotto e semaforo serve un account.
                </p>
              </>
            )}

            {/* Flag "Aggiungi ai miei prodotti" (nella dashboard personale) */}
            {onAggiungiProdotto && (
              <div className="mt-5 border-t border-white/15 pt-4">
                <label className="flex items-center gap-2 text-sm font-semibold text-[#eaf7d8]">
                  <input
                    type="checkbox"
                    className="h-5 w-5 accent-[var(--lime-500)]"
                    checked={aggiungi}
                    onChange={(e) => {
                      setAggiungi(e.target.checked);
                      setProdMsg(null);
                    }}
                  />
                  ➕ Aggiungi ai miei prodotti
                </label>
                {aggiungi && (
                  <>
                    <button
                      type="button"
                      className="btn-lime mt-3 inline-flex w-full justify-center"
                      disabled={salvandoProd || !prodValido}
                      onClick={aggiungiAiProdotti}
                    >
                      {salvandoProd ? "Salvo…" : "Salva nel mio catalogo"}
                    </button>
                    {!prodValido && (
                      <p className="mt-2 text-center text-[11px] text-[#dceec2]">
                        Compila nome prodotto, stabilimento e almeno una materia prima con origine.
                      </p>
                    )}
                  </>
                )}
                {prodMsg && (
                  <p className="mt-2 text-center text-xs font-semibold text-lime-200">{prodMsg}</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
