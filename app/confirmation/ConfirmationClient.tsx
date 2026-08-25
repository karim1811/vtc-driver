"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

type Booking = {
  id: number;
  pickup: string;
  dropoff: string;
  pickupAt: string;
  price: number;
  status: string;
  payment: string;
  deposit: number;
  paid: number;
};

export default function ConfirmationInner() {
  const params = useSearchParams();
  const id = params.get("id");
  const paidParam = params.get("paid");
  const [b, setB] = useState<Booking | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!id) return;
    fetch("/api/booking/" + id)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setB)
      .catch(() => setErr("Impossible de charger le détail de la course."));
  }, [id]);

  return (
    <main className="flex-1 flex items-center justify-center px-6 text-center">
      <div className="max-w-md space-y-4">
        <h1 className="text-2xl font-bold text-emerald-400">Réservation confirmée</h1>
        {err && <p className="text-red-400 text-sm">{err}</p>}
        {!b && !err && <p className="text-neutral-400 text-sm">Chargement…</p>}
        {b && (
          <div className="rounded-xl bg-neutral-900 p-4 text-left space-y-2 text-sm">
            <p>Course n°<b>{b.id}</b></p>
            <p>{b.pickup} → {b.dropoff}</p>
            <p className="text-neutral-400">
              {new Date(b.pickupAt).toLocaleString("fr-FR")}
            </p>
            <p className="text-emerald-400 text-lg font-bold">{b.price} €</p>
            <p className="text-neutral-300">
              Paiement :{" "}
              {b.payment === "online" ? (
                b.paid ? (
                  <span className="text-emerald-400 font-semibold">payé en avance ✓</span>
                ) : (
                  <span className="text-amber-400 font-semibold">en ligne (en attente)</span>
                )
              ) : b.payment === "cash" ? (
                <span>
                  espèces — acompte <b className="text-emerald-400">{b.deposit} €</b> à régler (non remboursable)
                </span>
              ) : (
                <span>
                  à l'arrivée — acompte <b className="text-emerald-400">{b.deposit} €</b> payé à la réservation (non remboursable), le reste réglé au chauffeur
                </span>
              )}
            </p>
            <p className="text-neutral-400">Statut : {b.status}</p>
            <a href={`/suivi?id=${b.id}`} className="btn block text-center">Suivre ma course en direct</a>
          </div>
        )}
        {(paidParam === "1" || b?.paid) && (
          <p className="text-emerald-400 text-sm">✓ Paiement en avance validé. Merci !</p>
        )}
        <p className="text-neutral-400 text-sm">
          Le chauffeur confirmera depuis son espace. Détails par téléphone.
        </p>
      </div>
    </main>
  );
}
