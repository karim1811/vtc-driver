import { NextResponse } from 'next/server';
import { STRIPE_ENABLED } from '@/lib/payments';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Indique au client si le paiement en avance Stripe est réellement opérationnel
// (côté serveur, STRIPE_ENABLED = !!STRIPE_SECRET_KEY). On n'expose JAMAIS la clé.
export async function GET() {
  return NextResponse.json({ online: STRIPE_ENABLED });
}
