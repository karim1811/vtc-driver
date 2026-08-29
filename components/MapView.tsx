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

type LMarker = {
  setLatLng(p: [number, number]): LMarker;
  on(ev: string, cb: () => void): LMarker;
  bindPopup(s: string): unknown;
  setIcon(i: unknown): LMarker;
  getLatLng(): { lat: number; lng: number };
};
type LMap = {
  remove(): void;
  setView(c: [number, number], z: number): LMap;
  panTo(c: [number, number]): LMap;
  on(ev: string, cb: (e: { latlng: { lat: number; lng: number } }) => void): LMap;
  addLayer(l: unknown): LMap;
  fitBounds(b: unknown, o?: { padding: [number, number] }): LMap;
  invalidateSize(): LMap;
};
type Leaflet = {
  map(el: HTMLElement): LMap;
  tileLayer(url: string, o: { attribution: string; subdomains?: string }): { addTo(m: LMap): unknown };
  marker(c: [number, number], o?: { draggable?: boolean; icon?: unknown }): LMarker & { addTo(m: LMap): LMarker };
  divIcon(o: { className?: string; html: string; iconSize: [number, number]; iconAnchor?: [number, number] }): unknown;
  polyline(pts: [number, number][], o: { color: string; weight?: number; opacity?: number; dashArray?: string }): { addTo(m: LMap): unknown };
  latLngBounds(pts: [number, number][]): unknown;
};

