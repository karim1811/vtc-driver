import Link from "next/link";

const features = [
  { t: "Prix connu à l'avance", d: "Le montant de votre course vous est annoncé avant toute réservation." },
  { t: "Sur invitation", d: "Clientèle fermée, service personnalisé et direct." },
  { t: "Suivi en direct", d: "Vous suivez votre chauffeur en temps réel jusqu'à la prise en charge." },
];

const steps = [
  { n: "1", t: "Demandez votre lien", d: "Le chauffeur vous envoie un lien d'invitation personnalisé." },
  { n: "2", t: "Réservez en 1 min", d: "Adresse, heure, devis instantané. Vous validez le prix affiché." },
  { n: "3", t: "Suivez en direct", d: "Le chauffeur partage sa position, vous le voyez arriver." },
];

export default function Home() {
  return (
    <main className="flex-1">
      <section className="mx-auto max-w-5xl px-6 py-16 text-center sm:py-24">
        <span className="inline-block rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-300">
          VTC privé · sur invitation
        </span>
        <h1 className="mt-6 text-4xl font-bold tracking-tight sm:text-6xl">
          Le <span className="text-emerald-400">transporteur VTC</span>.
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-neutral-400">
          Réservation VTC sur invitation. Prix de votre course connu à
          l&apos;avance, paiement à l&apos;arrivée ou en avance.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/reserver"
            className="rounded-xl bg-emerald-500 px-6 py-3 font-semibold text-black hover:bg-emerald-400"
          >
            Réserver une course
          </Link>
          <Link
            href="/chauffeur"
            className="rounded-xl border border-neutral-700 px-6 py-3 text-neutral-300 hover:bg-neutral-900"
          >
            Espace chauffeur
          </Link>
        </div>
      </section>

      {/* Comment ça marche */}
      <section className="mx-auto max-w-5xl px-6 pb-12">
        <h2 className="mb-6 text-center text-xl font-semibold">Comment ça marche</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {steps.map((s) => (
            <div key={s.n} className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-5">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-emerald-500/15 text-sm font-bold text-emerald-300">
                {s.n}
              </span>
              <h3 className="mt-3 font-semibold text-neutral-100">{s.t}</h3>
              <p className="mt-1 text-sm text-neutral-400">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 pb-20">
        <div className="grid gap-4 sm:grid-cols-3">
          {features.map((f) => (
            <div key={f.t} className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-5">
              <h3 className="font-semibold text-emerald-400">{f.t}</h3>
              <p className="mt-1 text-sm text-neutral-400">{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-neutral-800 py-6 text-center text-xs text-neutral-600">
        VTC — app installable (PWA). Ajoutez-la à l&apos;écran d&apos;accueil.
      </footer>
    </main>
  );
}
