import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import * as store from '@/lib/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const s = await getSession();
  if (!s || s.role !== 'driver')
    return NextResponse.json({ error: 'non autorisé' }, { status: 401 });
  const bookings = store
    .listBookings()
    .sort((a, b) => new Date(a.pickupAt).getTime() - new Date(b.pickupAt).getTime());
  return NextResponse.json({ bookings });
}
