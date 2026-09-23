# PROMPT UX/UI

Audit mené par un agent dédié sur les 20 écrans du projet, puis appliqué.
Ce document sert de trace : ce qui a été fait, et ce qui reste ouvert.

**Cadre.** Public : un bénévole de 65-75 ans sur téléphone, et un participant
qui réserve en moins d'une minute. Une seule feuille de style
(`src/app.css`), aucune dépendance de style, aucune animation.

Règle de tri : **chaque changement doit retirer quelque chose, ou rendre une
question inutile.**

---

## Ce qui a été appliqué

### 1. Les champs étaient invisibles

`--bord` (`#d7d9d5`) donnait un contraste de **1,42 : 1** sur blanc, là où
WCAG 1.4.11 en demande 3. Tous les champs et tous les boutons secondaires
étaient concernés.

- nouveau jeton `--bord-champ: #8d9298` (**3,14 : 1**) pour les champs et les
  boutons secondaires ;
- `input[type='search']` ajouté à la liste des sélecteurs : les deux champs de
  recherche retombaient au style d'usine du navigateur (≈ 25 px de haut) ;
- `.bouton:disabled` ne joue plus sur l'opacité (blanc sur vert pâli, 2,6 : 1)
  mais sur une vraie paire de couleurs lisibles ;
- le contour de focus est fixé à `var(--encre)` : il dépendait de la couleur du
  club, donc un club en orange clair n'avait presque pas de focus visible ;
- le `−` d'un compteur à zéro disparaissait complètement — le participant
  croyait le bouton cassé.

### 2. Plancher de 17 px, cibles de 48 px

Le projet annonçait 17 px et 48 px minimum, et ne les tenait pas.

