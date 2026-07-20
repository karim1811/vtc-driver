import { NextRequest, NextResponse } from 'next/server';
import { setSession } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const { password } = await req.json();
  const pw = process.env.DRIVER_PASSWORD || 'changeme';
  if (password !== pw)
    return NextResponse.json({ error: 'mot de passe incorrect' }, { status: 401 });
  await setSession({ sub: 'driver', role: 'driver' });
  return NextResponse.json({ ok: true });
}
