import { NextResponse } from 'next/server';
import * as store from '@/lib/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET : état réel du backend (DB vs fichier). Sert à vérifier en prod qu'on
// n'est PAS en repli silencieux sur fichier JSON.
export async function GET() {
  const mode = await store.dbMode();
  return NextResponse.json({
    mode,
    database: mode === 'db',
    at: new Date().toISOString(),
  });
}
