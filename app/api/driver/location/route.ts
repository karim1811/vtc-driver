import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import * as store from '@/lib/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Le chauffeur partage sa position GPS (navigator.geolocation sur son téléphone).
// body: { bookingId: number, lat: number, lng: number }
export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s || s.role !== 'driver')
    return NextResponse.json({ error: 'non autorisé' }, { status: 401 });
  const { bookingId, lat, lng } = await req.json();
  if (!bookingId || typeof lat !== 'number' || typeof lng !== 'number')
    return NextResponse.json({ error: 'champs manquants' }, { status: 400 });
  const b = await store.updateDriverLocation(Number(bookingId), lat, lng);
  if (!b) return NextResponse.json({ error: 'course introuvable' }, { status: 404 });
  return NextResponse.json({ ok: true, sharedAt: b.sharedAt });
}
