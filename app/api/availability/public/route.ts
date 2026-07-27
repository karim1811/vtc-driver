import { NextResponse } from 'next/server';
import * as store from '@/lib/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET public : état de la dispo + plages (sans données privées).
export async function GET() {
  const av = await store.getAvailability();
  return NextResponse.json({ availability: av });
}
