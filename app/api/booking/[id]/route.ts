import { NextRequest, NextResponse } from 'next/server';
import * as store from '@/lib/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Récupère une réservation pour l'écran de confirmation (public, minimal).
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const b = await store.getBooking(Number(id));
  if (!b) return NextResponse.json({ error: 'introuvable' }, { status: 404 });
  return NextResponse.json({
    id: b.id,
    pickup: b.pickup,
    dropoff: b.dropoff,
    pickupAt: b.pickupAt,
    price: b.price,
    status: b.status,
    payment: b.payment,
    paid: b.paid,
  });
}
