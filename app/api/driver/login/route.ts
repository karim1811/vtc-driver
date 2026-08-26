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
  let driver: { id: number; name: string; phone?: string | null; vehicle?: string | null } = { id: 1, name: 'Chauffeur' };
  try {
    driver = await store.upsertDriver({ id: 1, name: 'Chauffeur' });
  } catch (e) {
    // Résilience : si la table drivers a un souci, on laisse passer la connexion
    // avec un profil minimal (le chauffeur peut quand même accéder à son espace).
    console.error('[driver/login] upsertDriver échoué, profil minimal utilisé:', e);
  }
  await setSession({ sub: String(driver.id), role: 'driver', name: driver.name });
  return NextResponse.json({ ok: true, driver });
}
