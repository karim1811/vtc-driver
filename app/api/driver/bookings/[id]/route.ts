import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import * as store from '@/lib/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const s = await getSession();
  if (!s || s.role !== 'driver')
    return NextResponse.json({ error: 'non autorisé' }, { status: 401 });
  const { id } = await params;
  const { status } = await req.json();
  const b = store.updateBooking(Number(id), { status });
  if (!b) return NextResponse.json({ error: 'introuvable' }, { status: 404 });
  return NextResponse.json({ ok: true, booking: b });
}
