import { NextRequest, NextResponse } from 'next/server';
import { setSession } from '@/lib/auth';
import * as store from '@/lib/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const { code, name, phone } = await req.json();
  const c = store.findCode((code || '').toUpperCase());
  if (!c) return NextResponse.json({ error: 'code invalide' }, { status: 400 });
  if (c.usedBy) return NextResponse.json({ error: 'code déjà utilisé' }, { status: 409 });

  const user = store.createUser({ name, phone, inviteCode: c.code });
  store.consumeCode(c.code, user.id);
  await setSession({ sub: String(user.id), role: 'client', name });
  return NextResponse.json({ ok: true, user });
}
