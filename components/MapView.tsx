"use client";

import { useEffect, useRef } from "react";

type Pt = { lat: number; lng: number } | null;

type Props = {
  pickup: Pt;
  dropoff: Pt;
  // Tracé routier réel (décodé OSRM) — si fourni, on dessine le chemin, pas la ligne droite.
  geometry?: [number, number][];
  height?: number;
  // Mode interactif : les pins deviennent déplaçables et un clic pose le point manquant.
  interactive?: boolean;
  onPickup?: (p: { lat: number; lng: number }) => void;
  onDropoff?: (p: { lat: number; lng: number }) => void;
};

// Type minimal de l'API Leaflet chargée via CDN (pas de dépendance npm).
type LMarker = { setLatLng(p: [number, number]): LMarker; on(ev: string, cb: () => void): LMarker; bindPopup(s: string): unknown };
type LMap = {
  remove(): void;
  setView(c: [number, number], z: number): LMap;
  on(ev: string, cb: (e: { latlng: { lat: number; lng: number } }) => void): LMap;
  addLayer(l: unknown): LMap;
  fitBounds(b: unknown, o?: { padding: [number, number] }): LMap;
};
type Leaflet = {
  map(el: HTMLElement): LMap;
  tileLayer(url: string, o: { attribution: string }): { addTo(m: LMap): unknown };
  marker(c: [number, number], o?: { draggable?: boolean }): LMarker & { addTo(m: LMap): LMarker & { bindPopup(s: string): unknown } };
  polyline(pts: [number, number][], o: { color: string }): { addTo(m: LMap): unknown };
  latLngBounds(pts: [number, number][]): unknown;
};

// Carte Leaflet (CDN, sans dépendance npm). OpenStreetMap = gratuit, sans clé.
export default function MapView({
  pickup,
  dropoff,
  geometry,
  height = 280,
  interactive = false,
  onPickup,
  onDropoff,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LMap | null>(null);
  const puRef = useRef<LMarker | null>(null);
  const doRef = useRef<LMarker | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    let cancelled = false;
    const w = window as unknown as { L?: Leaflet };
    const geom = geometry;

    async function init() {
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
        puRef.current = null;
        doRef.current = null;
      }
      const center = pickup || dropoff || { lat: 48.8566, lng: 2.3522 };
      const L = w.L;
      const map = L.map(ref.current).setView([center.lat, center.lng], 12);
      mapRef.current = map;
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap",
      }).addTo(map);

      const makeMarker = (p: Pt, title: string, cb?: (p: { lat: number; lng: number }) => void) => {
        if (!p) return null;
        const m = L.marker([p.lat, p.lng], { draggable: interactive })
          .addTo(map)
          .bindPopup(title) as LMarker;
        if (interactive && cb) {
          m.on("dragend", () => {
            const ll = (m as unknown as { getLatLng(): { lat: number; lng: number } }).getLatLng();
            cb({ lat: ll.lat, lng: ll.lng });
          });
        }
        return m;
      };
      puRef.current = makeMarker(pickup, "Départ", onPickup) as LMarker | null;
      doRef.current = makeMarker(dropoff, "Arrivée", onDropoff) as LMarker | null;

      // Mode interactif : clic sur la carte pour poser le point manquant.
      if (interactive) {
        map.on("click", (e) => {
          const ll = e.latlng;
          if (!pickup && onPickup) onPickup({ lat: ll.lat, lng: ll.lng });
          else if (pickup && !dropoff && onDropoff) onDropoff({ lat: ll.lat, lng: ll.lng });
        });
      }

      const trace: [number, number][] =
        geom && geom.length >= 2
          ? geom
          : [pickup, dropoff]
              .filter(Boolean)
              .map((p) => [p!.lat, p!.lng] as [number, number]);
      if (trace.length >= 2) {
        L.polyline(trace, { color: "#10b981" }).addTo(map);
        const bounds = L.latLngBounds(trace.map(([la, ln]) => [la, ln]) as [number, number][]);
        map.fitBounds(bounds, { padding: [28, 28] });
      }
    }

    init().catch(() => {});
    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        puRef.current = null;
        doRef.current = null;
      }
    };
  }, [pickup, dropoff, geometry, interactive]);

  if (!pickup && !dropoff && !interactive) return null;
  return <div ref={ref} style={{ height }} className="rounded-xl overflow-hidden border border-neutral-800" />;
}
