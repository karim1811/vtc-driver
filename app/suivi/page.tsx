"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import MapView from "@/components/MapView";

type Booking = {
  id: number; pickup: string; dropoff: string; pickupAt: string;
  price: number; status: string; payment: string; deposit: number;
  depositStatus?: "pending" | "collected"; balanceStatus?: "held" | "settled" | "cancelled";
  pickupLat?: number; pickupLng?: number; dropoffLat?: number; dropoffLng?: number;
  driverLat: number | null; driverLng: number | null; sharedAt: string | null;
  driverName?: string | null; driverPhone?: string | null;
};

function telHref(p?: string | null) {
  if (!p) return "";
  const n = p.replace(/[^0-9+]/g, "");
  return "tel:" + (n.startsWith("+") ? n : "33" + n.replace(/^0/, ""));
}
function waHref(p?: string | null) {
  if (!p) return "";
  const n = p.replace(/[^0-9]/g, "").replace(/^0/, "33");
  return "https://wa.me/" + n;
}

function SuiviInner() {
  const params = useSearchParams();
  const id = params.get("id");
  const [b, setB] = useState<Booking | null>(null);
  const [err, setErr] = useState("");

  async function load() {
    if (!id) return;
    const r = await fetch("/api/booking/" + id);
    if (!r.ok) { setErr("Course introuvable."); return; }
    setB(await r.json());
  }
  useEffect(() => { load(); }, [id]);
  // Rafraîchit la position du véhicule tant que la course n'est pas terminée.
  useEffect(() => {
    if (!id) return;
    const t = setInterval(async () => {
      const r = await fetch("/api/booking/" + id);
      if (r.ok) {
        const d = await r.json();
        setB(d);
        if (d.status === "done" || d.status === "cancelled") clearInterval(t);
      }
    }, 4000);
    return () => clearInterval(t);
  }, [id]);

  return (
    <main className="flex-1 px-4 py-8">
      <div className="max-w-md mx-auto space-y-4">
        <h1 className="text-xl font-semibold">Suivi de votre course</h1>
        {err && <p className="text-red-400 text-sm">{err}</p>}
        {!b && !err && <p className="text-neutral-400 text-sm">Chargement…</p>}
        {b && (
          <>
            <div className="rounded-xl bg-neutral-900 p-4 space-y-2 text-sm">
              <p>{b.pickup} → {b.dropoff}</p>
              <p className="text-neutral-400">{new Date(b.pickupAt).toLocaleString("fr-FR")}</p>
              <p className="text-emerald-400 text-lg font-bold">{b.price} €</p>
              {b.status === "pending" && <p className="text-amber-400">En attente de confirmation du chauffeur.</p>}
              {b.status === "confirmed" && <p className="text-emerald-400">Chauffeur en route 🚗</p>}
              {b.status === "done" && <p className="text-neutral-400">Course terminée.</p>}
              {b.status === "cancelled" && <p className="text-red-400">Course annulée.</p>}
              {b.driverLat != null && b.driverLng != null && (
                <p className="text-xs text-neutral-500">Position du véhicule mise à jour en direct.</p>
              )}
              {b.driverName && (
                <p className="text-sm text-neutral-300">Votre chauffeur : <b>{b.driverName}</b></p>
              )}
            </div>

            {b.driverPhone && (
              <div className="flex gap-2">
                <a href={telHref(b.driverPhone)} className="btn-sm flex-1 text-center">📞 Appeler le chauffeur</a>
                <a href={waHref(b.driverPhone)} target="_blank" rel="noreferrer" className="btn-sm flex-1 text-center">💬 WhatsApp</a>
              </div>
            )}

            <MapView
              pickup={{ lat: b.pickupLat!, lng: b.pickupLng! }}
              dropoff={{ lat: b.dropoffLat!, lng: b.dropoffLng! }}
              driver={b.driverLat != null && b.driverLng != null ? { lat: b.driverLat, lng: b.driverLng } : null}
              height={360}
            />

            <p className="text-xs text-neutral-500 text-center">
              Partagez cet écran avec le client. Le chauffeur active le suivi depuis son espace.
            </p>
          </>
        )}
      </div>
    </main>
  );
}

export default function SuiviPage() {
  return (
    <Suspense fallback={<div className="flex-1 flex items-center justify-center">Chargement...</div>}>
      <SuiviInner />
    </Suspense>
  );
}
