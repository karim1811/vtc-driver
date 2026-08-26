import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import * as store from '@/lib/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Le chauffeur confirme sa présence au point de prise en charge : il ENCaisSE
// l'acompte (depositStatus -> 'collected') et la course passe en 'confirmed'.
// Le solde reste EN SUSPENS (balanceStatus='held') jusqu'à la cloture ('done').
export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s || s.role !== 'driver')
    return NextResponse.json({ error: 'non autorisé' }, { status: 401 });
  const { id } = await req.json();
  const b = await store.getBooking(Number(id));
  if (!b) return NextResponse.json({ error: 'course introuvable' }, { status: 404 });
  const updated = await store.updateBooking(b.id, {
    depositStatus: 'collected',
    paid: 1,
    status: 'confirmed',
  });
  return NextResponse.json({ ok: true, booking: updated });
}
