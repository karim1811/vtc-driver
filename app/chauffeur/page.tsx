"use client";

import { useState, useEffect } from "react";

type Booking = {
  id: number; pickup: string; dropoff: string; pickupAt: string;
  price: number; status: string; payment: string; durationMin: number;
};

export default function ChauffeurPage() {
  const [pw, setPw] = useState("");
  const [authed, setAuthed] = useState(false);
  const [err, setErr] = useState("");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (authed) refresh();
  }, [authed]);

  async function login(e: React.FormEvent) {
    e.preventDefault(); setErr(""); setBusy(true);
    const r = await fetch("/api/driver/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: pw }),
    });
    setBusy(false);
    if (!r.ok) { setErr("mot de passe incorrect"); return; }
    setAuthed(true);
  }

  async function refresh() {
    const r = await fetch("/api/driver/bookings");
    if (r.ok) setBookings(await r.json().then((d) => d.bookings));
  }

  async function setStatus(id: number, status: string) {
    await fetch("/api/driver/bookings/" + id, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    refresh();
  }

  if (!authed) {
    return (
      <main className="flex-1 flex items-center justify-center px-6">
        <form onSubmit={login} className="w-full max-w-sm bg-neutral-900 rounded-2xl p-6 space-y-4">
          <h1 className="text-xl font-semibold">Espace chauffeur</h1>
          <input className="input" type="password" placeholder="Mot de passe" value={pw} onChange={(e) => setPw(e.target.value)} required />
          {err && <p className="text-red-400 text-sm">{err}</p>}
          <button className="btn" disabled={busy}>{busy ? "..." : "Entrer"}</button>
        </form>
      </main>
    );
  }

  return (
    <main className="flex-1 px-4 py-8">
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="flex justify-between items-center">
          <h1 className="text-xl font-semibold">Courses</h1>
          <button className="text-sm text-neutral-400 hover:text-white" onClick={refresh}>Rafraîchir</button>
        </div>
        {bookings.length === 0 && <p className="text-neutral-400">Aucune course.</p>}
        {bookings.map((b) => (
          <div key={b.id} className="bg-neutral-900 rounded-xl p-4 space-y-2">
            <div className="flex justify-between">
              <span className="font-semibold">#{b.id}</span>
              <span className="text-xs px-2 py-1 rounded bg-neutral-800">{b.status}</span>
            </div>
            <p className="text-sm">{b.pickup} → {b.dropoff}</p>
            <p className="text-sm text-neutral-400">
              {new Date(b.pickupAt).toLocaleString("fr-FR")} · {b.durationMin} min · {b.price} € · {b.payment === "online" ? "en avance" : "à l'arrivée"}
            </p>
            <div className="flex gap-2 flex-wrap">
              {b.status === "pending" && <button className="btn-sm" onClick={() => setStatus(b.id, "confirmed")}>Confirmer</button>}
              {b.status !== "done" && b.status !== "cancelled" && <button className="btn-sm" onClick={() => setStatus(b.id, "done")}>Terminer</button>}
              {b.status !== "cancelled" && <button className="btn-sm-danger" onClick={() => setStatus(b.id, "cancelled")}>Annuler</button>}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
