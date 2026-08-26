import { NextRequest, NextResponse } from 'next/server';
import { setSession } from '@/lib/auth';
import * as store from '@/lib/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { password } = await req.json();
    const pw = process.env.DRIVER_PASSWORD || 'changeme';
    if (password !== pw)
      return NextResponse.json({ error: 'mot de passe incorrect' }, { status: 401 });
    let driver: { id: number; name: string; phone?: string | null; vehicle?: string | null } = { id: 1, name: 'Chauffeur' };
    try {
      driver = await store.upsertDriver({ id: 1, name: 'Chauffeur' });
    } catch (e) {
      console.error('[driver/login] upsertDriver échoué:', e);
    }
    await setSession({ sub: String(driver.id), role: 'driver', name: driver.name });
    return NextResponse.json({ ok: true, driver });
  } catch (e: any) {
    console.error('[driver/login] crash:', e);
    return NextResponse.json({ error: 'crash', detail: String(e?.message || e), stack: String(e?.stack || '').slice(0, 400) }, { status: 500 });
  }
}
