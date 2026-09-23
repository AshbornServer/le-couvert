# Le Couvert — réservations des soupers de clubs

Réservation en ligne pour les soupers et petits événements des clubs, écoles et
asbl en Belgique francophone. Un seul code, un seul serveur, un espace par club.

**En ligne : https://reservation.merchez.site**

- **Stack** : Node.js + TypeScript, SvelteKit 2 (adapter-node), SQLite (Drizzle
  ORM + better-sqlite3). Aucun framework CSS, aucune IA.
- **Direction artistique** : le ticket de souper à souche détachable — encre
  bleu-noir, papier, rouge carnet, jaune bristol, ombres franches décalées. Une
  seule police web (Bricolage Grotesque, hébergée dans `static/polices/`), pour
  les titres uniquement. Tout est dans `src/app.css` ; détail dans
  `docs/prompt-ux-ui.md`.
- **Port** : 5000, servi par `cloudflared` (tunnel `rpi`) sur
  `reservation.merchez.site`.
- **Service** : PM2, `pm2 start ecosystem.config.cjs`.
- **Montants** : toujours en centimes (entiers).
- **Langue** : français de Belgique, mots simples.

## Démarrer

```bash
npm install
cp .env.example .env     # puis remplir
npm run db:seed          # données de démonstration (FC Exemple)
npm run dev              # http://localhost:5000
```

En production :

```bash
npm run build
pm2 start ecosystem.config.cjs   # les migrations s'appliquent au démarrage
```

`ecosystem.config.cjs` lit `.env` lui-même et le passe en variables
d'environnement : en production SvelteKit ne lit pas `.env`, et l'option
`env_file` de PM2 n'est pas fiable d'une version à l'autre.

**Un seul processus, volontairement** (`instances: 1`, `exec_mode: 'fork'`) :
l'écriture SQLite et la vérification des dernières places supposent un seul
écrivain. Voir la note de fin de `docs/audit-logique.md`.

## Scripts

| Commande | Ce qu'elle fait |
| --- | --- |
| `npm run dev` | serveur de développement, port 5000 |
| `npm run build` / `npm start` | build puis démarrage en production |
| `npm run check` | vérification TypeScript + Svelte |
| `npm run db:generate` | génère une migration après modification du schéma |
| `npm run db:seed` | (re)crée le club de démonstration « FC Exemple » |
| `npm run lien <email>` | imprime un lien de connexion, sans passer par l'e-mail |

Les migrations du dossier `drizzle/` sont appliquées automatiquement au
démarrage du serveur : rien à lancer à la main sur la machine de production.

## Les quatre espaces

| Adresse | Pour qui | Contenu |
| --- | --- | --- |
| `/` | tout le monde | la page de présentation, et le formulaire de demande d'un club |
| `/admin` | super-admin | demandes à traiter, clubs, commissions, liaison Mollie |
| `/gestion` | organisateur du club | ses soupers, les inscrits, le scanner |
| `/{club}/{evenement}` | le public | la page de réservation |

### De la demande au club ouvert

Le formulaire de la page d'accueil enregistre une demande dans
`demandes_club`. Elle s'affiche en tête de `/admin`, et **un clic** sur
« Ouvrir le club » crée le club, crée le compte de l'organisateur, lui envoie
son invitation et marque la demande traitée.

Le club est déduit de la session pour l'organisateur : il n'a pas de slug à
retenir. Le public, lui, passe par l'adresse du club.

### Cloisonnement des clubs

- L'organisateur est rattaché à **un** club (`utilisateurs.club_id`) ; toutes
  les requêtes de `/gestion` partent de ce `club_id`.
- `/admin` est réservé au rôle `superadmin` (403 sinon).
- Les slugs de la plateforme (`admin`, `gestion`, `connexion`, …) sont réservés
  et refusés comme slug de club (`src/lib/slug.ts`).

## Connexion

Pas de mot de passe. L'utilisateur tape son adresse, reçoit un lien valable
30 minutes et à usage unique, puis une session de 30 jours.

- Les adresses listées dans `EMAILS_SUPERADMIN` sont créées automatiquement à
  la première demande de lien.
- Les organisateurs sont créés par le super-admin (création du club) ou invités
  depuis la fiche du club.
