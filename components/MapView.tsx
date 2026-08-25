"use client";

import { useEffect, useRef } from "react";

type Pt = { lat: number; lng: number } | null;

type Props = {
  pickup: Pt;
  dropoff: Pt;
  driver?: Pt; // position live du véhicule
  geometry?: [number, number][];
  height?: number;
  interactive?: boolean;
  onPickup?: (p: { lat: number; lng: number }) => void;
  onDropoff?: (p: { lat: number; lng: number }) => void;
  glow?: boolean; // tracé animé type Uber
};

type LMarker = { setLatLng(p: [number, number]): LMarker; on(ev: string, cb: () => void): LMarker; bindPopup(s: string): unknown; setIcon(i: unknown): LMarker };
type LMap = {
  remove(): void;
  setView(c: [number, number], z: number): LMap;
  panTo(c: [number, number]): LMap;
  on(ev: string, cb: (e: { latlng: { lat: number; lng: number } }) => void): LMap;
  addLayer(l: unknown): LMap;
  fitBounds(b: unknown, o?: { padding: [number, number] }): LMap;
};
type Leaflet = {
  map(el: HTMLElement): LMap;
  tileLayer(url: string, o: { attribution: string; subdomains?: string }): { addTo(m: LMap): unknown };
  marker(c: [number, number], o?: { draggable?: boolean; icon?: unknown }): LMarker & { addTo(m: LMap): LMarker };
  divIcon(o: { className?: string; html: string; iconSize: [number, number]; iconAnchor?: [number, number] }): unknown;
  polyline(pts: [number, number][], o: { color: string; weight?: number; opacity?: number; dashArray?: string }): { addTo(m: LMap): unknown };
  latLngBounds(pts: [number, number][]): unknown;
};

// Icônes personnalisées (pins style VTC) définies après chargement de Leaflet (cf. init).

export default function MapView({
  pickup,
  dropoff,
  driver,
  geometry,
  height = 280,
  interactive = false,
  onPickup,
  onDropoff,
  glow = true,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LMap | null>(null);
  const puRef = useRef<LMarker | null>(null);
  const doRef = useRef<LMarker | null>(null);
  const drRef = useRef<LMarker | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    let cancelled = false;
    const w = window as unknown as { L?: Leaflet };

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
        drRef.current = null;
      }
      const L = w.L;
      const driverPt: Pt = driver ?? null;
      const center = driverPt || pickup || dropoff || { lat: 48.8566, lng: 2.3522 };
      const map = L.map(ref.current).setView([center.lat, center.lng], 13);
      mapRef.current = map;
      // Fond sombre type Uber/Bolt (CartoDB dark, gratuit, sans clé).
      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        attribution: "© OpenStreetMap · © CARTO",
        subdomains: "abcd",
      }).addTo(map);

      const carIcon = (bg: string, glyph: string) =>
        L.divIcon({
          className: "vtc-pin",
          html: `<div style="width:30px;height:30px;border-radius:50%;background:${bg};display:flex;align-items:center;justify-content:center;font-size:16px;box-shadow:0 0 0 4px ${bg}33,0 2px 8px rgba(0,0,0,.6);border:2px solid #0003">${glyph}</div>`,
          iconSize: [30, 30],
          iconAnchor: [15, 15],
        });
      const pickupIcon = carIcon("#10b981", "●"); // client départ : vert
      const dropoffIcon = carIcon("#ef4444", "■"); // arrivée : rouge
      const driverIcon = carIcon("#f59e0b", "🚗"); // véhicule : orange

      const makeMarker = (p: Pt, icon: unknown, title: string, cb?: (p: { lat: number; lng: number }) => void) => {
        if (!p) return null;
        const m = L.marker([p.lat, p.lng], { draggable: interactive, icon })
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

      puRef.current = makeMarker(pickup, pickupIcon, "Départ", onPickup) as LMarker | null;
      doRef.current = makeMarker(dropoff, dropoffIcon, "Arrivée", onDropoff) as LMarker | null;
      drRef.current = makeMarker(driverPt, driverIcon, "Chauffeur") as LMarker | null;

      if (interactive) {
        map.on("click", (e) => {
          const ll = e.latlng;
          if (!pickup && onPickup) onPickup({ lat: ll.lat, lng: ll.lng });
          else if (pickup && !dropoff && onDropoff) onDropoff({ lat: ll.lat, lng: ll.lng });
        });
      }

      const trace: [number, number][] =
        geometry && geometry.length >= 2
          ? geometry
          : [pickup, dropoff].filter(Boolean).map((p) => [p!.lat, p!.lng] as [number, number]);
      if (trace.length >= 2) {
        L.polyline(trace, {
          color: "#10b981",
          weight: glow ? 5 : 4,
          opacity: 0.9,
          dashArray: glow ? "1 12" : undefined,
        }).addTo(map);
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
        drRef.current = null;
      }
    };
  }, [pickup, dropoff, driver, geometry, interactive]);

  // Mise à jour fluide du véhicule sans recréer la carte.
  useEffect(() => {
    const L = (window as unknown as { L?: Leaflet }).L;
    if (!L || !mapRef.current) return;
    if (driver) {
      if (!drRef.current) {
        const driverIcon = L.divIcon({
          className: "vtc-pin",
          html: `<div style="width:30px;height:30px;border-radius:50%;background:#f59e0b;display:flex;align-items:center;justify-content:center;font-size:16px;box-shadow:0 0 0 4px #f59e0b33,0 2px 8px rgba(0,0,0,.6);border:2px solid #0003">🚗</div>`,
          iconSize: [30, 30],
          iconAnchor: [15, 15],
        });
        drRef.current = L.marker([driver.lat, driver.lng], { icon: driverIcon }).addTo(mapRef.current) as LMarker;
      } else {
        drRef.current.setLatLng([driver.lat, driver.lng]);
      }
    }
  }, [driver]);

  if (!pickup && !dropoff && !driver && !interactive) return null;
  return <div ref={ref} style={{ height }} className="rounded-xl overflow-hidden border border-neutral-800" />;
}
