"use client";

import { useCallback, useEffect, useState } from "react";
import { PlaceAutocomplete } from "@/components/PlaceAutocomplete";
import { prefetchGeocode, geocode } from "@/lib/geo";
import {
  BIO_CATEGORIES,
  loadMyBioScheda,
  saveMyBioScheda,
  type BioCategory,
  type BioScheda,
} from "@/lib/biofido-scheda";

const BOZZA = "ecovisa_biofido_scheda_bozza_v1";

/**
 * Scheda mappa BioFido compilabile DIRETTAMENTE su ECO-VISA (login unico).
 * Al salvataggio crea/aggiorna la riga in `biofido_businesses`: da quel momento
 * l'attività compare sulla mappa di BioFido. La posizione si ricava dalla città.
 */
export function SchedaBioFido({ ownerId }: { ownerId: string }) {
  const [existing, setExisting] = useState<BioScheda | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<BioCategory>("agricola");
  const [city, setCity] = useState("");
  const [coord, setCoord] = useState<{ lat: number; lon: number } | null>(null);
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [description, setDescription] = useState("");
  const [bioOk, setBioOk] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [salvato, setSalvato] = useState(false);

  const load = useCallback(async () => {
    const b = await loadMyBioScheda(ownerId);
    setExisting(b);
    if (b) {
      setName(b.name);
      setCategory(b.category);
      setCity(b.city);
      setCoord({ lat: b.lat, lon: b.lon });
      setAddress(b.address ?? "");
      setPhone(b.phone ?? "");
      setWebsite(b.website ?? "");
      setDescription(b.description ?? "");
      setBioOk(true); // già sulla mappa: la conferma bio è implicita
      setSalvato(true);
    } else {
      // nessuna scheda salvata: ripristina l'eventuale bozza locale (anti perdita-dati)
      try {
        const raw = window.localStorage.getItem(BOZZA);
        if (raw) {
          const d = JSON.parse(raw);
          if (d.name) setName(d.name);
          if (d.category) setCategory(d.category);
          if (d.city) setCity(d.city);
          if (d.coord) setCoord(d.coord);
          if (d.address) setAddress(d.address);
          if (d.phone) setPhone(d.phone);
          if (d.website) setWebsite(d.website);
          if (d.description) setDescription(d.description);
        }
      } catch {}
    }
    setLoading(false);
  }, [ownerId]);

  useEffect(() => {
    load();
  }, [load]);

  // Bozza locale finché la scheda non è salvata sul DB (dati mai persi al cambio scheda)
  useEffect(() => {
    if (loading || existing) return;
    try {
      window.localStorage.setItem(
        BOZZA,
        JSON.stringify({ name, category, city, coord, address, phone, website, description }),
      );
    } catch {}
  }, [loading, existing, name, category, city, coord, address, phone, website, description]);

  // Quando cambia la città provo a ricavare subito le coordinate dalla cache.
  useEffect(() => {
    if (!city) {
      setCoord(null);
      return;
    }
    const p = geocode(city);
    if (p) setCoord({ lat: p.lat, lon: p.lon });
  }, [city]);

  async function salva() {
    if (!name.trim()) {
      setMsg("Inserisci il nome dell'attività.");
      return;
    }
    if (!bioOk) {
      setMsg("Conferma di essere un'attività biologica per comparire su BioFido.");
      return;
    }
    setSaving(true);
    setMsg(null);
    // assicura le coordinate: se non in cache, le risolve su OpenStreetMap
    let c = coord;
    if (!c && city) {
      const p = await prefetchGeocode(city);
      if (p) c = { lat: p.lat, lon: p.lon };
    }
    if (!c) {
      setSaving(false);
      setMsg("Città non riconosciuta: scegli una località dai suggerimenti.");
      return;
    }
    const { error } = await saveMyBioScheda(
      ownerId,
      {
        name,
        category,
        plan: existing?.plan ?? "free",
        city,
        lat: c.lat,
        lon: c.lon,
        address,
        description,
        website,
        phone,
      },
      existing?.id,
    );
    setSaving(false);
    if (error) {
      setMsg("Errore nel salvataggio: " + error);
      return;
    }
    try {
      window.localStorage.removeItem(BOZZA);
    } catch {}
    setSalvato(true);
    setMsg("Scheda salvata ✓ — la tua attività è ora sulla mappa di BioFido.");
    load();
  }

  return (
    <div className="card mb-6 p-6">
      <h2 className="font-display text-2xl text-green-800">
        {existing ? "La tua scheda su BioFido" : "Crea la tua scheda BioFido"}
      </h2>
      <p className="mt-1 max-w-2xl text-sm text-green-900/70">
        Questi dati formano il tuo segnaposto sulla mappa. La <strong>posizione</strong>{" "}
        si ricava dalla città. Compila e salva: comparirai subito tra i produttori bio.
      </p>

      {loading ? (
        <p className="mt-4 text-sm text-green-900/60">Caricamento…</p>
      ) : (
        <>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="block md:col-span-2">
              <span className="label">Nome attività *</span>
              <input
                className="field mt-1"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setSalvato(false);
                }}
                placeholder="Es. Azienda Agricola Stalla Franco"
              />
            </label>
            <label className="block">
              <span className="label">Categoria *</span>
              <select
                className="field mt-1"
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value as BioCategory);
                  setSalvato(false);
                }}
              >
                {BIO_CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.emoji} {c.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="label">Città (sede) *</span>
              <div className="mt-1">
                <PlaceAutocomplete
                  value={city}
                  onChange={(v) => {
                    setCity(v);
                    setSalvato(false);
                  }}
                  placeholder="Es. Cuneo, Genova…"
                />
              </div>
              {city && !coord && (
                <span className="mt-1 block text-xs text-traffic-red">
                  Scegli la città dai suggerimenti per fissare la posizione.
                </span>
              )}
            </label>
            <label className="block">
              <span className="label">Indirizzo</span>
              <input
                className="field mt-1"
                value={address}
                onChange={(e) => {
                  setAddress(e.target.value);
                  setSalvato(false);
                }}
                placeholder="Via dei Campi 12"
              />
            </label>
            <label className="block">
              <span className="label">Telefono</span>
              <input
                className="field mt-1"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  setSalvato(false);
                }}
              />
            </label>
            <label className="block md:col-span-2">
              <span className="label">Sito web</span>
              <input
                className="field mt-1"
                value={website}
                onChange={(e) => {
                  setWebsite(e.target.value);
                  setSalvato(false);
                }}
                placeholder="www.esempio.it"
              />
            </label>
            <label className="block md:col-span-2">
              <span className="label">Descrizione</span>
              <textarea
                className="field mt-1"
                rows={2}
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  setSalvato(false);
                }}
                placeholder="Racconta la tua attività biologica…"
              />
            </label>
          </div>

          <label className="mt-4 flex items-start gap-2 text-sm font-semibold text-green-900/80">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 accent-[var(--lime-500)]"
              checked={bioOk}
              onChange={(e) => {
                setBioOk(e.target.checked);
                setSalvato(false);
              }}
            />
            Confermo che questa è un&apos;attività biologica (certificata o in conversione).
          </label>

          <div className="mt-4 flex items-center gap-3">
            <button className="btn-lime" onClick={salva} disabled={saving}>
              {saving ? "Salvo…" : salvato ? "Scheda salvata ✓" : "Salva e pubblica sulla mappa"}
            </button>
          </div>
          {msg && <p className="mt-2 text-sm font-semibold text-green-700">{msg}</p>}
        </>
      )}
    </div>
  );
}