- La réponse du formulaire est la même que l'adresse existe ou non, et les
  demandes sont limitées à 5 par quart d'heure (par adresse et par IP).

En développement, `FOURNISSEUR_MAIL="console"` affiche l'e-mail — donc le lien —
dans le terminal du serveur. Encore plus direct, sans aucun e-mail :

```bash
npm run lien organisateur@fc-exemple.be
```

Sans argument, le script liste les comptes connus. Pour envoyer pour de vrai,
mettre `FOURNISSEUR_MAIL="brevo"` (ou `"resend"`) et la clé dans `CLE_API_MAIL`.

## Structure

```
src/
  lib/
    argent.ts             euros() / centimes()
    communication.ts      communication structurée belge (+++.../.../...+++)
    dates.ts              « samedi 17 octobre 2026 », « 18 h 30 »
    slug.ts               slugs et segments réservés
    ChoixCouleur.svelte   6 couleurs proposées + sélecteur
    marque.ts             le nom du produit, à un seul endroit
    server/
      config.ts           toute la configuration (.env)
      db/schema.ts        le schéma Drizzle
      db/index.ts         la base + migrations au démarrage
      auth.ts             liens magiques, sessions, invitations
      mail.ts             console / Brevo / Resend
      televersement.ts    images (4 Mo max), servies par /televersements/…
      rgpd.ts             purge des participants 12 mois après l'événement
  routes/
    connexion/            demande de lien, puis /connexion/verifier
    admin/                super-admin
    mollie/retour/        retour OAuth du club (hors /admin : c'est le club qui accepte)
    mollie/fait/          la page qui accueille le club après son accord
    gestion/
      evenements/
        nouveau/          modèles, duplication, page vide
        [id]/             l'écran de création, sur une seule page
        [id]/brouillon/   enregistrement automatique (JSON)
        [id]/image/       téléversement affiche et logo
        [id]/qr/          le QR code en PNG
        [id]/bord/        le tableau de bord de l'événement
        [id]/cuisine/     le récap cuisine, imprimable en A4
        [id]/export.csv/  l'export Excel
        [id]/export.pdf/  la liste d'entrée, triée par nom
        [id]/scanner/     le mode entrée (caméra + recherche par nom)
    [club]/[evenement]/   la page publique de réservation
    r/[token]/            « ma réservation » : ticket, agenda, annulation
    api/mollie/webhook/   les notifications de paiement
    admin/mollie/retour/  le retour d'autorisation Mollie Connect
    televersements/       service des images téléversées
```

Le composant `src/lib/PageEvenement.svelte` est **le même** pour la page
publique et pour l'aperçu en direct de l'écran de création (`apercu={true}`
rend tout inerte) : ce que voit l'organisateur est exactement ce que verra le
participant.

## RGPD

- Rien d'autre que le nécessaire : nom, prénom, e-mail, téléphone facultatif,
  commande, service.
- Aucune donnée de carte n'est enregistrée : Mollie s'en charge.
- Les réservations sont supprimées automatiquement 12 mois après la date de
  l'événement (`src/lib/server/rgpd.ts`, au démarrage puis une fois par jour).
- Page publique : `/confidentialite`.

## Données de démonstration

`npm run db:seed` crée :

- le club **FC Exemple** (`/fc-exemple`), commission 0,20 € payée par le
  participant, Mollie marqué comme relié ;
- l'événement **Souper spaghetti**, un samedi soir, deux services (18 h 30 et
  20 h 30, 120 places chacun), menu bolo adulte 16 €, végé adulte 15 €, enfant
  8 €, tiramisu 4 € ;
- deux options : « Allergies ou remarque » et « Je souhaite être à table
  avec… » ;
- **40 réservations** mêlant payé / en attente, en ligne / virement / liquide,
  en ligne / au guichet ;
- deux organisateurs : `organisateur@fc-exemple.be` et
  `tresorier@fc-exemple.be`.

Le tirage est déterministe : la démonstration est toujours la même.

## Créer un événement

