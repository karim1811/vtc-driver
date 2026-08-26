"use client";

import { useState, useEffect } from "react";
import MapView from "@/components/MapView";

type Booking = {
  id: number; pickup: string; dropoff: string; pickupAt: string;
  price: number; status: string; payment: string; durationMin: number; deposit: number;
  pickupLat?: number; pickupLng?: number; dropoffLat?: number; dropoffLng?: number;
  depositStatus?: "pending" | "collected";
  balanceStatus?: "held" | "settled" | "cancelled";
  clientPhone?: string | null;
  clientName?: string | null;
};
type DriverProfile = { id: number; name: string; phone?: string; vehicle?: string; bio?: string };
type WeekdaySlot = { day: number; start: string; end: string };
type Availability = { open: boolean; weekly: WeekdaySlot[] };
type InviteCode = { code: string; label?: string; usedBy?: number };

// Index des jours : 0=dim … 6=sam (cohérent avec Date.getDay())
const DAYS = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

export default function ChauffeurPage() {
  const [pw, setPw] = useState("");
  const [authed, setAuthed] = useState(false);
  const [err, setErr] = useState("");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [busy, setBusy] = useState(false);

  // disponibilité
  const [av, setAv] = useState<Availability>({ open: true, weekly: [] });
  // jour en cours d'édition pour ajouter une plage
  const [editDay, setEditDay] = useState<number>(1); // Lundi par défaut
  const [editStart, setEditStart] = useState("08:00");
  const [editEnd, setEditEnd] = useState("12:00");

  // codes d'invitation
  const [codes, setCodes] = useState<InviteCode[]>([]);
  const [newCode, setNewCode] = useState<InviteCode | null>(null);
  const [codeBusy, setCodeBusy] = useState(false);

  // profil chauffeur
  const [driver, setDriver] = useState<DriverProfile | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editVehicle, setEditVehicle] = useState("");
  const [editBio, setEditBio] = useState("");
  const [profileSaved, setProfileSaved] = useState(false);

  // partage position live
  const [sharingId, setSharingId] = useState<number | null>(null);
  const [shareMsg, setShareMsg] = useState("");

  async function loadCodes() {
    const r = await fetch("/api/driver/codes");
    if (r.ok) setCodes(await r.json().then((d) => d.codes));
  }
  async function genCode() {
    setCodeBusy(true);
    const r = await fetch("/api/driver/codes", { method: "POST" });
    setCodeBusy(false);
    if (r.ok) {
      const d = await r.json();
      setNewCode(d.code);
      loadCodes();
    }
  }

  useEffect(() => {
    if (authed) { refresh(); loadAv(); loadCodes(); loadProfile(); }
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

  async function loadProfile() {
    const r = await fetch("/api/driver/profile");
    if (r.ok) {
      const d = await r.json();
      const drv = d.driver || { id: 1, name: "Chauffeur" };
      setDriver(drv);
      setEditName(drv.name || "");
      setEditPhone(drv.phone || "");
      setEditVehicle(drv.vehicle || "");
      setEditBio(drv.bio || "");
    }
  }
  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch("/api/driver/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName, phone: editPhone, vehicle: editVehicle, bio: editBio }),
    });
    if (r.ok) { setProfileSaved(true); loadProfile(); setTimeout(() => setProfileSaved(false), 2000); }
  }
  // Le chauffeur confirme sa présence -> encaisse l'acompte. Le solde reste en suspens.
  async function confirmArrival(id: number) {
    const r = await fetch("/api/driver/confirm-arrival", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (r.ok) refresh();
  }
  // Normalise un n° FR pour les liens tel:/wa.me
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
      body: JSON.stringify({ open: next.open, weekly: next.weekly }),
    });
  }
  function toggleOpen() {
    saveAv({ ...av, open: !av.open });
  }
  function addSlot() {
    const slot: WeekdaySlot = { day: editDay, start: editStart, end: editEnd };
    // Empêche les doublons exacts
    const exists = av.weekly.find((s) => s.day === slot.day && s.start === slot.start && s.end === slot.end);
    if (exists) return;
    saveAv({ ...av, weekly: [...av.weekly, slot] });
  }
  function removeSlot(day: number, start: string, end: string) {
    saveAv({ ...av, weekly: av.weekly.filter((s) => !(s.day === day && s.start === start && s.end === end)) });
  }

  async function setStatus(id: number, status: string) {
    await fetch("/api/driver/bookings/" + id, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    refresh();
  }

  // Partage de la position GPS (le chauffeur "diffuse" sa voiture sur la carte client).
  function shareLocation(id: number) {
    if (!navigator.geolocation) { setShareMsg("Géolocalisation non supportée par ce navigateur."); return; }
    setSharingId(id);
    setShareMsg("Position partagée en direct…");
    const watch = navigator.geolocation.watchPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        await fetch("/api/driver/location", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bookingId: id, lat: latitude, lng: longitude }),
        });
      },
      () => setShareMsg("Impossible de lire la position GPS."),
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 }
    );
    // On stocke le watch pour pouvoir l'arrêter (refresh / départ).
    (window as any).__vtcWatch = watch;
  }
  function stopSharing() {
    if ((window as any).__vtcWatch != null) {
      navigator.geolocation.clearWatch((window as any).__vtcWatch);
      (window as any).__vtcWatch = null;
    }
    setSharingId(null);
    setShareMsg("Diffusion arrêtée.");
  }
  useEffect(() => () => stopSharing(), []);

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
        {/* Disponibilité — toggle clair + plages par jour de semaine */}
        <section className="bg-neutral-900 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Disponibilité</h2>
              <p className={`text-sm font-medium ${av.open ? "text-emerald-400" : "text-red-400"}`}>
                {av.open
                  ? "Vous recevez des courses maintenant."
                  : "Vous êtes indisponible — aucune réservation possible."}
              </p>
              <p className="text-xs text-neutral-500 mt-1">
                {av.weekly.length === 0
                  ? "Sans plage définie, vous êtes ouvert tous les jours tant que vous êtes « En ligne »."
                  : "Vous n'acceptez des courses que sur les plages ci-dessous, quand vous êtes « En ligne »."}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <button
                onClick={toggleOpen}
                role="switch"
                aria-checked={av.open}
                className={`relative h-9 w-16 rounded-full transition-colors ${av.open ? "bg-emerald-500" : "bg-neutral-700"}`}
              >
                <span className={`absolute top-1 h-7 w-7 rounded-full bg-white transition-transform ${av.open ? "translate-x-8" : "translate-x-1"}`} />
              </button>
              <span className="text-xs text-neutral-400">{av.open ? "En ligne" : "Hors ligne"}</span>
            </div>
          </div>

          {/* Liste des plages hebdomadaires */}
          <div className="space-y-2">
            {av.weekly.length === 0 && (
              <p className="text-sm text-neutral-500">Aucune plage horaire — ouvert en permanence quand vous êtes en ligne.</p>
            )}
            {DAYS.map((label, day) => {
              const slots = av.weekly.filter((s) => s.day === day);
              if (slots.length === 0) return null;
              return (
                <div key={day} className="bg-neutral-800 rounded-lg px-3 py-2 text-sm">
                  <p className="font-medium text-neutral-300 mb-1">{label}</p>
                  <div className="flex flex-wrap gap-2">
                    {slots.map((s) => (
                      <span key={s.start + s.end} className="inline-flex items-center gap-2 bg-neutral-900 rounded px-2 py-1 text-xs">
                        {s.start}–{s.end}
                        <button
                          className="text-red-400"
                          onClick={() => removeSlot(s.day, s.start, s.end)}
                          aria-label="Retirer la plage"
                        >✕</button>
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Ajout d'une plage : choisir un jour + horaires */}
          <div className="pt-2 border-t border-neutral-700 space-y-2">
            <p className="text-sm text-neutral-400">Ajouter une plage récurrente :</p>
            <div className="grid grid-cols-1 gap-2">
              <select className="input" value={editDay} onChange={(e) => setEditDay(Number(e.target.value))}>
                {DAYS.map((label, day) => (
                  <option key={day} value={day}>{label}</option>
                ))}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <input className="input" type="time" value={editStart} onChange={(e) => setEditStart(e.target.value)} />
                <input className="input" type="time" value={editEnd} onChange={(e) => setEditEnd(e.target.value)} />
              </div>
            </div>
            <button className="btn-sm" onClick={addSlot} disabled={editStart >= editEnd}>
              Ajouter cette plage
            </button>
          </div>
        </section>

        {/* Codes d'invitation — lien de partage prêt à l'emploi */}
        <section className="bg-neutral-900 rounded-2xl p-5 space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Invitations clients</h2>
            <button className="btn-sm" onClick={genCode} disabled={codeBusy}>
              {codeBusy ? "Création..." : "Créer un lien d'invitation"}
            </button>
          </div>
          <p className="text-xs text-neutral-400">
            Créez un lien et envoyez-le à votre client (SMS, WhatsApp…). Il ouvre directement la page de réservation,
            le code est déjà rempli — plus besoin de le recopier.
          </p>
          {newCode && (
            <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-3 space-y-2">
              <p className="text-xs text-neutral-300">Lien à transmettre à votre client :</p>
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  className="input flex-1 text-xs"
                  value={`${window.location.origin}/reserver?code=${newCode.code}`}
                />
                <button
                  className="btn-sm whitespace-nowrap"
                  onClick={() => navigator.clipboard?.writeText(`${window.location.origin}/reserver?code=${newCode.code}`)}
                >copier</button>
              </div>
              <p className="text-xs text-neutral-500">
                Code : <span className="font-mono text-emerald-400">{newCode.code}</span> · un seul usage.
              </p>
            </div>
          )}
          <div className="space-y-2">
            {codes.length === 0 && <p className="text-sm text-neutral-500">Aucun lien créé pour l'instant.</p>}
            {codes.map((c) => (
              <div key={c.code} className="flex items-center justify-between bg-neutral-800 rounded-lg px-3 py-2 text-sm">
                <span className="font-mono">{c.code}</span>
                <span className={c.usedBy ? "text-emerald-400 text-xs" : "text-neutral-500 text-xs"}>
                  {c.usedBy ? "utilisé" : "disponible"}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Profil chauffeur */}
        <section className="bg-neutral-900 rounded-2xl p-5 space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Mon profil</h2>
            {profileSaved && <span className="text-emerald-400 text-xs">Profil enregistré ✓</span>}
          </div>
          <p className="text-xs text-neutral-400">
            Ce profil apparaît côté client pour qu'il puisse vous appeler / vous joindre sur WhatsApp.
          </p>
          <form onSubmit={saveProfile} className="space-y-3">
            <input className="input" placeholder="Nom affiché" value={editName} onChange={(e) => setEditName(e.target.value)} required />
            <input className="input" placeholder="Téléphone (ex 06 12 34 56 78)" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} />
            <input className="input" placeholder="Véhicule (ex Peugeot 308, Gris, AB-123-CD)" value={editVehicle} onChange={(e) => setEditVehicle(e.target.value)} />
            <textarea className="input" placeholder="Bio (optionnel)" value={editBio} onChange={(e) => setEditBio(e.target.value)} rows={2} />
            <button className="btn-sm" type="submit">Enregistrer mon profil</button>
          </form>
        </section>
        <section className="space-y-4">
          <div className="flex justify-between items-center">
            <h1 className="text-xl font-semibold">Courses</h1>
            <button className="text-sm text-neutral-400 hover:text-white" onClick={refresh}>Rafraîchir</button>
          </div>
          {bookings.length === 0 && <p className="text-neutral-400">Aucune course.</p>}
          {bookings.map((b) => (
            <div key={b.id} className="bg-neutral-900 rounded-xl p-4 space-y-3">
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
                  : `à l'arrivée (acompte ${b.deposit} €)`}
              </p>

              {/* État d'encaissement : acompte vs solde en suspens */}
              <div className="flex flex-wrap gap-2 text-xs">
                <span className={b.depositStatus === "collected" ? "px-2 py-1 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-300" : "px-2 py-1 rounded bg-amber-500/15 border border-amber-500/30 text-amber-300"}>
                  Acompte {b.deposit} € : {b.depositStatus === "collected" ? "encaissé" : "en attente de présence"}
                </span>
                <span className="px-2 py-1 rounded bg-neutral-800 border border-neutral-700 text-neutral-300">
                  Solde {Math.max(0, b.price - b.deposit)} € : {b.balanceStatus === "settled" ? "réglé" : "en suspens"}
                </span>
              </div>
              {b.pickupLat != null && b.dropoffLat != null && (
                <MapView
                  pickup={{ lat: b.pickupLat, lng: b.pickupLng! }}
                  dropoff={{ lat: b.dropoffLat, lng: b.dropoffLng! }}
                />
              )}
              <div className="flex gap-2 flex-wrap">
                {b.status === "pending" && <button className="btn-sm" onClick={() => setStatus(b.id, "confirmed")}>Confirmer</button>}
                <button className="btn-sm" onClick={() => confirmArrival(b.id)}>✅ Présence confirmée → encaisser acompte</button>
                {b.status !== "done" && b.status !== "cancelled" && <button className="btn-sm" onClick={() => setStatus(b.id, "done")}>Terminer</button>}
                {b.status !== "cancelled" && <button className="btn-sm-danger" onClick={() => setStatus(b.id, "cancelled")}>Annuler</button>}
              </div>
              {/* Contacter le client */}
              {b.clientPhone && (
                <div className="flex gap-2">
                  <a href={telHref(b.clientPhone)} className="btn-sm flex-1 text-center">📞 Appeler le client</a>
                  <a href={waHref(b.clientPhone)} target="_blank" rel="noreferrer" className="btn-sm flex-1 text-center">💬 WhatsApp</a>
                </div>
              )}
              {(b.status === "confirmed" || b.status === "pending") && (
                <div className="pt-2 border-t border-neutral-700">
                  {sharingId === b.id ? (
                    <button className="btn-sm-danger w-full" onClick={stopSharing}>Arrêter le partage de position</button>
                  ) : (
                    <button className="btn-sm w-full" onClick={() => shareLocation(b.id)}>📍 Partager ma position (suivi live)</button>
                  )}
                  <p className="text-xs text-neutral-400 mt-1">{shareMsg}</p>
                </div>
              )}
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
