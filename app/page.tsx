import Link from "next/link";

export default function Home() {
  return (
    <main className="flex-1 flex flex-col items-center justify-center px-6 text-center gap-8">
      <div className="max-w-xl">
        <h1 className="text-3xl font-bold tracking-tight">VTC Karim</h1>
        <p className="mt-3 text-neutral-400">
          Réservation VTC privée sur Paris / Île-de-France et l&apos;Oise (60).
          Clientèle sur invitation. Tarif fixe connu à l&apos;avance.
        </p>
      </div>
      <div className="flex flex-col gap-3 w-full max-w-xs">
        <Link
          href="/reserver"
          className="rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-semibold py-3 text-center"
        >
          Réserver une course
        </Link>
        <Link
          href="/chauffeur"
          className="rounded-xl border border-neutral-700 hover:bg-neutral-900 py-3 text-center text-neutral-300"
        >
          Espace chauffeur
        </Link>
      </div>
      <p className="text-xs text-neutral-600">
        App installable (PWA) — ajoutez-la à l&apos;écran d&apos;accueil.
      </p>
    </main>
  );
}