Un seul écran qui défile, en sept sections numérotées : l'essentiel, les
services, le menu et les tarifs, les questions, la réservation, l'apparence, la
publication. Sur ordinateur l'aperçu de la page publique est collé à droite ;
sur téléphone un bouton « Voir l'aperçu » l'ouvre en plein écran.

- **Enregistrement automatique** une seconde après la dernière frappe, avec
  l'heure du dernier enregistrement affichée en haut.
- **Modèles en un clic** : souper spaghetti, souper boulets, moules-frites,
  barbecue, fancy-fair (`src/lib/modeles.ts`).
- **Dupliquer un événement précédent** : tout est recopié sauf la date et les
  réservations.
- Le **slug suit le titre** tant que l'événement est en brouillon ; après
  publication il est figé, pour ne pas casser les liens distribués.
- **Publication** : la liste de ce qui manque encore est affichée en clair, le
  bouton reste inactif tant qu'il manque quelque chose. Ensuite : lien public,
  bouton « Copier le lien » et QR code en PNG 1000 × 1000.

### Ce qui est verrouillé

Pour ne jamais perdre une réservation déjà prise :

- une ligne de menu **déjà commandée** ne peut plus être retirée (mettre son
  stock à 0 pour arrêter de la vendre) ;
- un service où des gens sont **déjà inscrits** ne peut plus être retiré ;
- un événement qui a des réservations ne peut plus être dépublié ni supprimé.

Ces trois règles sont appliquées côté serveur *et* montrées dans l'écran, bouton
désactivé et raison écrite.

## Étapes de construction

1. ✅ Base de données, espaces clubs, connexion par lien magique, super-admin.
2. ✅ Page « Créer un événement » (aperçu en direct, modèles de départ).
3. ✅ Page publique de réservation (sur place et virement).
4. ✅ Paiement Mollie Connect (commission automatique, webhooks).
5. ✅ Tableau de bord (récap cuisine, réservation manuelle, exports).
6. ✅ Tickets QR, e-mail de confirmation, scanner, rappels.
7. ✅ Page de présentation publique, audit de sécurité et de logique, passe UX/UI.

## Les audits

Trois agents ont relu le projet de fond en comble. Leurs conclusions, et ce qui
a été appliqué :

| Document | Contenu |
| --- | --- |
| `docs/prompt-ux-ui.md` | l'audit des 20 écrans : contraste, tailles, ce qui a été retiré, et ce qu'il ne faut pas toucher |
| `docs/prompt-onboarding.md` | les trois parcours comptés en clics et en champs, les culs-de-sac bouchés |
| `docs/audit-logique.md` | **19 défauts réels**, dont trois failles de sécurité vérifiées par test |

Les trois ouvrent sur une section « ce qui reste ouvert » : rien n'y est caché.

## Sécurité

Trois points qui méritent d'être connus avant toute modification :

1. **Les actions de `/admin` sont gardées dans `hooks.server.ts`**, pas
   seulement dans `+layout.server.ts` : SvelteKit exécute une action de
   formulaire **avant** les `load`. Chaque action revérifie aussi le rôle
   (`exigerSuperadmin`).
2. **`lireParToken()` ne renvoie jamais la ligne `clubs` brute** : elle
   contient les jetons OAuth Mollie, et le dossier part dans le HTML d'une page
   publique.
3. **Le webhook Mollie est le seul endroit qui décide qu'une réservation est
   payée**, et il relit toujours l'état chez Mollie. Il ne fait jamais
   confiance au corps reçu.

## Réserver (la page publique)

`monsite.be/{club}/{evenement}` — une seule page, sans compte à créer.

- Boutons − et + de 52 px, total recalculé en direct, récapitulatif avant
  validation.
- Choix du service, les services complets sont grisés.
- Places restantes affichées seulement en dessous de 20, pour ne pas décourager
  au début.
- Les prix et les totaux sont **toujours recalculés côté serveur** à partir de
  la base : le navigateur ne fait qu'envoyer des quantités.

### Anti-surréservation

Une place est comptée occupée quand la réservation est payée, ou en attente de
paiement qui tient encore :

| Moyen | Tient la place |
| --- | --- |
| sur place, virement, liquide | jusqu'à l'annulation |
| en ligne | **15 minutes**, le temps de payer |

