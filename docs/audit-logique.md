# Audit de cohérence fonctionnelle

Mené par un agent dédié sur `src/lib/server/**`, toutes les actions, toutes les
migrations et le script de démonstration. **19 défauts réels**, tous corrigés
sauf mention contraire.

---

## Sécurité — trois failles vérifiées par test

### 1. Toutes les actions de `/admin` s'exécutaient sans être connecté

SvelteKit exécute une action de formulaire **avant** les `load`. Le garde-fou
vivait dans `+layout.server.ts` : il arrivait trop tard.

Reproduit en une commande : un `POST` anonyme sur `/admin/clubs/nouveau` créait
un club **et** envoyait un accès organisateur à l'adresse de l'attaquant. Un
`POST` sur `?/supprimer` avec le slug public effaçait club, événements,
réservations et tickets.

Corrigé à deux niveaux : un garde dans `hooks.server.ts` pour toute méthode
autre que `GET` sous `/admin`, **et** `exigerSuperadmin(locals)` en première
ligne des huit actions. Revérifié : 403 sur les trois scénarios.

### 2. Les jetons OAuth Mollie du club partaient dans le navigateur

`lireParToken()` renvoyait la ligne `clubs` entière — donc
`mollie_jeton_acces` et `mollie_jeton_rafraichissement` — et ce dossier était
sérialisé dans le HTML de `/r/{jeton}`, une page **publique**. Même fuite sur
la fiche du club, juste sous le commentaire « Le jeton d'accès Mollie ne quitte
jamais le serveur ».

N'importe qui à qui un participant transférait son lien pouvait créer des
paiements et des remboursements sur le compte du club.

Corrigé : `lireParToken` sélectionne explicitement `id, slug, nom, logo,
couleur, commission_centimes, frais_payes_par` plus un booléen `mollie_relie` ;
`creerPaiement` relit les jetons en base ; la fiche admin retire les deux
colonnes avant de renvoyer. Revérifié : zéro occurrence dans le HTML.

### 3. Un SVG téléversé s'exécutait dans l'origine de l'application

`image/svg+xml` était accepté et servi tel quel, avec un cache d'un an. Un SVG
peut contenir un `<script>`.

Corrigé : SVG retiré des formats acceptés, et les images téléversées sont
servies avec `content-security-policy: default-src 'none'; sandbox` et
`x-content-type-options: nosniff`.

---

## Argent

| # | Défaut | Conséquence chiffrée |
| --- | --- | --- |
| 5 | la commission était **recalculée** au moment du paiement, pas reprise de la réservation | club à 20 c passé à 50 c entre-temps : le club perdait 1,20 € sur une réservation de 4 couverts. La commission figée à la réservation est maintenant celle qui est prélevée. |
| 6 | la commission du mois valait **toujours 0** pour les clubs en « frais payés par le club » | 300 couverts en ligne = 60 € réellement prélevés, affichés 0,00 €. Les agrégats calculent désormais la commission réelle dans les deux cas. |
| 15 | « encaissé » incluait les frais de réservation, qui n'arrivent jamais sur le compte du club | le tableau de bord et le mail du matin annonçaient 60 € de trop. Devenu « sur le compte du club », frais déduits, avec la part des frais affichée à côté. |
| 16 | un champ commission **vide** remettait la commission à zéro, en répondant « Réglages enregistrés » | refusé maintenant, avec un message. |
| 17 | un total de 0 € en paiement en ligne partait chez Mollie, qui refuse `"0.00"` → 502 | marqué payé directement, sans passer par Mollie. |

---

## Paiements

| # | Défaut | Correction |
| --- | --- | --- |
| 3 | un webhook rejoué **ressuscitait une réservation annulée** : place réoccupée, argent gardé, participant prévenu que c'était annulé | on ne passe à `paye` que depuis `en_attente` ou `expire` ; un paiement arrivé après annulation est journalisé comme « remboursement à faire » |
| 8 | chaque appel à `/payer` créait un **nouveau** paiement et écrasait l'identifiant du précédent — le webhook du premier ne retrouvait plus la réservation, silencieusement | un paiement encore `open` est réutilisé ; un paiement déjà `paid` est synchronisé |
| 9 | `/payer` ignorait le mode choisi **et** le réglage `paiement_en_ligne` : on pouvait payer par carte un événement qui ne l'acceptait pas, et l'annulation ne remboursait alors jamais | les deux sont vérifiés |
| 4 | « marquer payé », « marquer impayé » et le rapprochement de virement n'examinaient pas l'état courant : une réservation **remboursée** repassait à « payé » d'un clic | états vérifiés ; un paiement en ligne remis en attente bascule sur « sur place », sinon sa place restait bloquée pour toujours |

---

## Cohérence des états

**Défaut 10** — l'état `expire` (paiement en ligne abandonné) était traité de
**cinq façons différentes** : le scanner disait « Bienvenue ! » et réclamait le
montant, la page ticket disait « plus valable », le compteur d'annulations et le
filtre « annulé » ne comptaient pas la même chose, et ces réservations étaient
absentes du tableau de bord, du CSV, du PDF et de la liste du scanner — alors
que leur QR était accepté.

