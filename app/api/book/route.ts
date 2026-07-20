import { NextRequest, NextResponse } from 'next/server';
import { geocode, haversine } from '@/lib/geo';
import { computePrice, estimateDuration } from '@/lib/pricing';
import { getSession } from '@/lib/auth';
import * as store from '@/lib/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s || s.role !== 'client')
    return NextResponse.json({ error: 'non connecté' }, { status: 401 });

  const { pickup, dropoff, pickupAt, payment } = await req.json();
  if (!pickup || !dropoff || !pickupAt)
    return NextResponse.json({ error: 'champs manquants' }, { status: 400 });

  const a = await geocode(pickup);
  const b = await geocode(dropoff);
  if (!a || !b) return NextResponse.json({ error: 'adresse introuvable' }, { status: 404 });
  if (!a.ok)
    return NextResponse.json(
      { error: 'départ hors zone (Paris IDF / Oise 60)' },
      { status: 403 }
    );

  const distanceKm = haversine(a, b);
  const price = computePrice(distanceKm, a.dept, new Date(pickupAt));
  const durationMin = estimateDuration(distanceKm);

  // Blocage chevauchement : 1 seul chauffeur
  const start = new Date(pickupAt).getTime();
  const end = start + durationMin * 60000;
  const conflicts = store.listBookings().filter(
    (x) => x.status === 'pending' || x.status === 'confirmed'
  ).filter((x) => {
    const s2 = new Date(x.pickupAt).getTime();
    const e2 = s2 + x.durationMin * 60000;
    return start < e2 && s2 < end;
  });
  if (conflicts.length)
    return NextResponse.json(
      { error: 'créneau indisponible (course en cours sur cette plage)' },
      { status: 409 }
    );

  const booking = store.createBooking({
    userId: Number(s.sub),
    pickup,
    dropoff,
    pickupLat: a.lat,
    pickupLng: a.lng,
    dropoffLat: b.lat,
    dropoffLng: b.lng,
    distanceKm: Math.round(distanceKm * 100) / 100,
    price,
    pickupAt,
    durationMin,
    payment: payment === 'online' ? 'online' : 'arrival',
  });

  return NextResponse.json({ ok: true, booking });
}
