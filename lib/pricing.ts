// Tarification fixe (devis connu avant réservation).

export const PRICING = {
  base: 10, // prise en charge
  perKmIDF: 1.8, // €/km en Île-de-France
  perKmOise: 1.5, // €/km dans l'Oise (60)
  min: 15, // minimum
  avgSpeedKmh: 35, // vitesse moyenne ville/région
  bufferMin: 15, // marge entre deux courses
  nightStart: 20, // début majoration nocturne (20h)
  nightEnd: 6, // fin majoration nocturne (6h)
  nightMult: 1.2,
  depositRate: 0.3, // acompte espèces = 30% du total (non remboursable)
  depositRateArrival: 0.1, // acompte "à l'arrivée" = 10% du total (non remboursable)
};

export function zoneRate(dept?: string): number {
  return dept === '60' ? PRICING.perKmOise : PRICING.perKmIDF;
}

export function computePrice(
  distanceKm: number,
  dept?: string,
  pickupAt?: Date
): number {
  const rate = zoneRate(dept);
  let price = PRICING.base + distanceKm * rate;
  if (price < PRICING.min) price = PRICING.min;
  if (pickupAt) {
    const h = pickupAt.getHours();
    if (h >= PRICING.nightStart || h < PRICING.nightEnd) price *= PRICING.nightMult;
  }
  return Math.round(price * 100) / 100;
}

// Acompte selon mode de paiement. "à l'arrivée" => 10%, "espèces" => 30%, en avance => 0.
export function computeDeposit(price: number, payment: "arrival" | "online" | "cash"): number {
  const rate = payment === "cash" ? PRICING.depositRate : payment === "arrival" ? PRICING.depositRateArrival : 0;
  return Math.round(price * rate * 100) / 100;
}

export function estimateDuration(distanceKm: number): number {
  return Math.round((distanceKm / PRICING.avgSpeedKmh) * 60 + PRICING.bufferMin);
}
