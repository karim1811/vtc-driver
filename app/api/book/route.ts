import { NextRequest, NextResponse } from 'next/server';
import { geocode, route, estimateDuration } from '@/lib/geo';
import { computePrice, computeDeposit } from '@/lib/pricing';
import { getSession } from '@/lib/auth';
import * as store from '@/lib/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s || s.role !== 'client')
    return NextResponse.json({ error: 'non connecté' }, { status: 401 });

  const { pickup, dropoff, pickupAt, payment } = await req.json();
  if (!pickup || !dropoff || !pickupAt)
    return NextResponse.json({ error: 'champs manquants' }, { status: 400 });

  const a = await geocode(pickup);
  const b = await geocode(dropoff);
  if (!a || !b) return NextResponse.json({ error: 'adresse introuvable' }, { status: 404 });

  const r = await route(a, b);
  const distanceKm = r.distanceKm;
  const price = computePrice(distanceKm, a.dept, new Date(pickupAt));
  const durationMin = estimateDuration(distanceKm, r.durationSec);
  const paymentMode = payment === 'online' ? 'online' : payment === 'cash' ? 'cash' : 'arrival';
  const deposit = computeDeposit(price, paymentMode);

  // Disponibilité chauffeur (open + plages)
  const avail = await store.isAvailableAt(pickupAt);
  if (!avail)
    return NextResponse.json(
      { error: 'le chauffeur n\'est pas disponible à cette heure' },
      { status: 409 }
    );

  // Blocage chevauchement : 1 seul chauffeur
  const start = new Date(pickupAt).getTime();
  const end = start + durationMin * 60000;
  const conflicts = (await store.listBookings()).filter(
    (x) => x.status === 'pending' || x.status === 'confirmed'
  ).filter((x) => {
    const s2 = new Date(x.pickupAt).getTime();
    const e2 = s2 + x.durationMin * 60000;
    return start < e2 && s2 < end;
  });
  if (conflicts.length)
    return NextResponse.json(
      { error: 'créneau indisponible (course en cours sur cette plage)' },
      { status: 409 }
    );

  const booking = await store.createBooking({
    userId: Number(s.sub),
    pickup,
    dropoff,
    pickupLat: a.lat,
    pickupLng: a.lng,
    dropoffLat: b.lat,
    dropoffLng: b.lng,
    distanceKm: Math.round(distanceKm * 100) / 100,
    price,
    pickupAt,
    durationMin,
    payment: payment === 'online' ? 'online' : payment === 'cash' ? 'cash' : 'arrival',
    deposit,
  });

  // Paiement : l'acompte n'est encaissé QUE quand le chauffeur confirme sa
  // présence (bouton dédié), et le solde reste EN SUSPENS dans l'app jusqu'à la
  // fin de la course (statut 'done'). On ne pré-valide donc rien ici.
  if (paymentMode === 'online' || deposit > 0) {
    const { getBaseUrl, createCheckout } = await import('@/lib/payments');
    const res = await createCheckout({
      bookingId: booking.id,
      amountEur: paymentMode === 'online' ? booking.price : booking.deposit,
      customerName: s.name,
      returnBase: getBaseUrl(req),
    });
    // Mode démo : on ne considère PAS l'acompte validé tout de suite. Le chauffeur
    // l'encaisse à la confirmation de présence. On renvoie juste l'URL de suivi.
    if (res.mode === 'demo') {
      return NextResponse.json({ ok: true, booking, paymentUrl: `/confirmation?id=${booking.id}`, mode: res.mode });
    }
    return NextResponse.json({ ok: true, booking, paymentUrl: res.url, mode: res.mode });
  }

  return NextResponse.json({ ok: true, booking });
}
