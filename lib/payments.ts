// Paiement Stripe pour VTC.
// Si STRIPE_SECRET_KEY n'est pas défini -> mode DEMO (flux simulé, aucun appel réseau).
// Côté client, le bouton "Payer en avance" s'active uniquement si
// NEXT_PUBLIC_STRIPE_PUBLISHABLE est défini.

import Stripe from 'stripe';
import type { NextRequest } from 'next/server';

export const STRIPE_ENABLED = !!process.env.STRIPE_SECRET_KEY;

// Reconstruit l'URL de base publique depuis la requête (pour les LiP de retour Stripe).
export function getBaseUrl(req: NextRequest): string {
  const proto = req.headers.get('x-forwarded-proto') || 'http';
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
  if (host) return `${proto}://${host}`;
  return process.env.APP_URL || 'http://localhost:3000';
}

let _stripe: Stripe | null = null;
export function getStripe(): Stripe | null {
  if (!STRIPE_ENABLED) return null;
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
      apiVersion: '2025-02-24.acacia',
    });
  }
  return _stripe;
}

export type CheckoutResult =
  | { mode: 'stripe'; url: string; sessionId: string }
  | { mode: 'demo'; url: string }; // redirige vers confirmation en mode démo

// Crée une Checkout Session Stripe OU une session démo.
// `returnUrl` = URL de retour après paiement (confirmation).
export async function createCheckout(opts: {
  bookingId: number;
  amountEur: number;
  customerName?: string;
  returnBase: string; // ex: https://host/reserver
}): Promise<CheckoutResult> {
  const success = `${opts.returnBase}/confirmation?id=${opts.bookingId}&paid=1`;
  const cancel = `${opts.returnBase}/reserver`;

  if (!STRIPE_ENABLED) {
    // DEMO: on simule un paiement immédiatement réussi.
    return { mode: 'demo', url: success };
  }

  const stripe = getStripe()!;
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: 'eur',
          unit_amount: Math.round(opts.amountEur * 100),
          product_data: {
            name: `Course VTC #${opts.bookingId}`,
            description: opts.customerName
              ? `Client : ${opts.customerName}`
              : undefined,
          },
        },
      },
    ],
    customer_creation: 'if_required',
    success_url: success,
    cancel_url: cancel,
    metadata: { bookingId: String(opts.bookingId) },
  });

  return { mode: 'stripe', url: session.url!, sessionId: session.id };
}

// Vérifie qu'un événement webhook Stripe est authentique.
export function verifyStripeWebhook(
  payload: string | Buffer,
  sig: string | null
): { ok: true; event: Stripe.Event } | { ok: false; error: string } {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return { ok: false, error: 'webhook secret manquant' };
  try {
    const stripe = getStripe()!;
    const event = stripe.webhooks.constructEvent(payload, sig!, secret);
    return { ok: true, event };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}
