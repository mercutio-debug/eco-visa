"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export type AziendaMarker = {
  id: string;
  nome: string;
  citta: string;
  lat: number;
  lon: number;
  conSemaforo: boolean;
};

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** Mappa Leaflet/OSM delle aziende iscritte. Segnaposto VERDE = ha già almeno
 *  un prodotto col semaforo; GRIGIO = iscritta ma ancora senza prodotti. */
export default function MappaAziendeMappa({ markers }: { markers: AziendaMarker[] }) {
  const divRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (mapRef.current || !divRef.current) return;
    const map = L.map(divRef.current, { scrollWheelZoom: false }).setView([42.5, 12.5], 5);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || markers.length === 0) return;
    const layer = L.layerGroup().addTo(map);
    for (const m of markers) {
      const colore = m.conSemaforo ? "#5baf38" : "#9aa0a6";
      const icon = L.divIcon({
        className: "",
        html: `<div style="width:16px;height:16px;border-radius:50%;background:${colore};border:3px solid #fff;box-shadow:0 0 0 2px rgba(0,0,0,.15)"></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });
      // gli esempi (id "esempio-…") non hanno una scheda reale: rimandano
      // all'elenco generico; le aziende iscritte aprono la LORO pagina.
      const isEsempio = m.id.startsWith("esempio-");
      const href = isEsempio ? `${BASE}/prodotti/` : `${BASE}/azienda/?id=${m.id}`;
      L.marker([m.lat, m.lon], { icon })
        .addTo(layer)
        .bindPopup(
          `<strong>${m.nome}</strong><br/>${m.citta}<br/>${
            m.conSemaforo
              ? '<span style="color:#3a7d12;font-weight:700">🚦 ha prodotti col semaforo</span>'
              : '<span style="color:#888">iscritta — ancora senza prodotti</span>'
          }<br/><a href="${href}" style="color:#3a7d12;font-weight:700">${
            isEsempio ? "Vedi i prodotti →" : "Apri la scheda dell'azienda →"
          }</a>`,
        );
    }
    const bounds = L.latLngBounds(markers.map((m) => [m.lat, m.lon] as [number, number]));
    map.fitBounds(bounds.pad(0.2), { maxZoom: 12 });
    return () => {
      layer.remove();
    };
  }, [markers]);

  return <div ref={divRef} className="h-[420px] w-full rounded-2xl" />;
}
