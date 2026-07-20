// Géocodage via Nominatim (OpenStreetMap, gratuit, sans clé) + distance haversine.
// Zone autorisée : Paris / Île-de-France (75,77,78,91,92,93,94,95) + Oise (60).

const UA = 'vtc-driver/0.1 (open-source MVP)';
export const ALLOWED_DEPTS = ['75', '77', '78', '91', '92', '93', '94', '95', '60'];

export type GeoResult = {
  lat: number;
  lng: number;
  label: string;
  dept?: string;
  ok: boolean;
};

export async function geocode(addr: string): Promise<GeoResult | null> {
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
    let dept: string | undefined;
    if (disp.includes('Oise')) dept = '60';
    else {
      const cp = disp.match(/\b(\d{5})\b/);
      if (cp && ALLOWED_DEPTS.includes(cp[1].slice(0, 2))) {
        dept = cp[1].slice(0, 2);
      }
    }
    return {
      lat: parseFloat(r.lat),
      lng: parseFloat(r.lon),
      label: disp,
      dept,
      ok: !!dept,
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
