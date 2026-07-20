import { Suspense } from "react";
import ConfirmationInner from "./ConfirmationClient";

export default function ConfirmationPage() {
  return (
    <Suspense fallback={<div className="flex-1 flex items-center justify-center">Chargement...</div>}>
      <ConfirmationInner />
    </Suspense>
  );
}
