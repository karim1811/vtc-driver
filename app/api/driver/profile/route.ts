import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import * as store from '@/lib/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET : profil du chauffeur connecté
export async function GET() {
  const s = await getSession();
  if (!s || s.role !== 'driver')
    return NextResponse.json({ error: 'non autorisé' }, { status: 401 });
  const id = Number(s.sub);
  const driver = await store.getDriver(id);
  if (!driver) return NextResponse.json({ driver: null });
  return NextResponse.json({ driver });
}

// POST : crée ou met à jour le profil chauffeur (nom, téléphone, véhicule, bio)
export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s || s.role !== 'driver')
    return NextResponse.json({ error: 'non autorisé' }, { status: 401 });
  const body = await req.json();
  const driver = await store.upsertDriver({
    id: Number(s.sub),
    name: (body.name || s.name || 'Chauffeur').toString(),
    phone: body.phone ? String(body.phone) : undefined,
    vehicle: body.vehicle ? String(body.vehicle) : undefined,
    bio: body.bio ? String(body.bio) : undefined,
  });
  return NextResponse.json({ ok: true, driver });
}
