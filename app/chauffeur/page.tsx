"use client";

import { useState, useEffect } from "react";
import MapView from "@/components/MapView";

type Booking = {
  id: number; pickup: string; dropoff: string; pickupAt: string;
  price: number; status: string; payment: string; durationMin: number; deposit: number;
  pickupLat?: number; pickupLng?: number; dropoffLat?: number; dropoffLng?: number;
};
type Slot = { id: string; date: string; start: string; end: string };
type Availability = { open: boolean; slots: Slot[] };

export default function ChauffeurPage() {
  const [pw, setPw] = useState("");
  const [authed, setAuthed] = useState(false);
  const [err, setErr] = useState("");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [busy, setBusy] = useState(false);

  // disponibilité
  const [av, setAv] = useState<Availability>({ open: true, slots: [] });
  const [newSlot, setNewSlot] = useState<Slot>({ id: "", date: "", start: "08:00", end: "12:00" });

  useEffect(() => {
    if (authed) { refresh(); loadAv(); }
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
  async function loadAv() {
    const r = await fetch("/api/availability");
    if (r.ok) setAv(await r.json().then((d) => d.availability));
  }
  async function saveAv(next: Availability) {
    setAv(next);
    await fetch("/api/availability", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ open: next.open, slots: next.slots }),
    });
  }
  function toggleOpen() {
    saveAv({ ...av, open: !av.open });
  }
  function addSlot() {
    if (!newSlot.date) return;
    const slot = { ...newSlot, id: Date.now() + "" };
    saveAv({ ...av, slots: [...av.slots, slot] });
    setNewSlot({ id: "", date: "", start: "08:00", end: "12:00" });
  }
  function removeSlot(id: string) {
    saveAv({ ...av, slots: av.slots.filter((s) => s.id !== id) });
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
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Disponibilité */}
        <section className="bg-neutral-900 rounded-2xl p-5 space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Mes disponibilités</h2>
            <button
              onClick={toggleOpen}
              className={`px-4 py-2 rounded-full text-sm font-semibold ${av.open ? "bg-emerald-500 text-black" : "bg-red-500 text-white"}`}
            >
              {av.open ? "Disponible" : "Indisponible"}
            </button>
          </div>
          <p className="text-xs text-neutral-400">
            Bouton sur <b>Indisponible</b> : plus aucune réservation possible (emploi, repos...).
            Avec des plages définies ci-dessous, les clients ne réservent que sur ces créneaux.
          </p>

          <div className="space-y-2">
            {av.slots.length === 0 && <p className="text-sm text-neutral-500">Aucune plage définie — réservations ouvertes en permanence tant que « Disponible ».</p>}
            {av.slots.map((s) => (
              <div key={s.id} className="flex items-center justify-between bg-neutral-800 rounded-lg px-3 py-2 text-sm">
                <span>{new Date(s.date).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })} · {s.start}–{s.end}</span>
                <button className="text-red-400 text-xs" onClick={() => removeSlot(s.id)}>Retirer</button>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-2">
            <input className="input" type="date" value={newSlot.date} onChange={(e) => setNewSlot({ ...newSlot, date: e.target.value })} />
            <input className="input" type="time" value={newSlot.start} onChange={(e) => setNewSlot({ ...newSlot, start: e.target.value })} />
            <input className="input" type="time" value={newSlot.end} onChange={(e) => setNewSlot({ ...newSlot, end: e.target.value })} />
          </div>
          <button className="btn-sm" onClick={addSlot} disabled={!newSlot.date}>Ajouter une plage</button>
        </section>

        {/* Courses */}
        <section className="space-y-4">
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
                {new Date(b.pickupAt).toLocaleString("fr-FR")} · {b.durationMin} min · {b.price} € ·{" "}
                {b.payment === "online"
                  ? "en avance"
                  : b.payment === "cash"
                  ? `espèces (acompte ${b.deposit} €)`
                  : "à l'arrivée"}
              </p>
              {b.pickupLat != null && b.dropoffLat != null && (
                <MapView
                  pickup={{ lat: b.pickupLat, lng: b.pickupLng! }}
                  dropoff={{ lat: b.dropoffLat, lng: b.dropoffLng! }}
                />
              )}
              <div className="flex gap-2 flex-wrap">
                {b.status === "pending" && <button className="btn-sm" onClick={() => setStatus(b.id, "confirmed")}>Confirmer</button>}
                {b.status !== "done" && b.status !== "cancelled" && <button className="btn-sm" onClick={() => setStatus(b.id, "done")}>Terminer</button>}
                {b.status !== "cancelled" && <button className="btn-sm-danger" onClick={() => setStatus(b.id, "cancelled")}>Annuler</button>}
              </div>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
