"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import MapView from "@/components/MapView";
import AddressInput from "@/components/AddressInput";

// Créneau : matin / après-midi, avec heure de prise en charge.
type Slot = { half: "am" | "pm"; hour: string };

function defaultSlot(): Slot {
  const h = new Date().getHours();
  return { half: h < 12 ? "am" : "pm", hour: "09:00" };
}

export default function ReservrPage() {
  const router = useRouter();
  const [step, setStep] = useState<"auth" | "form">("auth");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [authErr, setAuthErr] = useState("");

  const [pickup, setPickup] = useState("");
  const [dropoff, setDropoff] = useState("");
  const [date, setDate] = useState("");
  const [slot, setSlot] = useState<Slot>(defaultSlot());
  const [payment, setPayment] = useState<"arrival" | "online" | "cash">("arrival");
  const [quote, setQuote] = useState<null | {
    distanceKm: number; price: number; durationMin: number; dept?: string;
    pickupLat?: number; pickupLng?: number; dropoffLat?: number; dropoffLng?: number;
    geometry?: [number, number][];
  }>(null);
  const [deposit, setDeposit] = useState(0);
  const [quoteErr, setQuoteErr] = useState("");
  const [busy, setBusy] = useState(false);

  // Disponibilité publique
  const [av, setAv] = useState<{ open: boolean; slots: { id: string; date: string; start: string; end: string }[] } | null>(null);
  useEffect(() => {
    fetch("/api/availability/public")
      .then((r) => r.json())
      .then((d) => setAv(d.availability))
      .catch(() => {});
  }, []);

  // Construit la date ISO à partir de date + créneau + heure.
  function pickupAtIso(): string | null {
    if (!date || !slot.hour) return null;
    return `${date}T${slot.hour}:00`;
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
    setQuoteErr(""); setBusy(true);
    const pickupAt = pickupAtIso();
    if (!pickupAt) { setQuoteErr("choisissez une date et une heure"); setBusy(false); return; }
    const r = await fetch("/api/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pickup, dropoff, pickupAt }),
    });
    const d = await r.json();
    setBusy(false);
    if (!r.ok) {
      if (r.status === 409 && /disponible/i.test(d.error || "")) {
        setQuoteErr("Réservation fermée : le chauffeur n'est pas disponible à cette heure. Voir les créneaux ci-dessous.");
      } else {
        setQuoteErr(d.error || "erreur");
      }
      setQuote(null); return;
    }
    setQuote(d);
    setDeposit(payment === "cash" ? Math.round(d.price * 0.3 * 100) / 100 : 0);
  }

  async function book() {
    setQuoteErr(""); setBusy(true);
    const pickupAt = pickupAtIso();
    if (!pickupAt) { setQuoteErr("choisissez une date et une heure"); setBusy(false); return; }
    const r = await fetch("/api/book", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pickup, dropoff, pickupAt, payment }),
    });
    const d = await r.json();
    setBusy(false);
    if (!r.ok) { setQuoteErr(d.error || "erreur"); return; }
    if (d.paymentUrl) {
      window.location.href = d.paymentUrl;
      return;
    }
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

  const onlineActive = true; // backend gère Stripe ou mode démo automatiquement

  return (
    <main className="flex-1 flex items-center justify-center px-6 py-8">
      <form onSubmit={(e) => { e.preventDefault(); getQuote(); }} className="w-full max-w-md bg-neutral-900 rounded-2xl p-6 space-y-4">
        <h1 className="text-xl font-semibold">Réserver une course</h1>

        <div className="space-y-3">
          <AddressInput label="Adresse de départ" value={pickup} onChange={setPickup} required />
          <AddressInput label="Adresse d'arrivée" value={dropoff} onChange={setDropoff} required />

          <div className="grid grid-cols-2 gap-3">
            <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            <select
              className="input"
              value={slot.half}
              onChange={(e) => setSlot({ ...slot, half: e.target.value as "am" | "pm" })}
            >
              <option value="am">Matin</option>
              <option value="pm">Après-midi</option>
            </select>
          </div>
          <input
            className="input"
            type="time"
            value={slot.hour}
            onChange={(e) => setSlot({ ...slot, hour: e.target.value })}
            required
          />
        </div>

        {av && (
          <div className="rounded-xl bg-neutral-800 p-3 text-sm space-y-2">
            {!av.open ? (
              <p className="text-red-400 font-semibold">Réservation fermée pour le moment (chauffeur indisponible).</p>
            ) : av.slots.length > 0 ? (
              <>
                <p className="text-neutral-300 font-semibold">Créneaux disponibles du chauffeur :</p>
                <div className="flex flex-wrap gap-2">
                  {av.slots.map((s) => (
                    <span key={s.id} className="px-2 py-1 rounded bg-neutral-900 text-xs">
                      {new Date(s.date).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })} · {s.start}–{s.end}
                    </span>
                  ))}
                </div>
                <p className="text-neutral-500 text-xs">Réservez uniquement sur ces plages.</p>
              </>
            ) : (
              <p className="text-emerald-400 text-xs">Le chauffeur accepte les courses sur l'ensemble de ses jours ouverts.</p>
            )}
          </div>
        )}

        <button className="btn" disabled={busy || !pickup || !dropoff || !date || !slot.hour}>
          {busy ? <span className="spinner mr-2" /> : null}
          {busy ? "Calcul en cours..." : "Obtenir le devis"}
        </button>

        {quoteErr && <p className="text-red-400 text-sm">{quoteErr}</p>}
        {quote && (
          <div className="rounded-xl bg-neutral-800 p-4 space-y-2">
            <p className="text-sm text-neutral-300">
              Départ le <b>{new Date(pickupAtIso()!).toLocaleString("fr-FR", { dateStyle: "full", timeStyle: "short" })}</b>
            </p>
            <p>Distance : <b>{quote.distanceKm} km</b></p>
            <p>Durée estimée : <b>{quote.durationMin} min</b></p>
            <p className="text-emerald-400 text-lg font-bold">Prix de votre course : {quote.price} €</p>
            {quote.pickupLat != null && quote.dropoffLat != null && (
              <MapView
                pickup={{ lat: quote.pickupLat, lng: quote.pickupLng! }}
                dropoff={{ lat: quote.dropoffLat, lng: quote.dropoffLng! }}
                geometry={quote.geometry}
              />
            )}

            <div className="pt-2 space-y-2 border-t border-neutral-700">
              <p className="text-sm font-semibold text-neutral-300">Mode de paiement</p>
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" checked={payment === "arrival"} onChange={() => { setPayment("arrival"); setDeposit(0); }} />
                Payer à l&apos;arrivée
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
                  <p>
                    Acompte à verser pour confirmer :{" "}
                    <b className="text-emerald-400">{deposit} €</b> (30% du total).
                  </p>
                  <p className="text-red-400/90">
                    L&apos;acompte est <b>non remboursable</b>, y compris en cas d&apos;annulation,
                    quelle qu&apos;en soit la raison.
                  </p>
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
      </form>
    </main>
  );
}
