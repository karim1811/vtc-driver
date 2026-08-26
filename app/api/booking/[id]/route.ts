import { NextRequest, NextResponse } from 'next/server';
import * as store from '@/lib/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Récupère une réservation pour l'écran de confirmation/suivi (public, minimal).
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const b = await store.getBooking(Number(id));
  if (!b) return NextResponse.json({ error: 'introuvable' }, { status: 404 });
  // Profil chauffeur (id = 1, unique) pour permettre au client de le contacter.
  const driver = await store.getDriver(1);
  return NextResponse.json({
    id: b.id,
    pickup: b.pickup,
    dropoff: b.dropoff,
    pickupAt: b.pickupAt,
    price: b.price,
    status: b.status,
    payment: b.payment,
    paid: b.paid,
    deposit: b.deposit,
    depositStatus: b.depositStatus,
    balanceStatus: b.balanceStatus,
    pickupLat: b.pickupLat,
    pickupLng: b.pickupLng,
    dropoffLat: b.dropoffLat,
    dropoffLng: b.dropoffLng,
    driverLat: b.driverLat ?? null,
    driverLng: b.driverLng ?? null,
    sharedAt: b.sharedAt ?? null,
    driverName: driver?.name ?? null,
    driverPhone: driver?.phone ?? null,
  });
}
