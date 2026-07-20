import crypto from 'crypto';
import { cookies } from 'next/headers';

const SECRET = process.env.AUTH_SECRET || 'dev-secret-change-me';

export type Session = { sub: string; role: 'client' | 'driver'; name?: string };

function sign(payload: string): string {
  return crypto.createHmac('sha256', SECRET).update(payload).digest('hex');
}

export function createToken(s: Session): string {
  const body = Buffer.from(JSON.stringify(s)).toString('base64url');
  return body + '.' + sign(body);
}

export function verifyToken(tok?: string): Session | null {
  if (!tok) return null;
  const [body, sig] = tok.split('.');
  if (!body || !sig) return null;
  if (sign(body) !== sig) return null;
  try {
    return JSON.parse(Buffer.from(body, 'base64url').toString()) as Session;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<Session | null> {
  const c = await cookies();
  return verifyToken(c.get('vtc_session')?.value);
}

export async function setSession(s: Session): Promise<void> {
  const c = await cookies();
  c.set('vtc_session', createToken(s), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearSession(): Promise<void> {
  const c = await cookies();
  c.delete('vtc_session');
}
