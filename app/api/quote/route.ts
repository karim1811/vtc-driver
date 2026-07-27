import { NextRequest, NextResponse } from 'next/server';
import { geocode, route, estimateDuration } from '@/lib/geo';
import { computePrice } from '@/lib/pricing';
import * as store from '@/lib/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const { pickup, dropoff, pickupAt } = await req.json();
  if (!pickup || !dropoff)
    return NextResponse.json({ error: 'adresses requises' }, { status: 400 });

  const a = await geocode(pickup);
  const b = await geocode(dropoff);
  if (!a || !b) return NextResponse.json({ error: 'adresse introuvable' }, { status: 404 });

  // Disponibilité chauffeur (open + plages)
  const pa = pickupAt ? new Date(pickupAt) : undefined;
  if (pa) {
    const avail = await store.isAvailableAt(pickupAt);
    if (!avail)
      return NextResponse.json(
        { error: 'le chauffeur n\'est pas disponible à cette heure' },
        { status: 409 }
      );
  }

  const r = await route(a, b);
  const distanceKm = r.distanceKm;
  const price = computePrice(distanceKm, a.dept, pa);
  const durationMin = estimateDuration(distanceKm, r.durationSec);

  return NextResponse.json({
    distanceKm,
    price,
    durationMin,
    routed: r.ok,
    geometry: r.geometry,
    pickupOk: a.ok,
    dropoffOk: b.ok,
    dept: a.dept,
    pickupLabel: a.label,
    dropoffLabel: b.label,
    pickupLat: a.lat,
    pickupLng: a.lng,
    dropoffLat: b.lat,
    dropoffLng: b.lng,
  });
}
