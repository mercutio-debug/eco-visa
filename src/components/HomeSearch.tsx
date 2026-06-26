"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { PRODUCTS } from "@/lib/data";
import { KM0_STORES } from "@/lib/data";
import { supabase } from "@/lib/supabase";
import { distanceKm } from "@/lib/footprint";
import { nearestPlace, geocode, prefetchGeocode } from "@/lib/geo";

// La mappa Leaflet usa `window`: si carica solo lato browser.
const Km0Map = dynamic(() => import("./Km0Map"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[320px] items-center justify-center rounded-2xl bg-white text-sm text-green-900/50">
      Carico la mappa…
    </div>
  ),
});

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const KM0_RADIUS = 70;

type Match = { label: string; sub: string; href: string };

export function HomeSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [matches, setMatches] = useState<Match[]>([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [showGeo, setShowGeo] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ricerca prodotti (seed + database aziende)
  useEffect(() => {
    const query = q.trim().toLowerCase();
    if (query.length < 2) {
      setMatches([]);
      setOpen(false);
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setSearching(true);
      const seed: Match[] = PRODUCTS.filter((p) =>
        p.name.toLowerCase().includes(query)
      ).map((p) => ({
        label: p.name,
        sub: `${p.category} · ${p.company.name}`,
        href: `${BASE}/prodotti/${p.slug}/`,
      }));

      let db: Match[] = [];
      const { data } = await supabase
        .from("prodotti")
        .select("id, nome, categoria, stabilimento_citta")
        .ilike("nome", `%${query}%`)
        .limit(8);
      if (data) {
        db = data.map((p: { id: string; nome: string; categoria: string | null; stabilimento_citta: string }) => ({
          label: p.nome,
          sub: `${p.categoria || "Prodotto"} · ${p.stabilimento_citta}`,
          href: `${BASE}/embed/?id=${p.id}`,
        }));
      }
      // unisci evitando doppioni per etichetta
      const all: Match[] = [];
      const seen = new Set<string>();
      for (const m of [...seed, ...db]) {
        const k = m.label.toLowerCase();
        if (seen.has(k)) continue;
        seen.add(k);
        all.push(m);
      }
      setMatches(all);
      setSearching(false);
      setOpen(true);
    }, 300);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [q]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function submit() {
    if (q.trim().length < 2) return;
    if (matches.length > 0) {
      router.push(matches[0].href);
    } else {
      // nessun prodotto trovato → mostra i punti vendita vicini
      setShowGeo(true);
      setOpen(false);
    }
  }

  return (
    <div className="mt-7">
      <div ref={boxRef} className="relative">
        {/* cornice ricerca */}
        <div className="rounded-2xl border-2 border-[var(--lime-500)] bg-white p-2 shadow-sm focus-within:shadow-md">
          <div className="flex items-center gap-2">
            <input
              className="w-full bg-transparent px-3 py-3 text-lg text-green-900 outline-none placeholder:text-green-900/40"
              placeholder="Es. biscotti, olio, passata…"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setShowGeo(false);
              }}
              onFocus={() => matches.length > 0 && setOpen(true)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              aria-label="Cerca un prodotto"
            />
            <button
              type="button"
              onClick={submit}
              aria-label="Cerca"
              className="flex h-12 w-12 flex-none items-center justify-center rounded-xl bg-[var(--lime-500)] text-white transition hover:brightness-95"
            >
              {/* lente d'ingrandimento */}
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2.2" />
                <line x1="16.5" y1="16.5" x2="21" y2="21" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          {/* risultati */}
          {open && matches.length > 0 && (
            <ul className="absolute left-0 right-0 top-full z-30 mt-2 max-h-72 overflow-auto rounded-2xl border border-[#cfe3b4] bg-white py-1 shadow-lg">
              {matches.map((m, i) => (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => router.push(m.href)}
                    className="flex w-full flex-col items-start px-4 py-2 text-left hover:bg-leaf"
                  >
                    <span className="font-semibold text-green-800">{m.label}</span>
                    <span className="text-xs text-green-900/60">{m.sub}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <p className="mt-2 text-center text-sm font-semibold text-green-900/70">
          Cerca il prodotto e scopri quanto è ecologico
          {searching && <span className="ml-2 text-green-900/40">…</span>}
        </p>
      </div>

      {showGeo && <Km0Finder query={q} onClose={() => setShowGeo(false)} />}
    </div>
  );
}

/* Pannello geolocalizzato: prodotto non trovato → punti vendita vicini */
function Km0Finder({ query, onClose }: { query: string; onClose: () => void }) {
  const [city, setCity] = useState("");
  const [geoMsg, setGeoMsg] = useState<string | null>(null);
  const [, setVer] = useState(0);

  // risolve la città via OpenStreetMap (per qualsiasi località) e ricalcola
  useEffect(() => {
    if (!city) return;
    let cancel = false;
    (async () => {
      await prefetchGeocode(city);
      if (!cancel) setVer((v) => v + 1);
    })();
    return () => {
      cancel = true;
    };
  }, [city]);

  function useMyPosition() {
    if (!navigator.geolocation) {
      setGeoMsg("Geolocalizzazione non disponibile: scrivi la tua città.");
      return;
    }
    setGeoMsg("Individuo la tua posizione…");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const near = nearestPlace(pos.coords.latitude, pos.coords.longitude);
        setCity(near.name);
        setGeoMsg(null);
      },
      () => setGeoMsg("Posizione non concessa: scrivi la tua città."),
      { timeout: 8000 }
    );
  }

  const stores = city
    ? KM0_STORES.map((s) => {
        const g = geocode(s.city);
        return {
          ...s,
          dist: distanceKm(s.city, city),
          lat: g?.lat ?? null,
          lon: g?.lon ?? null,
        };
      })
        .filter((s) => s.dist !== null && (s.dist as number) <= KM0_RADIUS)
        .sort((a, b) => (a.dist as number) - (b.dist as number))
    : [];

  const center = city ? geocode(city) : null;
  const mapStores = stores
    .filter((s) => s.lat != null && s.lon != null)
    .map((s) => ({
      id: s.id,
      name: s.name,
      city: s.city,
      type: s.type,
      category: s.category,
      dist: s.dist as number,
      lat: s.lat as number,
      lon: s.lon as number,
    }));

  return (
    <div className="mt-4 rounded-2xl border border-[#e3eed7] bg-leaf/50 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-xl text-green-800">
            Nessun prodotto trovato per “{query}”
          </h3>
          <p className="mt-1 text-sm text-green-900/75">
            Dicci dove sei: ti mostriamo i punti vendita entro {KM0_RADIUS} km che
            offrono prodotti simili.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Chiudi"
          className="text-green-900/50 hover:text-green-900"
        >
          ✕
        </button>
      </div>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          className="field"
          placeholder="La tua città (es. Roma)"
          value={city}
          onChange={(e) => setCity(e.target.value)}
        />
        <button type="button" className="btn-ghost whitespace-nowrap" onClick={useMyPosition}>
          📍 Usa la mia posizione
        </button>
      </div>
      {geoMsg && <p className="mt-2 text-xs text-green-900/70">{geoMsg}</p>}

      {city && (
        <div className="mt-4">
          {center && mapStores.length > 0 && (
            <div className="mb-3">
              <Km0Map
                center={{ lat: center.lat, lon: center.lon }}
                centerLabel={city}
                radiusKm={KM0_RADIUS}
                stores={mapStores}
              />
            </div>
          )}
          {stores.length === 0 ? (
            <p className="text-sm text-green-900/70">
              Nessun punto vendita entro {KM0_RADIUS} km da {city}. Prova un&apos;altra città.
            </p>
          ) : (
            <ul className="space-y-2">
              {stores.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between rounded-xl border border-[#e3eed7] bg-white px-4 py-3"
                >
                  <div>
                    <div className="font-semibold text-green-800">{s.name}</div>
                    <div className="text-xs text-green-900/60">
                      {s.type} · {s.category} · {s.city}
                    </div>
                  </div>
                  <span className="font-display text-lg text-lime-500">{s.dist} km</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
