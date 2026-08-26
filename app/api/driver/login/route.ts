import { NextRequest, NextResponse } from 'next/server';
import { setSession } from '@/lib/auth';
import * as store from '@/lib/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const password: string | undefined = body?.password;
    const pw = process.env.DRIVER_PASSWORD || 'changeme';
    if (password !== pw)
      return NextResponse.json({ error: 'mot de passe incorrect' }, { status: 401 });
    // Profil fixe : on ne dépend PAS du retour de la DB (robustesse prod).
    const driver = { id: 1, name: 'Chauffeur' };
    // Best-effort : on tente de (ré)créer/mettre à jour le profil en DB, mais ça
    // ne bloque pas la connexion si la table a un souci.
    try {
      await store.upsertDriver(driver);
    } catch (e) {
      console.error('[driver/login] upsertDriver ignoré:', e);
    }
    await setSession({ sub: String(driver.id), role: 'driver', name: driver.name });
    return NextResponse.json({ ok: true, driver });
  } catch (e: any) {
    console.error('[driver/login] crash:', e);
    return NextResponse.json({ error: 'crash', detail: String(e?.message || e) }, { status: 500 });
  }
}
