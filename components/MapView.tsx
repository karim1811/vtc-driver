"use client";

import { useEffect, useRef } from "react";

type Props = {
  pickup: { lat: number; lng: number } | null;
  dropoff: { lat: number; lng: number } | null;
  // Tracé routier réel (décodé OSRM) — si fourni, on dessine le chemin, pas la ligne droite.
  geometry?: [number, number][];
  height?: number;
};

// Type minimal de l'API Leaflet chargée via CDN (pas de dépendance npm).
type LMap = {
  remove(): void;
  setView(c: [number, number], z: number): LMap;
  addTo(m: LMap): unknown;
  fitBounds(b: unknown, o?: { padding: [number, number] }): LMap;
};
type Leaflet = {
  map(el: HTMLElement): LMap;
  tileLayer(url: string, o: { attribution: string }): { addTo(m: LMap): unknown };
  marker(c: [number, number]): { addTo(m: LMap): { bindPopup(s: string): unknown } };
  polyline(pts: [number, number][], o: { color: string }): { addTo(m: LMap): unknown };
  latLngBounds(pts: [number, number][]): unknown;
};

// Carte Leaflet (CDN, sans dépendance npm). Affiche départ + arrivée + tracé.
export default function MapView({ pickup, dropoff, geometry, height = 240 }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LMap | null>(null);

  useEffect(() => {
    if (!ref.current || (!pickup && !dropoff)) return;
    let cancelled = false;
    const geom = geometry;

    async function init() {
      const w = window as unknown as { L?: Leaflet };
      if (!w.L) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        document.head.appendChild(link);
        await new Promise<void>((res, rej) => {
          const s = document.createElement("script");
          s.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
          s.onload = () => res();
          s.onerror = () => rej();
          document.body.appendChild(s);
        });
      }
      if (cancelled || !w.L || !ref.current) return;

      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      const center = pickup || dropoff!;
      const L = w.L;
      const map = L.map(ref.current).setView([center.lat, center.lng], 12);
      mapRef.current = map;
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap",
      }).addTo(map);

      const pts: [number, number][] = [];
      if (pickup) {
        L.marker([pickup.lat, pickup.lng]).addTo(map).bindPopup("Départ");
        pts.push([pickup.lat, pickup.lng]);
      }
      if (dropoff) {
        L.marker([dropoff.lat, dropoff.lng]).addTo(map).bindPopup("Arrivée");
        pts.push([dropoff.lat, dropoff.lng]);
      }
      // Tracé routier réel si fourni, sinon ligne droite départ→arrivée.
      const trace: [number, number][] =
        geom && geom.length >= 2 ? geom : pts;
      if (trace.length >= 2) {
        L.polyline(trace, { color: "#10b981" }).addTo(map);
        // Ajuste la vue pour englober tout l'itinéraire.
        const bounds = L.latLngBounds(trace.map(([la, ln]) => [la, ln]) as [number, number][]);
        map.fitBounds(bounds, { padding: [24, 24] });
      }
    }

    init().catch(() => {});
    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [pickup, dropoff, geometry]);

  if (!pickup && !dropoff) return null;
  return <div ref={ref} style={{ height }} className="rounded-xl overflow-hidden border border-neutral-800" />;
}