| Élément | Avant | Après |
| --- | --- | --- |
| `.aide` (les phrases d'explication) | 15 px | **17 px** |
| `.petit` | 15 px | 16 px |
| `.etiquette` (« payé » / « à payer ») | 14 px | 16 px |
| `.tableau` | 16 px | 17 px |
| en-têtes de tableau | 15 px + MAJUSCULES | 16 px, casse normale |
| `.chiffre .quoi` | 15 px | 17 px |
| liens de retour | ≈ 20 px de haut | classe `.retour`, **48 px** |
| « Se déconnecter » | ≈ 20 px | 48 px |
| boutons Monter/Descendre/Enlever | 44 px | 48 px |

Un seul rayon d'arrondi (`--rayon: 10px`) au lieu de quatre.

### 3. Le message périmé et les doublons

- `/gestion` annonçait au bénévole que « le tableau de bord détaillé et le
  scanner arrivent aux étapes suivantes ». Tout existait. **Supprimé.**
- Deux boutons identiques (« + Nouvel événement » et « Créer mon premier
  événement ») s'affichaient ensemble sur l'écran vide.
- Le tableau à 7 colonnes forçait un défilement latéral sur téléphone :
  remplacé par une **liste**, une cible par ligne.

### 4. La date limite bloquait la publication

`date_limite` était obligatoire pour publier, sans aucune valeur par défaut,
dans un `datetime-local` — le pire contrôle natif sur téléphone — enterré en
section 5. Un bénévole qui ne trouvait pas ce champ ne publiait jamais.

Désormais : **la veille de l'événement à 20 h**, calculée côté serveur *et*
côté écran, affichée en toutes lettres (« Réservations ouvertes jusqu'au
vendredi 16 octobre à 20 h »), avec deux raccourcis (« la veille au soir »,
« 3 jours avant ») et le champ complet seulement si on insiste.

### 5. L'écran de création : 7 sections → 3 + un tiroir

Avec le modèle « souper spaghetti », l'écran demandait **≈ 48 champs et ≈ 40
boutons** pour **8 vraies décisions** (date, heure, adresse, 4 prix, moyen de
paiement). Facteur 6.

Retiré :

| Élément | Pourquoi |
| --- | --- |
| case « compte comme couvert » × 4 | déjà déduite de la catégorie. Du jargon comptable. |
| champ « Stock max » × 4 | derrière une case « Limiter les quantités plat par plat » |
| select « texte libre / case à cocher » × 2 | texte libre suffit partout |
| case « obligatoire » × 2 | personne ne rend obligatoire « être à table avec… » |
| catégorie « autre » | créait un groupe « Autres » sur la page publique |
| section 6 entière (logo, couleur, texte de confirmation) | le club a déjà un logo et une couleur ; le texte a un bon défaut |
| Monter/Descendre sur les services et les questions | 12 boutons. L'ordre n'y compte pas. |
| les deux phrases sur les frais et la commission | l'organisateur ne décide rien là-dessus |
| case « En ligne » quand Mollie n'est pas relié | on ne propose pas une option qui ne marche pas |
| « Recopiez SUPPRIMER » sur un brouillon vide | deux tapes suffisent |

Nouvelle structure : **1. Quand et où · 2. Menu et prix · 3. Comment les gens
paient**, puis un tiroir « Modifier si besoin » (heures de passage, questions,
affiche, places, texte d'accueil).

**Le tiroir n'est pas un menu caché** : son résumé affiche en clair ce qui est
déjà réglé — « 2 heures de passage : 18 h 30 et 20 h 30 · 2 questions :
Allergies…, Être à table avec… · Pas d'affiche · 240 places au total ». Le
bénévole lit, il ne devine pas.

Ajouté, parce que ça retire du travail :

- **une barre collante en haut** avec l'état d'enregistrement et le bouton
  « Publier (2 choses à finir) », dont la liste s'affiche en clair ;
- **un vrai bandeau rouge** quand l'enregistrement échoue, avec un bouton
  « Enregistrer maintenant ». Avant, l'échec se disait en 15 px gris dans un
  coin : on pouvait travailler dix minutes dans le vide ;
- « Partager sur Facebook » à côté du lien et du QR. C'est le canal réel des
  clubs.

### 6. Le tableau de bord n'était pas utilisable au téléphone

- **Le menu caché « Actions »** était le seul chemin pour encaisser ou annuler,
  alors que le cahier des charges dit « pas de menus cachés ». Remplacé par des
  boutons visibles de 48 px sur chaque ligne.
- Le tableau à 7 colonnes devient une **liste de cartes** : nom en 19 px, les
  couverts, le service, le montant, l'état, puis les actions.
- Les deux `select` de filtre et le bouton « Filtrer » sont supprimés : la
  recherche par nom filtre **au fur et à mesure**, sans aller-retour.
- Les exports descendent au pied de la liste, sous « Imprimer et exporter » :
  ils servent une fois par événement.
- **Un vrai état de départ** : quand personne n'a encore réservé, l'écran ne
  montre pas quatre zéros mais le lien public à copier et le QR à télécharger.
- « Note interne » retiré du formulaire d'ajout (14 champs).
- Les annulations ne sont plus du gris barré en 16 px mais un fond gris avec
  une étiquette lisible.

### 7. La page publique

- **Le service est pré-coché** (le premier encore ouvert) : un clic et un
  aller-retour serveur en moins sur le parcours le plus fréquenté.
- **Une barre collante en bas** sur téléphone : le total et le bouton restent
  sous le pouce.
- Le bouton dit ce qui se passe et combien : « Payer 52,00 € » ou
  « Confirmer ma réservation — 52,00 € ».
- Les frais de réservation étaient expliqués **trois fois** : une seule, dans
  le récapitulatif.
- Le téléphone passe derrière « Ajouter mon numéro de téléphone » — le mot
  « facultatif » apparaissait six fois sur la page.
- Le message d'erreur du formulaire a son propre `id`, reçoit le focus et est
  lu par les lecteurs d'écran (avant, le script visait le premier
  `.message.erreur`, donc le bandeau « réservations fermées » du haut).
- La sélection suit la couleur du club (`color-mix`) : un club en rouge avait
  une sélection vert pâle.

### 8. Les états manquants

- `/cuisine` : « Pas encore de commande. Cette feuille se remplira au fur et à
  mesure des réservations. » au lieu d'une feuille blanche à « 0 couverts ».
- Scanner : le bouton dit « Ouverture de la caméra… » et se désactive pendant
  les 1 à 3 secondes de `getUserMedia`. On tapait deux fois.
- Scanner : le compteur « 12 / 240 entrés » passe en 22 px gras. C'est le
  chiffre qu'on regarde toute la soirée.
- `/r/{jeton}` : le titre « Mon ticket d'entrée » pouvait rester seul au-dessus
  du vide ; et « Modifier ma réservation » promettait plus que le seul bouton
  en dessous — devenu « Mon lien personnel ».

### 9. Un seul mot par chose

| Retenu | Remplaçait |
| --- | --- |
| **Enlever** | Retirer, Détacher |
| **Mes soupers** | « Mon club » / « Mes événements » / « + Nouvel événement » |
| **Les inscrits** | « Tableau de bord » |
| **Heures de passage à table** | « Services » (côté organisateur) |
| **Question** | « option », « (facultatif) » systématique |
| **Couverts** (jamais abrégé) | « Couv. », « couv. », « Réserv. » |
| **Liste à cocher (PDF)** / **Liste pour Excel** | « Liste PDF » / « Export Excel (CSV) » |
| **Adresse du site pour ce club** | « Adresse du club », qui voulait dire deux choses |
| **Enregistrer les réglages du club** | « Enregistrer », au milieu de 4 formulaires |
| **paiement abandonné** | « expiré » |
| **dossier Mollie en cours de vérification** | l'état brut de l'API |

---

## La direction artistique, appliquée partout

Les écrans de l'application étaient restés sur l'ancien style (beige, vert,
`system-ui` partout, cartes à ombre grise floue) alors que la page d'accueil
portait déjà la nouvelle DA. Une passe l'a étendue à tous les écrans.

**La référence reste le ticket de souper à souche détachable.**

| Jeton | Valeur | Rôle |
| --- | --- | --- |
| `--encre` | `#141b2d` | bleu-noir de duplicateur : texte, en-tête, filets |
| `--fond` | `#f4f2ed` | le papier |
| `--rouge` | `#c4364f` | rouge carnet : erreurs, nom du club, accent de la vitrine |
| `--jaune` | `#f2c14e` | jaune bristol : appel à l'action de la vitrine, montant à encaisser |
| `--vert` | `#14733f` | ce qui est acquis (payé, entré) |
| `--couleur` | par club | **reste la couleur du club** sur les pages publiques |
| `--ombre` | `3px 3px 0` | ombre franche décalée, jamais un flou gris |
| `--rayon` | `10px` | un seul arrondi |

- **Une seule police web** : Bricolage Grotesque, **hébergée dans
  `static/polices/`** (77 Ko, `font-display: swap`, cache immuable). Pas
  d'appel à Google, une dépendance en moins.
- **Elle ne sert qu'aux titres et aux grands chiffres** : titres de section,
  totaux, couverts, montant à encaisser du scanner, nom sur le ticket, chiffres
  de la feuille cuisine. Le texte courant reste en `system-ui` : il s'affiche
  instantanément, et la personnalité vient du titrage et de la palette.
- Les titres de section portent un **filet d'encre** plutôt que des
  majuscules espacées.
- Les messages portent un **filet épais sur le bord d'attaque**, comme un
  tampon, au lieu d'un cadre complet.
- L'en-tête connecté passe sur l'encre, avec le jaune au survol.
- Le ticket (`/r/{jeton}/ticket`) a sa **vraie perforation**, encoches
  comprises, et une ombre franche : c'est le même objet que sur la page
  d'accueil.
- Les e-mails suivent la même encre et le même papier.

Un défaut trouvé au passage : dans l'en-tête devenu bleu-nuit, le bouton
« Se déconnecter » gardait son vert foncé — illisible. Corrigé.

---

## Ce qui reste ouvert

Consciemment laissé de côté, par ordre d'intérêt :

1. **Les 69 attributs `style=` en ligne** dans 15 fichiers. Il n'y a pas
   d'échelle d'espacement : chaque écran improvise ses marges. Une passe
   d'utilitaires (`.haut-1`, `.haut-2`, `.entre`) réglerait ça sans rien
   changer à l'écran.
2. **Les couleurs en dur hors des jetons** : `#f0f0ee`, `#eeefec`, `#0d4f2c`,
   `#7d1a15`, `#6b4100`, `#e6e7e4`.
3. **`--couleur` est dynamique, les étiquettes non** : un club qui choisit le
   rouge proposé par le sélecteur aura ses boutons de la même couleur que
   l'étiquette « épuisé » et que les messages d'erreur. Il faudrait retirer le
   rouge des couleurs proposées, ou teinter les étiquettes.
4. **`ChoixCouleur` n'a pas d'`aria-pressed`** et ses six pastilles sont
   identifiées par `title` / `aria-label` seulement.
5. **`/admin` garde son tableau à 8 colonnes.** Il n'est utilisé que par une
   personne, sur ordinateur.
6. **Le lien public en lecture seule** ne se sélectionne qu'au clic souris
   (`onclick={select()}`), pas au clavier.

---

## À ne pas faire

Ce qui marche déjà. Ne pas y toucher, même pour uniformiser.

1. **Ne pas transformer l'écran de création en assistant multi-pages.** Une
   page qui défile plus l'enregistrement automatique est le bon choix pour
   quelqu'un qui hésite, ferme son téléphone, et revient.
2. **Ne pas supprimer l'aperçu en direct** ni sortir `PageEvenement.svelte` de
   son double emploi (page publique et `apercu={true}`). « Ce que je vois est
   ce que verront les gens » est l'argument de confiance du produit.
3. **Ne pas toucher aux compteurs `+` / `−` de 52 px** ni à leurs `aria-label`.
4. **Ne pas redessiner `/cuisine`** : chiffres en 26 px, `@page` réglé, faite
   pour être posée sur un plan de travail.
5. **Ne pas toucher au verdict plein écran du scanner** (vert / rouge, 96 px,
   vibration). C'est ce qu'il faut à l'entrée d'une salle, dans le bruit.
6. **Ne pas ajouter de mot de passe** ni d'inscription.
7. **Ne pas retirer les trois verrous** (ligne de menu déjà commandée, service
   déjà utilisé, question déjà répondue) ni les phrases qui les expliquent. Un
   bouton grisé **avec sa raison écrite** est le modèle à suivre ailleurs.
8. **Ne pas déplacer le calcul des prix côté navigateur.**
9. **Ne pas afficher les places restantes au-delà de 20.** La règle ne
   décourage pas au début.
10. **Ne pas ajouter de framework CSS, de bibliothèque de composants ou
    d'animation.** Une seule feuille de style, et le texte courant en
    `system-ui` : c'est rapide sur un vieux téléphone, dans une salle de
    village, avec deux barres de réseau. C'est une qualité, pas un manque.
