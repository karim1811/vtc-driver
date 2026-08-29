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

// Lit la session côté client (navigateur) en décodant le COOKIE `vtc_session`
// posé par le serveur (httpOnly). NE fait PAS confiance au contenu : le serveur
// re-vérifie la signature HMAC à chaque appel API. Sert uniquement à savoir si
// l'utilisateur est connecté pour afficher le bon écran.
export function getClientSession(): Session | null {
  if (typeof window === 'undefined') return null;
  const m = document.cookie.match(/(?:^|;\s*)vtc_session=([^;]+)/);
  if (!m) return null;
  const tok = decodeURIComponent(m[1]);
  const [body] = tok.split('.');
  if (!body) return null;
  try {
    return JSON.parse(
      typeof atob !== 'undefined'
        ? decodeURIComponent(
            atob(body.replace(/-/g, '+').replace(/_/g, '/'))
              .split('')
              .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
              .join('')
          )
        : Buffer.from(body, 'base64url').toString()
    ) as Session;
  } catch {
    return null;
  }
}