Passé le quart d'heure, la réservation devient « expirée » et les places
repartent au pot commun (`src/lib/server/places.ts`). Les capacités sont
vérifiées à trois niveaux : l'événement, le service, et le stock de chaque ligne
de menu.

## Après la réservation

- Page de confirmation, puis e-mail avec le détail, le ticket QR en pièce
  jointe et le fichier `.ics` pour l'agenda.
- `/r/{jeton}` : « ma réservation », sans mot de passe — revoir, réimprimer le
  ticket, se faire renvoyer l'e-mail, ou annuler jusqu'à la date limite.
- `/r/{jeton}/ticket` : ticket propre à l'écran et à l'impression.
- Un paiement en ligne annulé est remboursé automatiquement par Mollie.
- La communication structurée belge des virements est calculée avec ses deux
  chiffres de contrôle (`src/lib/communication.ts`).

## Paiement — Mollie Connect

`.env` : `MOLLIE_CLIENT_ID`, `MOLLIE_CLIENT_SECRET`, `MOLLIE_REDIRECTION`.

1. Le super-admin clique sur « Relier le compte Mollie du club » depuis la fiche
   du club. Le `state` OAuth est signé (HMAC) et valable une heure : personne ne
   peut relier un autre club.
2. Le club accepte chez Mollie. Les jetons, l'organisation et le profil sont
   enregistrés ; le jeton d'accès est rafraîchi tout seul quand il expire.
3. Chaque paiement est créé **avec le jeton du club** : l'argent arrive sur son
   compte. La commission part en `applicationFee`, plafonnée pour ne jamais
   dépasser le montant payé.
4. Le webhook `/api/mollie/webhook` ne fait jamais confiance au corps reçu :
   il relit l'état du paiement chez Mollie. C'est le seul endroit qui décide
   qu'une réservation est payée.

Sans clés Mollie, le paiement en ligne répond un message clair et le reste de la
plateforme fonctionne normalement (sur place et virement).

## Tableau de bord de l'organisateur

`/gestion/evenements/{id}/bord`

- Chiffres en direct : réservations, couverts sur capacité, encaissé, reste à
  encaisser.
- **Récap cuisine** : le total par plat et par service, en gros
  (`/cuisine`, mis en page pour une feuille A4).
- Liste des réservations avec recherche (nom, e-mail, communication) et filtres
  (payé, à payer, annulé, par service).
- **Réservation manuelle** pour quelqu'un qui téléphone ou qui paie à la
  caisse : payé en liquide, à payer, ou virement reçu.
- Suivi des paiements : marquer payé, repasser à « à payer », et rapprocher un
  virement en recopiant sa communication structurée.
- Annulation avec remboursement Mollie et e-mail au participant.
- Exports : **CSV** (point-virgule + BOM, s'ouvre directement dans Excel, avec
  protection contre les formules) et **PDF** A4 trié par nom, avec une case à
  cocher par personne pour l'entrée.

## Mode entrée — le scanner

`/gestion/evenements/{id}/scanner`

- La caméra du téléphone, décodage QR en JavaScript (`jsqr`), donc aussi sur
  iPhone.
- **Écran vert** : nom, couverts, service, commande, remarques, et le montant à
  encaisser si ce n'est pas encore payé.
- **Écran rouge** : déjà scanné (avec l'heure), annulé, inconnu, ou ticket d'un
  autre événement.
- Double scan impossible même à deux téléphones : le marquage est conditionnel
  en base.
- Recherche par nom en secours, sans réseau : la liste part avec la page.
- Compteur « entrés / attendus » en haut.

## Tâches automatiques

Lancées au démarrage puis toutes les heures (`src/hooks.server.ts`), et
rejouables d'un clic depuis `/admin` :

| Quand | Quoi |
| --- | --- |
| 2 jours avant | e-mail de rappel à chaque participant (avec ce qui reste à payer) |
| le matin même | récapitulatif aux organisateurs : couverts, montants, récap cuisine |
| le lendemain | l'événement passe en « terminé » |
| en continu | libération des blocages de paiement périmés |
| 12 mois après | purge RGPD des données participants |

Chaque envoi est marqué en base : relancer la tâche n'envoie jamais deux fois le
même message.
