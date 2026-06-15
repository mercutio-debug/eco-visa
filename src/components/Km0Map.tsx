"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export type MapStore = {
  id: string;
  name: string;
  city: string;
  type: string;
  category: string;
  dist: number;
  lat: number;
  lon: number;
};

type Props = {
  center: { lat: number; lon: number };
  centerLabel: string;
  radiusKm: number;
  stores: MapStore[];
};

export default function Km0Map({ center, centerLabel, radiusKm, stores }: Props) {
  const divRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);

  // inizializza la mappa una sola volta
  useEffect(() => {
    if (mapRef.current || !divRef.current) return;
    const map = L.map(divRef.current, { scrollWheelZoom: false }).setView(
      [center.lat, center.lon],
      10
    );
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // aggiorna posizione utente, cerchio raggio e marcatori dei punti vendita
  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();

    const userIcon = L.divIcon({
      className: "",
      html: `<div style="width:18px;height:18px;border-radius:50%;background:#2f6f12;border:3px solid #fff;box-shadow:0 0 0 3px rgba(91,175,56,.5)"></div>`,
      iconSize: [18, 18],
      iconAnchor: [9, 9],
    });
    L.marker([center.lat, center.lon], { icon: userIcon })
      .bindPopup(`<b>${centerLabel}</b>`)
      .addTo(layer);

    L.circle([center.lat, center.lon], {
      radius: radiusKm * 1000,
      color: "#5baf38",
      weight: 1.5,
      fillColor: "#8cc63f",
      fillOpacity: 0.12,
    }).addTo(layer);

    for (const s of stores) {
      const icon = L.divIcon({
        className: "",
        html: `<div style="width:30px;height:30px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:#327413;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center"><span style="transform:rotate(45deg);font-size:14px">🛒</span></div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 30],
      });
      const dir = `https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lon}`;
      L.marker([s.lat, s.lon], { icon })
        .bindPopup(
          `<div style="font-family:system-ui,sans-serif;min-width:170px">
            <div style="font-weight:700;color:#2f6f12">${s.name}</div>
            <div style="font-size:12px;color:#5a6b50;margin-top:2px">${s.type} · ${s.category} · ${s.city} · ${s.dist} km</div>
            <a href="${dir}" target="_blank" rel="noopener" style="display:inline-block;margin-top:8px;background:#5baf38;color:#143306;font-weight:700;border-radius:999px;padding:5px 12px;font-size:12px;text-decoration:none">📍 Raggiungilo</a>
          </div>`
        )
        .addTo(layer);
    }

    const bounds = L.latLng(center.lat, center.lon).toBounds(radiusKm * 2000);
    map.fitBounds(bounds, { padding: [20, 20], maxZoom: 13 });
  }, [center.lat, center.lon, radiusKm, stores, centerLabel]);

  return <div ref={divRef} className="rounded-2xl" style={{ height: 320, width: "100%" }} />;
}
