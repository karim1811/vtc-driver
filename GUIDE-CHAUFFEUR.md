# Mode d'emploi VTC — pour le chauffeur (clientèle privée)

App : https://vtc-driver.onrender.com

Ce guide explique comment utiliser l'application avec tes clients.
Deux rôles : toi (le chauffeur, espace "Chauffeur") et le client (qui réserve).

⚠️ IMPORTANT (état actuel) : l'application est en MODE TEST Stripe.
=> Les paiements par carte ne sont PAS réels pour l'instant.
=> Pour tester le parcours, utilise la carte de test : 4242 4242 4242 4242,
   CVC 123, date future (ex 12/30). Aucun argent ne bouge.
=> Quand Karim basculera en mode "live" (clés réelles), tes clients paieront
   avec leur vraie carte et l'argent arrivera sur le compte Stripe.

────────────────────────────────────────────────────────
1) LE CLIENT RÉSERVE (à lui envoyer ou faire sur place)
────────────────────────────────────────────────────────
- Le client va sur https://vtc-driver.onrender.com/reserver
- Il entre le CODE D'INVITATION que tu lui donnes (ex : KARIMVTC, ou un code
  que tu crées dans ton espace chauffeur).
- Il met son nom + téléphone, puis "Accéder".
- Il saisit l'adresse de départ et d'arrivée, choisit la date/heure.
- Il clique "Obtenir le devis" : le PRIX est affiché AVANT de réserver
  (tarif fixe connu, pas de surprise).
- Mode de paiement proposé :
    • "Payer à l'arrivée"        -> acompte 10 % à verser maintenant,
                                    le reste réglé au chauffeur.
    • "Payer en avance (Stripe)" -> paiement sécurisé par carte immédiat
                                    (tout le prix est payé à la réservation).
    • "Espèces (acompte demandé)"-> acompte 30 % maintenant, reste en espèces.
- Il clique "Confirmer la réservation".
  - Si "Payer en avance" : il est redirigé vers la page Stripe (carte).
    Une fois payé, il revient sur "Réservation confirmée".
  - Sinon : réservation confirmée, acompte à régler plus tard.

────────────────────────────────────────────────────────
2) TON ESPACE CHAUFFEUR
────────────────────────────────────────────────────────
- Va sur https://vtc-driver.onrender.com/chauffeur
- Connecte-toi avec le mot de passe que Karim t'a donné.
- Tu vois la liste des courses (à venir, en cours, terminées).
- Actions sur une course :
    • "Présence confirmée" -> tu es arrivé au point de prise en charge.
      Cela ENCaisSE l'acompte (il est marqué payé dans l'app).
      Le solde reste en suspens jusqu'à la fin.
    • "Terminer" -> la course est finie, le solde est soldé.
    • "Annuler"  -> annule la course.
- Créer un code d'invitation pour un nouveau client :
    • Dans ton espace, section "Codes", clique pour générer un code.
    • Donne ce code au client pour qu'il puisse réserver.

────────────────────────────────────────────────────────
3) CONTACT CLIENT <-> CHAUFFEUR
────────────────────────────────────────────────────────
- Dans l'espace chauffeur, tu as le téléphone du client.
- Le client a ton lien Appel / WhatsApp depuis sa confirmation.
- Tu peux le contacter directement pour le point de rendez-vous.

────────────────────────────────────────────────────────
4) MODE TEST vs MODE LIVE (à comprendre avant d'utiliser avec de vrais clients)
────────────────────────────────────────────────────────
L'application fonctionne dans deux modes, selon les clés Stripe configurées :

• MODE TEST (actuel) — pour essayer l'application SANS argent réel.
  - Utilise la carte de test : 4242 4242 4242 4242, CVC 123, date future (ex 12/30).
  - Aucun argent ne bouge, aucun vrai paiement n'est encaissé.
  - Le bouton "Payer en avance" marche mais ne prélève RIEN.
  - À utiliser uniquement pour te familiariser avec le parcours.

• MODE LIVE — pour encaisser de VRAIS paiements de vrais clients.
  - Il faut des clés Stripe LIVE (sk_live_... / pk_live_...) + un webhook live,
    configurées par Karim dans le tableau de bord (Render + Stripe).
  - Là, une carte client réelle est débitée et l'argent arrive sur le compte
    Stripe relié (frais Stripe prélevés : ~1,4 % + 0,25 € par paiement en France).
  - La carte 4242 NE MARCHE PLUS en mode live (c'est une carte de test).

⚠️ Ne donne PAS ce logiciel à de vrais clients payants tant que Karim n'a pas
   basculé l'application en mode LIVE. En mode test, aucun paiement n'est réel.

────────────────────────────────────────────────────────
5) PASSER EN MODE LIVE (pour un chauffeur qui veut s'en servir pour de vrai)
────────────────────────────────────────────────────────
Si tu es chauffeur et veux utiliser l'app avec ta clientèle payante :
1. Crée un compte Stripe (dashboard.stripe.com) et complète la vérification
   (identité + RIB) pour activer le mode LIVE.
2. Dans Stripe, bascule "Viewing test data" sur OFF (mode live).
3. Récupère tes clés LIVE : Secret key (sk_live_...) et Publishable key (pk_live_...).
4. Crée un webhook live pointant vers :
   https://vtc-driver.onrender.com/api/webhook/stripe
   en écoutant l'événement "checkout.session.completed", et récupère le
   signing secret (whsec_...).
5. Donne ces 3 valeurs à Karim : il les configure dans l'app (Render + .env).
   Après redéploiement, le mode LIVE est actif et tes clients paient pour de vrai.
6. Tu peux suivre tes paiements dans ton tableau de bord Stripe (paiements,
   remboursements, virements vers ton compte bancaire).

────────────────────────────────────────────────────────
6) À SAVOIR
────────────────────────────────────────────────────────
- Un seul chauffeur = pas deux courses qui se chevauchent (le système bloque).
- L'acompte est NON REMBOURSABLE (indiqué au client avant réservation).
- En mode test, utilise UNIQUEMENT la carte 4242 4242 4242 4242 pour les essais.

────────────────────────────────────────────────────────
7) PROBLÈME ?
────────────────────────────────────────────────────────
- Le bouton "Payer en avance" est grisé ? -> le mode Stripe n'est pas actif
  (encore en démo) : le client paie à l'arrivée ou en espèces.
- Une course ne s'affiche pas ? -> recharge la page, ou reconnecte-toi.
- Question / bug : contacte Karim.
