"use client";

import { useSearchParams } from "next/navigation";

export default function ConfirmationInner() {
  const params = useSearchParams();
  const id = params.get("id");
  return (
    <main className="flex-1 flex items-center justify-center px-6 text-center">
      <div className="max-w-md space-y-4">
        <h1 className="text-2xl font-bold text-emerald-400">Réservation confirmée</h1>
        <p>Votre course n°<b>{id}</b> a bien été enregistrée.</p>
        <p className="text-neutral-400 text-sm">
          Le chauffeur la confirmera depuis son espace. Vous recevrez les détails par téléphone.
        </p>
      </div>
    </main>
  );
}
