"use client";

import { useEffect, useRef, useState } from "react";
import { prefetchGeocode } from "./geo";

/**
 * Risolve via OpenStreetMap (Nominatim) un elenco di nomi di località, con
 * debounce e cache. Restituisce un `version` che aumenta quando arrivano nuove
 * coordinate: includilo nelle dipendenze del calcolo CO₂ per farlo ricalcolare.
 */
export function useGeoResolve(names: string[]) {
  const [version, setVersion] = useState(0);
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // chiave stabile (ordinata, senza duplicati/vuoti) per evitare ricalcoli inutili
  const key = Array.from(
    new Set(names.map((n) => (n || "").trim().toLowerCase()).filter(Boolean))
  )
    .sort()
    .join("|");

  useEffect(() => {
    if (!key) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setLoading(true);
      const list = key.split("|");
      let resolvedAny = false;
      // sequenziale: rispetta il limite di richieste di Nominatim
      for (const n of list) {
        const r = await prefetchGeocode(n);
        if (r) resolvedAny = true;
      }
      setLoading(false);
      if (resolvedAny) setVersion((v) => v + 1);
    }, 600);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [key]);

  return { version, loading };
}
