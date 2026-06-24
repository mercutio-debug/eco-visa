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
  plan?: string;
};

/**
 * Segnaposto ECO-VISA: CERCHIO (look diverso dalla goccia di BioFido), colore
 * verde/grigio per la presenza di prodotti col semaforo. Il PIANO aggiunge la
 * gerarchia: Free piccolo, Silver anello argento, Gold più grande con anello
 * dorato + ★.
 */
function markerAziendaHtml(m: AziendaMarker): string {
  const colore = m.conSemaforo ? "#5baf38" : "#9aa0a6";
  const plan = m.plan ?? "free";
  const size = plan === "gold" ? 24 : plan === "silver" ? 19 : 15;
  let ring = "box-shadow:0 0 0 2px rgba(0,0,0,.15);";
  let star = "";
  if (plan === "gold") {
    ring = "box-shadow:0 0 0 3px #f7d417,0 0 10px rgba(247,212,23,.6);";
    star =
      `<span style="position:absolute;top:-7px;right:-7px;width:16px;height:16px;border-radius:50%;` +
      `background:#f7d417;color:#7a1f00;font-size:10px;font-weight:900;display:flex;align-items:center;` +
      `justify-content:center;border:2px solid #fff">★</span>`;
  } else if (plan === "silver") {
    ring = "box-shadow:0 0 0 2px #c9d3da,0 1px 4px rgba(0,0,0,.25);";
  }
  return (
    `<div style="position:relative;width:${size}px;height:${size}px">` +
    star +
    `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${colore};border:3px solid #fff;${ring}"></div>` +
    `</div>`
  );
}

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
      const size = m.plan === "gold" ? 24 : m.plan === "silver" ? 19 : 15;
      const icon = L.divIcon({
        className: "",
        html: markerAziendaHtml(m),
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
      });
      // gli esempi (id "esempio-…") non hanno una scheda reale: rimandano
      // all'elenco generico; le aziende iscritte aprono la LORO pagina.
      const isEsempio = m.id.startsWith("esempio-");
      const href = isEsempio ? `${BASE}/prodotti/` : `${BASE}/azienda/?id=${m.id}`;
      const marker = L.marker([m.lat, m.lon], { icon }).addTo(layer);
      // nome al passaggio (desktop) + popup informativo
      marker.bindTooltip(`${m.nome} · ${m.citta}`);
      marker.bindPopup(
        `<strong>${m.nome}</strong><br/>${m.citta}<br/>${
          m.conSemaforo
            ? '<span style="color:#3a7d12;font-weight:700">🚦 ha prodotti col semaforo</span>'
            : '<span style="color:#888">iscritta — ancora senza prodotti</span>'
        }<br/><a href="${href}" style="color:#3a7d12;font-weight:700">${
          isEsempio ? "Vedi i prodotti →" : "Apri la scheda dell'azienda →"
        }</a>`,
      );
      // FIX mobile: il tap sul link dentro il popup spesso non naviga. Apro la
      // pagina dell'azienda direttamente al clic sul segnaposto (mobile + desktop),
      // così la scheda si apre SEMPRE con il suo URL.
      marker.on("click", () => {
        window.location.assign(href);
      });
    }
    const bounds = L.latLngBounds(markers.map((m) => [m.lat, m.lon] as [number, number]));
    map.fitBounds(bounds.pad(0.2), { maxZoom: 12 });
    return () => {
      layer.remove();
    };
  }, [markers]);

  return <div ref={divRef} className="h-[420px] w-full rounded-2xl" />;
}
