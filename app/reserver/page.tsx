"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ReservrPage() {
  const router = useRouter();
  const [step, setStep] = useState<"auth" | "form">("auth");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [authErr, setAuthErr] = useState("");

  const [pickup, setPickup] = useState("");
  const [dropoff, setDropoff] = useState("");
  const [pickupAt, setPickupAt] = useState("");
  const [payment, setPayment] = useState<"arrival" | "online">("arrival");
  const [quote, setQuote] = useState<null | {
    distanceKm: number; price: number; durationMin: number; dept?: string;
  }>(null);
  const [quoteErr, setQuoteErr] = useState("");
  const [busy, setBusy] = useState(false);

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
    const r = await fetch("/api/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pickup, dropoff, pickupAt }),
    });
    const d = await r.json();
    setBusy(false);
    if (!r.ok) { setQuoteErr(d.error || "erreur"); setQuote(null); return; }
    setQuote(d);
  }

  async function book() {
    setQuoteErr(""); setBusy(true);
    const r = await fetch("/api/book", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pickup, dropoff, pickupAt, payment }),
    });
    const d = await r.json();
    setBusy(false);
    if (!r.ok) { setQuoteErr(d.error || "erreur"); return; }
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

  const onlineActive = !!(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE);

  return (
    <main className="flex-1 flex items-center justify-center px-6 py-8">
      <form onSubmit={(e) => { e.preventDefault(); getQuote(); }} className="w-full max-w-md bg-neutral-900 rounded-2xl p-6 space-y-4">
        <h1 className="text-xl font-semibold">Réserver une course</h1>
        <input className="input" placeholder="Adresse de départ (Paris / IDF / Oise)" value={pickup} onChange={(e) => setPickup(e.target.value)} required />
        <input className="input" placeholder="Adresse d'arrivée" value={dropoff} onChange={(e) => setDropoff(e.target.value)} required />
        <input className="input" type="datetime-local" value={pickupAt} onChange={(e) => setPickupAt(e.target.value)} required />
        <button className="btn" disabled={busy || !pickup || !dropoff || !pickupAt}>{busy ? "..." : "Obtenir le devis"}</button>

        {quoteErr && <p className="text-red-400 text-sm">{quoteErr}</p>}
        {quote && (
          <div className="rounded-xl bg-neutral-800 p-4 space-y-2">
            <p>Distance : <b>{quote.distanceKm} km</b></p>
            <p>Durée estimée : <b>{quote.durationMin} min</b></p>
            <p className="text-emerald-400 text-lg font-bold">Prix fixe : {quote.price} €</p>
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" checked={payment === "arrival"} onChange={() => setPayment("arrival")} />
              Payer à l'arrivée
            </label>
            <label className={`flex items-center gap-2 text-sm ${onlineActive ? "" : "opacity-40"}`}>
              <input type="radio" checked={payment === "online"} onChange={() => setPayment("online")} disabled={!onlineActive} />
              Payer en avance {onlineActive ? "" : "(Stripe à configurer)"}
            </label>
            <button type="button" className="btn w-full" onClick={book} disabled={busy}>Confirmer la réservation</button>
          </div>
        )}
      </form>
    </main>
  );
}
