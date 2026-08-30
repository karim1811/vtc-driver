"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import MapView from "@/components/MapView";
import AddressInput from "@/components/AddressInput";
import type { Suggestion } from "@/components/AddressInput";

type WeekdaySlot = { day: number; start: string; end: string };
type Availability = { open: boolean; weekly: WeekdaySlot[] };
type Quote = {
  distanceKm: number; price: number; durationMin: number; dept?: string;
  pickupLat?: number; pickupLng?: number; dropoffLat?: number; dropoffLng?: number;
  geometry?: [number, number][]; routed?: boolean; pickupLabel?: string; dropoffLabel?: string;
};

const DAYS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

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
  // Coords issues de l'autocomplétion Photon (évite de re-géocoder le texte côté serveur).
  const [pickupSug, setPickupSug] = useState<Suggestion | null>(null);
  const [dropoffSug, setDropoffSug] = useState<Suggestion | null>(null);
  const [geom, setGeom] = useState<[number, number][] | undefined>(undefined);

  // Date + heure
  const [date, setDate] = useState("");
  const [hour, setHour] = useState("09:00");

  // Disponibilité publique + sélection de créneau
  const [av, setAv] = useState<Availability | null>(null);

  // Statut Stripe : vrai flag serveur (STRIPE_ENABLED) — pas process.env côté client.
  const [stripeOnline, setStripeOnline] = useState(false);

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
    fetch("/api/stripe-status")
      .then((r) => r.json())
      .then((d) => setStripeOnline(!!d.online))
      .catch(() => {});
  }, []);

  // Pré-remplissage du code depuis l'URL (?code=XXXX) — lien d'invitation chauffeur.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const c = params.get("code");
    if (c) setCode(c.toUpperCase());
  }, []);

  // Disponibilité publique (plages hebdo) chargée plus haut via /api/availability/public.
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
    // Priorité aux coords de l'autocomplétion (jamais re-géocodées), sinon au pin map, sinon texte.
    const pickupPayload = pickupSug ? `${pickupSug.lat},${pickupSug.lng}` : pickupPt ? `${pickupPt.lat},${pickupPt.lng}` : pickup;
    const dropoffPayload = dropoffSug ? `${dropoffSug.lat},${dropoffSug.lng}` : dropoffPt ? `${dropoffPt.lat},${dropoffPt.lng}` : dropoff;
    const r = await fetch("/api/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pickup: pickupPayload, dropoff: dropoffPayload, pickupAt }),
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
    const pickupPayload = pickupSug ? `${pickupSug.lat},${pickupSug.lng}` : `${pickupPt.lat},${pickupPt.lng}`;
    const dropoffPayload = dropoffSug ? `${dropoffSug.lat},${dropoffSug.lng}` : `${dropoffPt.lat},${dropoffPt.lng}`;
    const r = await fetch("/api/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pickup: pickupPayload,
        dropoff: dropoffPayload,
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
    const pickupPayload = pickupSug ? `${pickupSug.lat},${pickupSug.lng}` : pickupPt ? `${pickupPt.lat},${pickupPt.lng}` : pickup;
    const dropoffPayload = dropoffSug ? `${dropoffSug.lat},${dropoffSug.lng}` : dropoffPt ? `${dropoffPt.lat},${dropoffPt.lng}` : dropoff;
    const body: any = {
      pickup: pickupPayload,
      dropoff: dropoffPayload,
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

  // Stripe est actif côté client SEULEMENT si le serveur le confirme
  // (STRIPE_ENABLED = !!STRIPE_SECRET_KEY). On ne lit pas process.env côté
  // client (Next ne l'inline pas fiablement dans le bundle) : on utilise le
  // flag serveur renvoyé par /api/stripe-status.
  const onlineActive = stripeOnline;

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
          ) : av.weekly.length > 0 ? (
            <>
              <p className="text-neutral-300 font-semibold">Le chauffeur est disponible ces jours (heures locales) :</p>
              <div className="flex flex-wrap gap-2">
                {av.weekly.map((s) => (
                  <span key={s.day + s.start + s.end} className="px-3 py-1 rounded-lg text-xs bg-neutral-900 border border-neutral-700">
                    {DAYS[s.day]} · {s.start}–{s.end}
                  </span>
                ))}
              </div>
              <p className="text-emerald-400 text-xs">Réservez une course sur l'une de ces plages (et à une heure comprise dedans).</p>
            </>
          ) : (
            <p className="text-emerald-400 text-xs">Le chauffeur accepte les courses sur l'ensemble de ses jours ouverts.</p>
          )}
        </div>

        {/* Adresses */}
        <div className="space-y-3">
          <AddressInput label="Adresse de départ" value={pickup} onChange={(v) => { setPickup(v); setPickupPt(null); setPickupSug(null); setQuote(null); }} onSelect={(s) => { setPickupPt({ lat: s.lat, lng: s.lng }); setPickupSug(s); }} required />
          <AddressInput label="Adresse d'arrivée" value={dropoff} onChange={(v) => { setDropoff(v); setDropoffPt(null); setDropoffSug(null); setQuote(null); }} onSelect={(s) => { setDropoffPt({ lat: s.lat, lng: s.lng }); setDropoffSug(s); }} required />
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
                <input type="radio" checked={payment === "arrival"} onChange={() => { setPayment("arrival"); setDeposit(Math.round(quote.price * 0.1 * 100) / 100); }} />
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

              {payment === "arrival" && (
                <div className="rounded-lg bg-neutral-900 p-3 text-xs text-neutral-400 space-y-1">
                  <p>Acompte à verser maintenant pour confirmer : <b className="text-emerald-400">{deposit} €</b> (10% du total).</p>
                  <p className="text-red-400/90">L'acompte est <b>non remboursable</b>, y compris en cas d'annulation, quelle qu'en soit la raison.</p>
                  <p>Le solde ({Math.round((quote.price - deposit) * 100) / 100} €) est réglé en espèces ou carte au chauffeur.</p>
                </div>
              )}
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
