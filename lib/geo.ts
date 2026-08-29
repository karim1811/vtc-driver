// Géocodage via Nominatim (OpenStreetMap, gratuit, sans clé).
// Aucune restriction de zone : l'app fonctionne partout en France (et au-delà).
// Le département est conservé pour le calcul tarifaire (Oise vs reste), pas pour bloquer.

const UA = 'vtc-driver/0.1 (open-source MVP)';

export type GeoResult = {
  lat: number;
  lng: number;
  label: string;
  dept?: string;
  ok: boolean;
};

// Accepte soit une adresse texte, soit "lat,lng" (pins posés à la main sur la carte).
export async function geocode(addr: string): Promise<GeoResult | null> {
  // Coordonnées directes "lat,lng" (proviennent des pins de la carte client).
  const m = addr.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
  if (m) {
    const lat = parseFloat(m[1]);
    const lng = parseFloat(m[2]);
    let label = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    let dept: string | undefined;
    try {
      const rev = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`,
        { headers: { 'User-Agent': UA, Accept: 'application/json' }, cache: 'no-store' }
      );
      if (rev.ok) {
        const j = await rev.json();
        if (j?.display_name) {
          label = j.display_name as string;
          if (label.includes('Oise')) dept = '60';
          else {
            const cp = label.match(/\b(\d{5})\b/);
            if (cp) dept = cp[1].slice(0, 2);
          }
        }
      }
    } catch { /* label brut si reverse indispo */ }
    return { lat, lng, label, dept, ok: true };
  }

  const url =
    'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=' +
    encodeURIComponent(addr);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;
    const r = data[0];
    const disp = (r.display_name || '') as string;
    // Département (pour tarif), sans bloquer sur une zone.
    let dept: string | undefined;
    if (disp.includes('Oise')) dept = '60';
    else {
      const cp = disp.match(/\b(\d{5})\b/);
      if (cp) dept = cp[1].slice(0, 2);
    }
    return {
      lat: parseFloat(r.lat),
      lng: parseFloat(r.lon),
      label: disp,
      dept,
      ok: true,
    };
  } catch {
    return null;
  }
}

export function haversine(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Routing réel en voiture via OSRM (public, gratuit, sans clé).
// Renvoie la distance (km), la durée (s) et la géométrie (tracé réel) le long de la route.
// Fallback sur haversine + vitesse moyenne si OSRM indisponible.
export type RouteResult = {
  distanceKm: number;
  durationSec: number;
  geometry: [number, number][]; // [lat, lng][] du tracé routier
  ok: boolean;
};

// Décodage de la polyline encodée OSRM (algo standard, per spec).
export function decodePolyline(str: string): [number, number][] {
  const coords: [number, number][] = [];
  if (!str) return coords;
  let index = 0, lat = 0, lng = 0;
  while (index < str.length) {
    let result = 1, shift = 0, b: number;
    do {
      b = str.charCodeAt(index++) - 63 - 1;
      result += b << shift;
      shift += 5;
    } while (b >= 0x1f);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    result = 1; shift = 0;
    do {
      b = str.charCodeAt(index++) - 63 - 1;
      result += b << shift;
      shift += 5;
    } while (b >= 0x1f);
    lng += result & 1 ? ~(result >> 1) : result >> 1;

    const la = lat / 1e5, ln = lng / 1e5;
    // On ignore les points aberrants (hors plage geo réelle) plutôt que de
    // planter la carte côté client.
    if (Number.isFinite(la) && Number.isFinite(ln) && Math.abs(la) <= 90 && Math.abs(ln) <= 180) {
      coords.push([la, ln]);
    }
  }
  return coords;
}

export async function route(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): Promise<RouteResult> {
  const url =
    `https://router.project-osrm.org/route/v1/driving/` +
    `${a.lng},${a.lat};${b.lng},${b.lat}?overview=full&geometries=polyline`;
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error('osrm ' + res.status);
    const data = await res.json();
    const r = data?.routes?.[0];
    if (!r) throw new Error('no route');
    const geometry: [number, number][] = r.geometry
      ? decodePolyline(r.geometry)
      : [];
    return {
      distanceKm: Math.round((r.distance / 1000) * 100) / 100,
      durationSec: Math.round(r.duration),
      geometry,
      ok: true,
    };
  } catch {
    // Fallback : volée droite * 1.3 (détour urbain) + 35 km/h.
    const d = haversine(a, b) * 1.3;
    return {
      distanceKm: Math.round(d * 100) / 100,
      durationSec: Math.round((d / 35) * 3600),
      geometry: [
        [a.lat, a.lng],
        [b.lat, b.lng],
      ],
      ok: false,
    };
  }
}

// ETA réaliste : durée OSRM + marge de prise en charge (bufferMin).
export function estimateDuration(distanceKm: number, durationSec?: number): number {
  const AVG = 35; // km/h, repli si pas de routing
  const BUFFER = 15; // min de prise en charge
  const baseMin = durationSec ? durationSec / 60 : (distanceKm / AVG) * 60;
  return Math.round(baseMin + BUFFER);
}

