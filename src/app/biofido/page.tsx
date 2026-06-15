"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { BIO_PRODUCERS } from "@/lib/data";
import { distanceKm } from "@/lib/footprint";
import { LocationInput } from "@/components/LocationInput";
import { Radar, type RadarPoint } from "@/components/Radar";
import { BioFidoBadge } from "@/components/Logo";

const CATEGORIES = ["Tutte", ...Array.from(new Set(BIO_PRODUCERS.map((b) => b.category)))];

export default function BioFidoPage() {
  const [loc, setLoc] = useState("Genova");
  const [radius, setRadius] = useState(60);
  const [cat, setCat] = useState("Tutte");
  const [submitted, setSubmitted] = useState(true);

  const results = useMemo(() => {
    if (!submitted || !loc) return [];
    return BIO_PRODUCERS.filter((b) => cat === "Tutte" || b.category === cat)
      .map((b) => ({ ...b, dist: distanceKm(b.city, loc) }))
      .filter((b) => b.dist !== null && b.dist <= radius)
      .sort((a, b) => a.dist! - b.dist!);
  }, [submitted, loc, radius, cat]);

  const radarPoints: RadarPoint[] = results.map((r, i) => ({
    id: r.id,
    name: r.name,
    category: r.category,
    distanceKm: r.dist!,
    angle: (i * 360) / Math.max(results.length, 1) + 18,
  }));

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      {/* HERO */}
      <div className="grid items-center gap-8 md:grid-cols-2">
        <div>
          <div className="flex items-center gap-3">
            <BioFidoBadge size={64} />
            <h1 className="font-display text-5xl md:text-6xl">
              <span className="text-cape-red">Bio</span>
              <span className="text-green-700">fido</span>
            </h1>
          </div>
          <p className="mt-4 max-w-md text-lg text-green-900/80">
            Il segugio del biologico. Annusa per te i produttori biologici
            intorno alla tua posizione e ti dice di che categoria merceologica
            sono. Imposta città, raggio e categoria.
          </p>
        </div>
        <div className="relative mx-auto w-full max-w-sm overflow-hidden rounded-3xl border-4 border-cape-red shadow-lg">
          <Image
            src="/brand/biofido.jpg"
            alt="BioFido — il cane supereroe del biologico"
            width={669}
            height={669}
            className="h-auto w-full"
            priority
          />
        </div>
      </div>

      {/* CONTROLLI */}
      <div className="card mt-8 grid gap-4 p-6 md:grid-cols-[1.4fr_1fr_auto] md:items-end">
        <div>
          <span className="label">Dove ti trovi</span>
          <div className="mt-1">
            <LocationInput value={loc} onChange={setLoc} />
          </div>
        </div>
        <label className="block">
          <span className="label">Categoria</span>
          <select className="field mt-1" value={cat} onChange={(e) => setCat(e.target.value)}>
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <span className="mt-3 block label">Raggio: {radius} km</span>
          <input
            type="range"
            min={10}
            max={300}
            step={10}
            value={radius}
            onChange={(e) => setRadius(Number(e.target.value))}
            className="mt-1 w-full accent-[var(--lime-500)]"
          />
        </label>
        <button type="button" className="btn-lime" onClick={() => setSubmitted(true)}>
          🐾 Cerca bio vicino a me
        </button>
      </div>

      {/* RISULTATI */}
      {submitted && (
        <div className="mt-8 grid gap-8 lg:grid-cols-2">
          <div className="card p-4">
            <Radar points={radarPoints} radiusKm={radius} centerLabel={loc} />
          </div>
          <div>
            <h2 className="font-display text-2xl text-green-800">
              {results.length} produttori biologici entro {radius} km
            </h2>
            {results.length === 0 ? (
              <p className="mt-2 text-green-900/70">
                Nessun produttore bio in quest'area. Prova ad ampliare il raggio o
                a cambiare città.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {results.map((r) => (
                  <li
                    key={r.id}
                    className="flex items-center justify-between rounded-xl border border-[#e3eed7] bg-white px-4 py-3"
                  >
                    <div>
                      <div className="font-semibold text-green-800">{r.name}</div>
                      <div className="text-xs text-green-900/60">
                        {r.category} · {r.city}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-leaf px-2 py-0.5 text-xs font-bold text-green-700">
                        BIO
                      </span>
                      <span className="font-display text-lg text-lime-500">{r.dist} km</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-4 text-xs text-green-900/60">
              Demo offline: in produzione BioFido si collega a servizi come Google
              Maps per i risultati in tempo reale.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
