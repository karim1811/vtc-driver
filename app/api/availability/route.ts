import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import * as store from '@/lib/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET : lit la disponibilité (chauffeur uniquement)
export async function GET() {
  const s = await getSession();
  if (!s || s.role !== 'driver')
    return NextResponse.json({ error: 'non autorisé' }, { status: 401 });
  const av = await store.getAvailability();
  return NextResponse.json({ availability: av });
}

// POST : met à jour la disponibilité (open + plages hebdo)
// body: { open: boolean, weekly: [{ day, start, end }] }
export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s || s.role !== 'driver')
    return NextResponse.json({ error: 'non autorisé' }, { status: 401 });
  const { open, weekly } = await req.json();
  if (typeof open !== 'boolean')
    return NextResponse.json({ error: 'open requis' }, { status: 400 });
  const cleanWeekly = Array.isArray(weekly)
    ? weekly
        .filter((x: any) => x && typeof x.day === 'number' && x.start && x.end)
        .map((x: any) => ({ day: Number(x.day), start: String(x.start), end: String(x.end) }))
    : [];
  await store.setAvailability({ open: !!open, weekly: cleanWeekly });
  return NextResponse.json({ ok: true, availability: { open: !!open, weekly: cleanWeekly } });
}
