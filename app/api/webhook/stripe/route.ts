import { NextRequest, NextResponse } from 'next/server';
import { verifyStripeWebhook } from '@/lib/payments';
import * as store from '@/lib/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Webhook Stripe : à la validation du paiement (acompte en avance), on marque
// l'acompte comme encaissé. La course reste 'pending' jusqu'à ce que le chauffeur
// confirme sa présence (bouton dédié) — cohérent avec la logique métier VTC.
export async function POST(req: NextRequest) {
  const sig = req.headers.get('stripe-signature');
  const payload = await req.text();
  const v = verifyStripeWebhook(payload, sig);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });

  const event = v.event;
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as { metadata?: { bookingId?: string } };
    const id = Number(session.metadata?.bookingId);
    if (id) {
      await store.updateBooking(id, { paid: 1, depositStatus: 'collected' });
    }
  }
  return NextResponse.json({ received: true });
}
