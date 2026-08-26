import { NextRequest, NextResponse } from 'next/server';
import { setSession } from '@/lib/auth';
import * as store from '@/lib/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const { password } = await req.json();
  const pw = process.env.DRIVER_PASSWORD || 'changeme';
  if (password !== pw)
    return NextResponse.json({ error: 'mot de passe incorrect' }, { status: 401 });
  // Le chauffeur est unique (solo) : on crée/charge son profil (id = 1) et on lie la session.
  const driver = await store.upsertDriver({ id: 1, name: 'Chauffeur' });
  await setSession({ sub: String(driver.id), role: 'driver', name: driver.name });
  return NextResponse.json({ ok: true, driver });
}
