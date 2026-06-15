"use client";

import { useEffect, useRef, useState } from "react";
import { searchPlaces, rememberPlace, type PlaceSuggestion } from "@/lib/geo";

/**
 * Input con autocomplete di località tramite OpenStreetMap (Nominatim).
 * Mostra un menù a tendina di suggerimenti; selezionandone uno la località
 * viene fissata in modo univoco (niente ambiguità sui nomi).
 */
export function PlaceAutocomplete({
  value,
  onChange,
  placeholder,
  className = "field",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const [sugg, setSugg] = useState<PlaceSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(-1);
  const boxRef = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNext = useRef(false); // evita la ricerca subito dopo una selezione
  const typed = useRef(false); // cerca solo dopo che l'utente ha digitato

  useEffect(() => {
    if (skipNext.current) {
      skipNext.current = false;
      return;
    }
    if (!typed.current) return; // non aprire suggerimenti per valori precompilati
    if (!value || value.trim().length < 3) {
      setSugg([]);
      setOpen(false);
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setLoading(true);
      const r = await searchPlaces(value);
      setLoading(false);
      setSugg(r);
      setActive(-1);
      setOpen(r.length > 0);
    }, 350);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [value]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function select(s: PlaceSuggestion) {
    rememberPlace(s.label, s.point);
    skipNext.current = true;
    onChange(s.label);
    setOpen(false);
    setSugg([]);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open || sugg.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, sugg.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter" && active >= 0) {
      e.preventDefault();
      select(sugg[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="relative" ref={boxRef}>
      <input
        className={className}
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        onChange={(e) => {
          typed.current = true;
          onChange(e.target.value);
        }}
        onFocus={() => sugg.length > 0 && setOpen(true)}
        onKeyDown={onKeyDown}
      />
      {loading && (
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-green-900/40">
          🔎
        </span>
      )}
      {open && sugg.length > 0 && (
        <ul className="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-[#cfe3b4] bg-white py-1 shadow-lg">
          {sugg.map((s, i) => (
            <li
              key={s.label}
              onMouseDown={(e) => {
                e.preventDefault();
                select(s);
              }}
              onMouseEnter={() => setActive(i)}
              className={`cursor-pointer px-3 py-2 text-sm ${
                i === active ? "bg-leaf text-green-900" : "text-green-900/90"
              }`}
            >
              📍 {s.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
