import { NextRequest, NextResponse } from 'next/server';
import { geocode } from '@/lib/geo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const { address } = await req.json();
  if (!address) return NextResponse.json({ error: 'adresse requise' }, { status: 400 });
  const r = await geocode(address);
  if (!r) return NextResponse.json({ error: 'adresse introuvable' }, { status: 404 });
  return NextResponse.json(r);
}
