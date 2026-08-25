"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import MapView from "@/components/MapView";
import AddressInput from "@/components/AddressInput";

type Slot = { id: string; date: string; start: string; end: string };
type Availability = { open: boolean; slots: Slot[] };
type Quote = {
  distanceKm: number; price: number; durationMin: number; dept?: string;
  pickupLat?: number; pickupLng?: number; dropoffLat?: number; dropoffLng?: number;
  geometry?: [number, number][]; routed?: boolean; pickupLabel?: string; dropoffLabel?: string;
};

export default function ReservrPage() {
  const router = useRouter();
  const [step, setStep] = useState<"auth" | "form">("auth");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [authErr, setAuthErr] = useState("");

  // Adresses (avec coordonnées pour la carte live)
  const [pickup, setPickup] = useState("");
  const [dropoff, setDropoff] = useState("");
  const [pickupPt, setPickupPt] = useState<{ lat: number; lng: number } | null>(null);
  const [dropoffPt, setDropoffPt] = useState<{ lat: number; lng: number } | null>(null);
  const [geom, setGeom] = useState<[number, number][] | undefined>(undefined);

  // Date + heure
  const [date, setDate] = useState("");
  const [hour, setHour] = useState("09:00");

  // Disponibilité publique + sélection de créneau
  const [av, setAv] = useState<Availability | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);

  const [payment, setPayment] = useState<"arrival" | "online" | "cash">("arrival");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [deposit, setDeposit] = useState(0);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/availability/public")
      .then((r) => r.json())
      .then((d) => setAv(d.availability))
      .catch(() => {});
  }, []);

  // Si le chauffeur a des plages : on borne la sélection sur l'une d'elles.
  function applySlot(s: Slot | null) {
    setSelectedSlot(s);
    setDate(s ? s.date : "");
    setHour(s ? s.start : "09:00");
  }

  function pickupAtIso(): string | null {
    if (!date || !hour) return null;
    return `${date}T${hour}:00`;
  }

  async function register(e: React.FormEvent) {
    e.preventDefault();
    setAuthErr(""); setBusy(true);
    const r = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: code.toUpperCase(), name, phone }),
    });
    const d = await r.json();
    setBusy(false);
    if (!r.ok) { setAuthErr(d.error || "erreur"); return; }
    setStep("form");
  }

  async function getQuote() {
    setMsg(""); setBusy(true);
    const pickupAt = pickupAtIso();
    if (!pickupAt) { setMsg("choisissez une date et une heure"); setBusy(false); return; }
    const r = await fetch("/api/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pickup, dropoff, pickupAt }),
    });
    const d = await r.json();
    setBusy(false);
    if (!r.ok) {
      if (r.status === 409 && /disponible/i.test(d.error || "")) {
        setMsg("Créneau non disponible : réservez sur une plage ouverte par le chauffeur (voir ci-dessous).");
      } else {
        setMsg(d.error || "erreur");
      }
      setQuote(null); setGeom(undefined); return;
    }
    setQuote(d);
    setGeom(d.geometry);
    setPickupPt(d.pickupLat != null ? { lat: d.pickupLat, lng: d.pickupLng! } : null);
    setDropoffPt(d.dropoffLat != null ? { lat: d.dropoffLat, lng: d.dropoffLng! } : null);
    setDeposit(payment === "cash" ? Math.round(d.price * 0.3 * 100) / 100 : 0);
  }

  // Recalcul devis après déplacement manuel d'un pin (si devis déjà demandé)
  async function refreshFromMap() {
    if (!pickupPt || !dropoffPt) return;
    setBusy(true);
    const r = await fetch("/api/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pickup: pickupPt ? `${pickupPt.lat},${pickupPt.lng}` : pickup,
        dropoff: dropoffPt ? `${dropoffPt.lat},${dropoffPt.lng}` : dropoff,
        pickupAt: pickupAtIso() || `${new Date().toISOString().slice(0, 10)}T09:00:00`,
      }),
    });
    const d = await r.json();
    setBusy(false);
    if (r.ok) { setQuote(d); setGeom(d.geometry); }
  }

  async function book() {
    setMsg(""); setBusy(true);
    const pickupAt = pickupAtIso();
    if (!pickupAt) { setMsg("choisissez une date et une heure"); setBusy(false); return; }
    const body: any = {
      pickup: pickupPt ? `${pickupPt.lat},${pickupPt.lng}` : pickup,
      dropoff: dropoffPt ? `${dropoffPt.lat},${dropoffPt.lng}` : dropoff,
      pickupAt, payment,
    };
    const r = await fetch("/api/book", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const d = await r.json();
    setBusy(false);
    if (!r.ok) { setMsg(d.error || "erreur"); return; }
    if (d.paymentUrl) { window.location.href = d.paymentUrl; return; }
    router.push("/confirmation?id=" + d.booking.id);
  }

  if (step === "auth") {
    return (
      <main className="flex-1 flex items-center justify-center px-6">
        <form onSubmit={register} className="w-full max-w-sm bg-neutral-900 rounded-2xl p-6 space-y-4">
          <h1 className="text-xl font-semibold">Accès client</h1>
          <p className="text-sm text-neutral-400">Sur invitation. Entrez votre code.</p>
          <input className="input" placeholder="Code d'invitation" value={code} onChange={(e) => setCode(e.target.value)} required />
          <input className="input" placeholder="Nom" value={name} onChange={(e) => setName(e.target.value)} required />
          <input className="input" placeholder="Téléphone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          {authErr && <p className="text-red-400 text-sm">{authErr}</p>}
          <button className="btn" disabled={busy}>{busy ? "..." : "Accéder"}</button>
        </form>
      </main>
    );
  }

  const slotsActifs = av?.slots ?? [];
  const onlineActive = true;

  return (
    <main className="flex-1 px-4 py-8">
      <div className="max-w-md mx-auto space-y-5">
        <h1 className="text-xl font-semibold">Réserver une course</h1>

        {/* Disponibilité chauffeur */}
        <div className="rounded-xl bg-neutral-800 p-3 text-sm space-y-2">
          {!av ? (
            <p className="text-neutral-500">Chargement des disponibilités…</p>
          ) : !av.open ? (
            <p className="text-red-400 font-semibold">Réservation fermée pour le moment (chauffeur indisponible).</p>
          ) : slotsActifs.length > 0 ? (
            <>
              <p className="text-neutral-300 font-semibold">Le chauffeur est disponible sur ces plages :</p>
              <div className="flex flex-wrap gap-2">
                {slotsActifs.map((s) => {
                  const active = selectedSlot?.id === s.id;
                  return (
                    <button
                      key={s.id}
                      onClick={() => applySlot(active ? null : s)}
                      className={`px-3 py-2 rounded-lg text-xs border ${active ? "bg-emerald-500 text-black border-emerald-500 font-semibold" : "bg-neutral-900 border-neutral-700 hover:border-emerald-500"}`}
                    >
                      {new Date(s.date).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })} · {s.start}–{s.end}
                    </button>
                  );
                })}
              </div>
              {selectedSlot && (
                <p className="text-emerald-400 text-xs">Plage choisie — choisissez une heure dans cette plage ci-dessous.</p>
              )}
            </>
          ) : (
            <p className="text-emerald-400 text-xs">Le chauffeur accepte les courses sur l'ensemble de ses jours ouverts.</p>
          )}
        </div>

        {/* Adresses */}
        <div className="space-y-3">
          <AddressInput label="Adresse de départ" value={pickup} onChange={(v) => { setPickup(v); setPickupPt(null); setQuote(null); }} required />
          <AddressInput label="Adresse d'arrivée" value={dropoff} onChange={(v) => { setDropoff(v); setDropoffPt(null); setQuote(null); }} required />
        </div>

        {/* Carte live : posez/corrigez les points à la main */}
        <div className="space-y-2">
          <MapView
            pickup={pickupPt}
            dropoff={dropoffPt}
            geometry={geom}
            interactive
            height={260}
            onPickup={(p) => { setPickupPt(p); if (quote) refreshFromMap(); }}
            onDropoff={(p) => { setDropoffPt(p); if (quote) refreshFromMap(); }}
          />
          <p className="text-xs text-neutral-500">
            Astuce : touchez la carte pour poser le départ, puis l'arrivée. Déplacez les pins pour ajuster.
          </p>
        </div>

        {/* Date + heure */}
        <div className="grid grid-cols-2 gap-3">
          <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          <input
            className="input"
            type="time"
            value={hour}
            min={selectedSlot ? selectedSlot.start : undefined}
            max={selectedSlot ? selectedSlot.end : undefined}
            onChange={(e) => setHour(e.target.value)}
            required
          />
        </div>

        <button className="btn" disabled={busy || !pickup || !dropoff || !date || !hour} onClick={getQuote}>
          {busy ? <span className="spinner mr-2" /> : null}
          {busy ? "Calcul en cours..." : "Obtenir le devis"}
        </button>

        {msg && <p className="text-red-400 text-sm">{msg}</p>}

        {quote && (
          <div className="rounded-xl bg-neutral-800 p-4 space-y-2">
            <p className="text-sm text-neutral-300">
              Départ le <b>{new Date(pickupAtIso()!).toLocaleString("fr-FR", { dateStyle: "full", timeStyle: "short" })}</b>
            </p>
            <p>Distance : <b>{quote.distanceKm} km</b>{quote.routed ? "" : " (estimée)"}</p>
            <p>Durée estimée : <b>{quote.durationMin} min</b></p>
            <p className="text-emerald-400 text-lg font-bold">Prix de votre course : {quote.price} €</p>

            <MapView
              pickup={pickupPt}
              dropoff={dropoffPt}
              geometry={geom}
              height={220}
            />

            <div className="pt-2 space-y-2 border-t border-neutral-700">
              <p className="text-sm font-semibold text-neutral-300">Mode de paiement</p>
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" checked={payment === "arrival"} onChange={() => { setPayment("arrival"); setDeposit(0); }} />
                Payer à l'arrivée
              </label>
              <label className={`flex items-center gap-2 text-sm ${onlineActive ? "" : "opacity-40"}`}>
                <input type="radio" checked={payment === "online"} onChange={() => { setPayment("online"); setDeposit(0); }} disabled={!onlineActive} />
                Payer en avance {onlineActive ? "(Stripe sécurisé)" : "(Stripe à configurer)"}
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" checked={payment === "cash"} onChange={() => { setPayment("cash"); setDeposit(Math.round(quote.price * 0.3 * 100) / 100); }} />
                Espèces (acompte demandé)
              </label>

              {payment === "cash" && (
                <div className="rounded-lg bg-neutral-900 p-3 text-xs text-neutral-400 space-y-1">
                  <p>Acompte à verser pour confirmer : <b className="text-emerald-400">{deposit} €</b> (30% du total).</p>
                  <p className="text-red-400/90">L'acompte est <b>non remboursable</b>, y compris en cas d'annulation, quelle qu'en soit la raison.</p>
                  <p>Le solde ({Math.round((quote.price - deposit) * 100) / 100} €) est réglé en espèces au chauffeur.</p>
                </div>
              )}
            </div>

            <button type="button" className="btn w-full" onClick={book} disabled={busy}>
              {busy ? <span className="spinner mr-2" /> : null}
              {busy ? "Réservation..." : payment === "cash" ? "Réserver (acompte à régler)" : "Confirmer la réservation"}
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
