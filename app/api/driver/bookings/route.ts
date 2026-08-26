import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import * as store from '@/lib/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const s = await getSession();
  if (!s || s.role !== 'driver')
    return NextResponse.json({ error: 'non autorisé' }, { status: 401 });
  const bookings = (await store.listBookings())
    .sort((a, b) => new Date(a.pickupAt).getTime() - new Date(b.pickupAt).getTime());
  // Enrichit avec le téléphone du client (pour le contacter via Appel/WhatsApp).
  const enriched = await Promise.all(
    bookings.map(async (b) => {
      const u = await store.getUser(b.userId);
      return { ...b, clientPhone: u?.phone ?? null, clientName: u?.name ?? null };
    })
  );
  return NextResponse.json({ bookings: enriched });
}
