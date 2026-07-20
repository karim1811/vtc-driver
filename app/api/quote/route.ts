import { NextRequest, NextResponse } from 'next/server';
import { geocode, haversine } from '@/lib/geo';
import { computePrice, estimateDuration } from '@/lib/pricing';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const { pickup, dropoff, pickupAt } = await req.json();
  if (!pickup || !dropoff)
    return NextResponse.json({ error: 'adresses requises' }, { status: 400 });

  const a = await geocode(pickup);
  const b = await geocode(dropoff);
  if (!a || !b) return NextResponse.json({ error: 'adresse introuvable' }, { status: 404 });

  const distanceKm = haversine(a, b);
  const pa = pickupAt ? new Date(pickupAt) : undefined;
  const price = computePrice(distanceKm, a.dept, pa);
  const durationMin = estimateDuration(distanceKm);

  return NextResponse.json({
    distanceKm: Math.round(distanceKm * 100) / 100,
    price,
    durationMin,
    pickupOk: a.ok,
    dropoffOk: b.ok,
    dept: a.dept,
    pickupLabel: a.label,
    dropoffLabel: b.label,
  });
}
