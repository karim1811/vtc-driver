# VTC Karim — Application de réservation VTC (MVP)

Application **PWA** de réservation VTC pour un seul chauffeur (toi), clientèle **fermée sur invitation**.
Tarif **fixe** connu à l'avance, zone **Paris / Île-de-France (75-95) + Oise (60)**.

Projet open source — sans dépendance payante, déployable gratuitement (Vercel / Render).

## Fonctionnalités (MVP)
- Inscription client par **code d'invitation** (clientèle fermée)
- **Devis tarif fixe** avant réservation (géocodage OpenStreetMap, distance haversine, majoration nocturne)
- Réservation avec **blocage des chevauchements** : un seul chauffeur → pas deux courses en même temps
- **Paiement à l'arrivée** (toujours actif) ou **en avance via Stripe** (optionnel, à configurer)
- **Espace chauffeur** : voir / confirmer / terminer / annuler les courses
- **PWA** installable sur mobile, service worker offline

## Stack
- Next.js 16 (App Router, TypeScript, Tailwind v4)
- Stockage **fichier JSON** (`data/store.json`) — aucune base à installer (marche sur Windows + hébergement gratuit)
- Géocodage Nominatim (OpenStreetMap) — gratuit, sans clé
- Sessions signées HMAC (cookie httpOnly)

## Démarrage local
```bash
npm install
cp .env.example .env        # régler AUTH_SECRET et DRIVER_PASSWORD
npm run dev                 # http://localhost:3000
```
Codes d'invitation par défaut (seed) : `BIENVENUE1`, `KARIMVTC`, `IDF60`.
Espace chauffeur : mot de passe = `DRIVER_PASSWORD` (défaut `changeme`).

## Paiement Stripe (optionnel)
Renseigner `STRIPE_SECRET_KEY` + `NEXT_PUBLIC_STRIPE_PUBLISHABLE` dans `.env`.
Le bouton "payer en avance" s'active automatiquement. (Le checkout complet est à brancher selon tes clés.)

## Déploiement
- **Vercel** : importer le repo, ajouter les variables d'env. Persistance fichier limitée (use KV/DB en prod).
- **Render** : web service Node, `npm install && npm run build && npm start`.

## Structure
```
app/
  page.tsx                 # accueil
  reserver/page.tsx        # flux client (code -> devis -> réservation)
  chauffeur/page.tsx       # espace chauffeur
  confirmation/            # page de confirmation
  api/
    geocode/quote/book     # devis + réservation
    auth/register,logout   # auth client
    driver/login,bookings  # espace chauffeur
lib/
  store.ts                 # store JSON
  geo.ts pricing.ts auth.ts
public/sw.js               # service worker PWA
```

## Roadmap
- Notifications push (courses entrantes)
- Carte interactive (Mapbox) au lieu d'adresse texte
- Persistance DB (Vercel KV / SQLite sur Render)
- Multi-chauffeurs (plus tard)
