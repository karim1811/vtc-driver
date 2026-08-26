# VTC Driver — variables d'environnement

Ces variables se configurent dans le dashboard Render (Environment) pour la prod.
Le mode démo s'active automatiquement si `STRIPE_SECRET_KEY` est absent.

## Obligatoires (déjà en place)
- `DATABASE_URL` — chaîne Neon (persistance). Si absente, le mode fichier local est utilisé.
- `DRIVER_PASSWORD` — mot de passe de l'espace chauffeur (prod).

## Paiement Stripe (optionnel — mode démo sinon)
- `STRIPE_SECRET_KEY` — clé secrète Stripe (sk_live_... ou sk_test_...).
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE` — clé publiable (pk_live_... / pk_test_...).
  Le bouton "Payer en avance" côté client ne s'active qu'avee cette clé.
- `STRIPE_WEBHOOK_SECRET` — secret du webhook Stripe (whsec_...).
  À configurer dans le dashboard Stripe : endpoint -> URL `https://<ton-app>.onrender.com/api/webhook/stripe`.
- `APP_URL` — URL publique de l'app (ex `https://vtc-driver.onrender.com`), utilisée pour les retours Stripe.

## Notes
- Acompte = encaissé par Stripe à la réservation (paiement "en avance") OU par le chauffeur
  au bouton "Présence confirmée" (paiements "à l'arrivée"/"espèces").
- Le solde reste en suspens dans l'app jusqu'à la clôture de la course.
- En mode démo, aucun appel réseau Stripe n'est fait ; la logique métier est identique.