// Garde : un point est valide uniquement si lat/lng sont des nombres finis
// et dans une plage géographique réaliste. Évite de planter Leaflet
// (f.intersects sur un point [undefined, undefined]) et de faire crasher
// toute la page (écran blanc « Reload to try again »).
function validPt(p?: Pt): p is { lat: number; lng: number } {
  return (
    !!p &&
    typeof p.lat === "number" &&
    typeof p.lng === "number" &&
    Number.isFinite(p.lat) &&
    Number.isFinite(p.lng) &&
    Math.abs(p.lat) <= 90 &&
    Math.abs(p.lng) <= 180
  );
}
function validTrace(pts?: [number, number][]): [number, number][] {
  return (pts || []).filter(
    (p) =>
      Array.isArray(p) &&
      p.length === 2 &&
      Number.isFinite(p[0]) &&
      Number.isFinite(p[1]) &&
      Math.abs(p[0]) <= 90 &&
      Math.abs(p[1]) <= 180
  );
}

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
  const lineRef = useRef<unknown>(null);
  const stateRef = useRef({ pickup, dropoff, onPickup, onDropoff });
  stateRef.current = { pickup, dropoff, onPickup, onDropoff };

  // INIT UNIQUE de la carte (pas de recréation à chaque changement de props).
  useEffect(() => {
    if (!ref.current) return;
    let cancelled = false;
    const w = window as unknown as { L?: Leaflet };

    async function init() {
      try {
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
        const L = w.L;
        const pu = validPt(pickup) ? pickup : null;
        const do_ = validPt(dropoff) ? dropoff : null;
        const center = pu || do_ || { lat: 48.8566, lng: 2.3522 };
        const map = L.map(ref.current).setView([center.lat, center.lng], 13) as LMap;
        mapRef.current = map;
        L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
          attribution: "© OpenStreetMap · © CARTO",
          subdomains: "abcd",
        }).addTo(map);
        map.invalidateSize();

        const carIcon = (bg: string, glyph: string) =>
          L.divIcon({
            className: "vtc-pin",
            html: `<div style="width:30px;height:30px;border-radius:50%;background:${bg};display:flex;align-items:center;justify-content:center;font-size:16px;box-shadow:0 0 0 4px ${bg}33,0 2px 8px rgba(0,0,0,.6);border:2px solid #0003">${glyph}</div>`,
            iconSize: [30, 30],
            iconAnchor: [15, 15],
          });
        const pickupIcon = carIcon("#10b981", "●");
        const dropoffIcon = carIcon("#ef4444", "■");
        const driverIcon = carIcon("#f59e0b", "🚗");

        const makeMarker = (
          p: { lat: number; lng: number } | null,
          icon: unknown,
          title: string,
          cb?: (p: { lat: number; lng: number }) => void
        ) => {
          if (!p) return null;
          const m = L.marker([p.lat, p.lng], { draggable: interactive, icon })
            .addTo(map)
            .bindPopup(title) as LMarker;
          if (interactive && cb) {
            m.on("dragend", () => {
              const ll = m.getLatLng();
              cb({ lat: ll.lat, lng: ll.lng });
            });
          }
          return m;
        };

        puRef.current = makeMarker(pu, pickupIcon, "Départ", (pt) => stateRef.current.onPickup?.(pt)) as LMarker | null;
        doRef.current = makeMarker(do_, dropoffIcon, "Arrivée", (pt) => stateRef.current.onDropoff?.(pt)) as LMarker | null;
        drRef.current = makeMarker(validPt(driver) ? driver : null, driverIcon, "Chauffeur") as LMarker | null;

        if (interactive) {
          map.on("click", (e) => {
            const { pickup: pp, dropoff: dp, onPickup: op, onDropoff: od } = stateRef.current;
            const ll = e.latlng;
            if (!validPt(pp) && op) op({ lat: ll.lat, lng: ll.lng });
            else if (!validPt(dp) && od) od({ lat: ll.lat, lng: ll.lng });
          });
        }
        (window as any).__vtcFit = () => {
          const pts: [number, number][] = [];
          const p = stateRef.current.pickup;
          const d = stateRef.current.dropoff;
          if (validPt(p)) pts.push([p.lat, p.lng]);
          if (validPt(d)) pts.push([d.lat, d.lng]);
          const g = validTrace(geometry);
          if (g.length >= 2) pts.push(...g);
          if (pts.length >= 2) map.fitBounds(L.latLngBounds(pts), { padding: [28, 28] });
        };
      } catch {
        // Une carte défaillante ne doit jamais faire crasher la page.
      }
    }

    init().catch(() => {});
    return () => {
      cancelled = true;
      try {
        if (mapRef.current) {
          mapRef.current.remove();
          mapRef.current = null;
          puRef.current = doRef.current = drRef.current = null;
          lineRef.current = null;
        }
      } catch {
        /* noop */
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // MISE À JOUR des markers sans recréer la carte.
  useEffect(() => {
    const L = (window as unknown as { L?: Leaflet }).L;
    if (!L || !mapRef.current) return;
    try {
      const setOrMove = (
        refM: React.MutableRefObject<LMarker | null>,
        p: { lat: number; lng: number } | null,
        icon: unknown,
        title: string,
        cb?: (pt: { lat: number; lng: number }) => void
      ) => {
        if (!p) {
          if (refM.current) {
            (refM.current as any).remove?.();
            refM.current = null;
          }
          return;
        }
        if (!refM.current) {
          const m = L.marker([p.lat, p.lng], { draggable: interactive, icon }).addTo(mapRef.current!) as LMarker;
          m.bindPopup(title);
          if (interactive && cb)
            m.on("dragend", () => {
              const ll = m.getLatLng();
              cb({ lat: ll.lat, lng: ll.lng });
            });
          refM.current = m;
        } else {
          refM.current.setLatLng([p.lat, p.lng]);
        }
      };
      const carIcon = (bg: string, glyph: string) =>
        L.divIcon({
          className: "vtc-pin",
          html: `<div style="width:30px;height:30px;border-radius:50%;background:${bg};display:flex;align-items:center;justify-content:center;font-size:16px;box-shadow:0 0 0 4px ${bg}33,0 2px 8px rgba(0,0,0,.6);border:2px solid #0003">${glyph}</div>`,
          iconSize: [30, 30],
          iconAnchor: [15, 15],
        });

      setOrMove(puRef, validPt(pickup) ? pickup : null, carIcon("#10b981", "●"), "Départ", onPickup);
      setOrMove(doRef, validPt(dropoff) ? dropoff : null, carIcon("#ef4444", "■"), "Arrivée", onDropoff);

      // Trace — uniquement avec des points valides.
      const geomValid = validTrace(geometry);
      const trace: [number, number][] =
        geomValid.length >= 2
          ? geomValid
          : validTrace([validPt(pickup) ? pickup : null, validPt(dropoff) ? dropoff : null].filter(Boolean).map((p) => [p!.lat, p!.lng] as [number, number]));
      if (trace.length >= 2) {
        if (lineRef.current) (lineRef.current as any).remove?.();
        lineRef.current = L.polyline(trace, {
          color: "#10b981",
          weight: glow ? 5 : 4,
          opacity: 0.9,
          dashArray: glow ? "1 12" : undefined,
        }).addTo(mapRef.current);
        const bounds = L.latLngBounds(trace);
        mapRef.current.fitBounds(bounds, { padding: [28, 28] });
      }
    } catch {
      // Une carte défaillante ne doit jamais faire crasher la page.
    }
  }, [pickup, dropoff, geometry, interactive, onPickup, onDropoff]);

  // Mise à jour fluide du véhicule sans recréer la carte.
  useEffect(() => {
    const L = (window as unknown as { L?: Leaflet }).L;
    if (!L || !mapRef.current) return;
    try {
      if (validPt(driver)) {
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
    } catch {
      /* noop */
    }
  }, [driver]);

  if (!validPt(pickup) && !validPt(dropoff) && !validPt(driver) && !interactive) return null;
  return <div ref={ref} style={{ height }} className="rounded-xl overflow-hidden border border-neutral-800 relative z-0" />;
}