Une seule règle tranchée : **`expire` = « ne vient plus »**. Rangé avec les
annulations partout, refusé par le scanner (« Paiement jamais terminé »),
affiché « paiement abandonné » à l'organisateur.

**Défaut 11** — deux comptages de couverts ignoraient le blocage de 15 minutes,
là où deux autres le respectaient : `/gestion` annonçait jusqu'à une heure
durant plus de couverts que le tableau de bord, et « Supprimer » restait refusé
au nom de réservations qui n'occupaient plus rien.

Cause : la condition « cette réservation occupe une place » était écrite
**quatre fois**, dont une variante incomplète. Il n'y en a plus qu'une,
`conditionOccupe()` dans `places.ts`, utilisée par le comptage des places, les
agrégats du tableau de bord et la liste des soupers.

---

## Perte de données

**Défaut 7** — retirer une question effaçait les **réponses déjà données**.
`reservation_options` est en cascade, et le bouton « Enlever » n'avait aucun
verrou, contrairement aux lignes de menu et aux services. Scénario : 40
réservations, 6 allergies saisies, l'organisateur retire la question, et une
seconde plus tard les 6 réponses disparaissent du tableau de bord, du CSV, du
PDF et du scanner. Irrécupérable.

Corrigé : une question déjà répondue n'est jamais supprimée, le bouton est
désactivé et la raison est écrite — « Des participants y ont répondu : l'enlever
effacerait leurs réponses. »

---

## RGPD

**Défaut 12** — la purge annonçait « les totaux de l'événement restent, les
personnes non » et **supprimait toutes les réservations**. Comme tous les
agrégats se calculent depuis cette table, l'historique d'un club tombait à
zéro. Trois manques en plus : le `journal` gardait les noms indéfiniment, les
événements sans date n'étaient jamais purgés, et `purge_le` était réécrit à
chaque passage horaire.

Réécrite : **anonymisation** (`nom` → « Anonyme », prénom, e-mail, téléphone et
note interne vidés), suppression des réponses libres, `scanne_par` vidé,
`purge_le` posé une seule fois, journal élagué au même rythme, et les brouillons
sans date traités sur leur date de création.

---

## Rappels

| # | Défaut | Correction |
| --- | --- | --- |
| 13 | le rappel J-2 disait « le paiement se fait sur place » à **tout le monde**, y compris aux paiements en ligne inachevés, même si l'événement refuse le sur place | un message par moyen de paiement, avec un lien de paiement pour « en ligne » |
| 14 | `jour()` fabriquait la date en **UTC** pour un jour civil belge : après 22 h, l'événement du lendemain recevait « c'est après-demain », et le marqueur d'envoi empêchait ensuite le bon rappel | `jourLocal()` |

---

## Limitation des demandes de lien

**Défaut 19** — la table des demandes ne se vidait jamais (une entrée
définitive par adresse tentée), et `tropDeDemandes(email) || tropDeDemandes(ip)`
court-circuitait : dès le quota de l'e-mail atteint, le compteur d'IP n'était
plus incrémenté, donc une même IP pouvait tourner indéfiniment en changeant
d'adresse.

Corrigé : les deux compteurs sont évalués, la table est purgée dans
`menageAuth()`, et la limite par IP passe à 20 par quart d'heure — une adresse
IP peut couvrir toute une buvette.

---

## Simplifications appliquées

- `marquerModifie()` : **jamais appelée**. Supprimée.
- La condition d'occupation des places : de quatre écritures à une.
- `/admin/mollie/retour` → `/mollie/retour` : ce n'est pas une page
  d'administration.
- `SLUGS_RESERVES` réservait `c`, `ticket`, `aide` — aucune de ces routes
  n'existe. Nettoyé (`mollie` ajouté, lui, existe).

## Simplifications restées ouvertes

- **`communicationValide()` n'est jamais appelée** : le rapprochement de
  virement ne teste que la longueur, donc une saisie de 10 ou 11 chiffres passe
  le premier test pour échouer au second avec « Aucune réservation ». L'utiliser
  donnerait un message juste.
- **La table `journal` est écrite dix fois, lue zéro fois.** Soit une page de
  consultation, soit sa suppression.
- **Colonnes jamais relues** : `clubs.email_contact`, `utilisateurs.nom`,
  `evenements.publie_le`, `evenements.modifie_le`.
- **`dejaVendu()` duplique `stockLignes()`** pour une seule ligne, et est
  appelée dans une boucle : un seul appel avant la boucle remplacerait N
  requêtes.
- **Les trois blocs « supprimer ce qui n'est plus envoyé »** de
  `brouillon/+server.ts` sont le même algorithme trois fois. Un helper partagé
  retirerait une quarantaine de lignes.

---

## Note sur la concurrence

`better-sqlite3` est synchrone, et ni `creerReservation` ni l'enregistrement du
brouillon ne contiennent d'`await` entre leurs lectures et leurs écritures : en
**un seul processus Node**, la dernière place et le brouillon sont protégés de
fait. Rien ne l'est au niveau de la base : **ce code ne doit pas tourner en
cluster ni en plusieurs processus.** C'est pourquoi `ecosystem.config.cjs` fixe
`instances: 1` et `exec_mode: 'fork'`.

Le double scan, lui, est réellement protégé : le marquage est conditionnel
(`isNull` dans le `where`, puis test de `changes`).
