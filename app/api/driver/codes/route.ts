import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import * as store from '@/lib/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET : liste des codes invités (créés par le chauffeur) + usage
export async function GET() {
  const s = await getSession();
  if (!s || s.role !== 'driver')
    return NextResponse.json({ error: 'non autorisé' }, { status: 401 });
  const codes = await store.listCodes();
  return NextResponse.json({ codes });
}

// POST : génère un nouveau code invité pour un client du chauffeur
// body optionnel: { label?: string }
export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s || s.role !== 'driver')
    return NextResponse.json({ error: 'non autorisé' }, { status: 401 });
  let label: string | undefined;
  try {
    const body = await req.json();
    label = body?.label;
  } catch {
    /* corps vide autorisé */
  }
  const code = await store.createCode(label);
  return NextResponse.json({ ok: true, code });
}
