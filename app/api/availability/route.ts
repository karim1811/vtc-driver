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

// POST : met à jour la disponibilité (open + slots)
// body: { open: boolean, slots: [{ id, date, start, end }] }
export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s || s.role !== 'driver')
    return NextResponse.json({ error: 'non autorisé' }, { status: 401 });
  const { open, slots } = await req.json();
  if (typeof open !== 'boolean')
    return NextResponse.json({ error: 'open requis' }, { status: 400 });
  const cleanSlots = Array.isArray(slots)
    ? slots
        .filter((x: any) => x && x.date && x.start && x.end)
        .map((x: any) => ({ id: String(x.id || Date.now() + Math.random()), date: x.date, start: x.start, end: x.end }))
    : [];
  await store.setAvailability({ open: !!open, slots: cleanSlots });
  return NextResponse.json({ ok: true, availability: { open: !!open, slots: cleanSlots } });
}
