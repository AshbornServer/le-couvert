# PROMPT ONBOARDING

Audit des trois parcours, de la toute première seconde jusqu'au succès.

**Règle absolue** : les adresses publiques `/{club}`, `/{club}/{evenement}`,
`/r/{jeton}` et `/r/{jeton}/ticket` ne changent **jamais** — des QR codes
imprimés et des e-mails déjà partis pointent dessus.

---

## Les trois parcours, comptés

| Parcours | Clics | Champs | Objectif | Tenu ? |
| --- | --- | --- | --- | --- |
| **Super-admin** ouvre un club | 2 | 2 | < 2 min | oui |
| **Organisateur** publie son premier souper | 4 | 3 | < 10 min | oui |
| **Participant** réserve | 3 à 5 | 3 à 4 | < 1 min | oui |

Avant les corrections ci-dessous, aucun des trois ne tenait — non pas à cause
du nombre d'étapes, mais à cause de trois choses précises.

---

## Les trois blocages levés

### 1. L'e-mail d'invitation ressemblait à du hameçonnage

Un bénévole qui n'a rien demandé recevait exactement le même message qu'une
reconnexion : objet « Votre lien de connexion », et cette phrase : « Vous
n'avez rien demandé ? Ignorez ce message. » Il n'avait rien demandé. Le
parcours avait une chance réelle de s'arrêter au premier écran.

Désormais `envoyerInvitation()` envoie un message distinct :

> **Objet** : Royale Harmonie de Tournai — votre accès aux réservations
>
> Le site de réservation des soupers de **Royale Harmonie de Tournai** est
> prêt, et vous en êtes l'organisateur. Pas de mot de passe à retenir : ce
> bouton vous connecte directement. **[Ouvrir mon espace]**

### 2. La date limite, obligatoire et introuvable

Voir `docs/prompt-ux-ui.md` § 4. Elle a maintenant un défaut (la veille à
20 h) et n'est plus une condition de publication.

### 3. La liaison Mollie était impossible telle qu'écrite

Le super-admin était envoyé sur l'écran d'autorisation Mollie — mais c'est le
**club** qui doit accepter, avec **ses** identifiants. Et le retour OAuth
exigeait une session super-admin, donc le lien ne pouvait pas être transmis.
Le parcours ne pouvait pas aboutir.

Corrigé :

- le callback quitte `/admin` pour `/mollie/retour` : ce n'est pas une page
  d'administration, c'est un retour OAuth. L'autorisation vient **uniquement de
  l'état signé (HMAC)**, valable une heure ;
- « Créer le lien pour le club » produit une adresse **à transmettre** (copiable
  en un bouton), au lieu d'ouvrir Mollie sur place ;
- `/mollie/fait` accueille le club avec trois issues en français clair : relié,
  refusé, échec.

---

## L'écran vide est devenu l'écran de choix

**Avant** : l'organisateur arrivait sur « Vous n'avez pas encore d'événement »,
deux boutons identiques, et un message disant que le produit n'était pas fini.

**Maintenant** : les cinq modèles directement, en cinq gros boutons.

> ### Créez votre premier souper
> Choisissez ce que vous organisez. Le menu et les prix sont déjà écrits, vous
> les corrigez après.
>
> [Souper spaghetti] [Souper boulets] [Moules-frites] [Barbecue] [Fancy-fair]
>
> *Autre chose*

**Un écran de moins** pour le premier souper : on ne passe plus par
`/gestion/evenements/nouveau`.

Côté super-admin, même idée : la création d'un club ne demande plus que **le nom
et l'e-mail de l'organisateur** ; slug, logo, couleur, commission et « frais
payés par » sont dans un tiroir qui affiche ses valeurs par défaut (« Déjà
remplis : 0,20 € par couvert, payé par le participant, couleur verte »).

---

## La boucle est fermée : de la demande au club ouvert

Nouveauté de cette passe. La page d'accueil publique porte un formulaire de six
lignes. Une demande arrive dans une table `demandes_club`, s'affiche en tête de
`/admin`, et **un seul clic** sur « Ouvrir le club » :

1. crée le club avec un slug déduit du nom (unique) ;
2. crée le compte de l'organisateur ;
3. lui envoie son invitation ;
4. marque la demande traitée.

Vérifié de bout en bout : « Royale Harmonie de Tournai est ouvert. Jeanne
Dupuis a reçu son accès. »

---

## Les culs-de-sac bouchés

| Où | Ce qui se passait | Ce qui se passe |
| --- | --- | --- |
| `+error.svelte` | le seul bouton menait à `/`, qui renvoyait un participant vers un écran de connexion | le retour se déduit du chemin : « Voir les soupers du club ». Aucun lien si le chemin est interne. |
| `/r/{jeton}/payer` | Mollie indisponible → erreur 502, et le participant **perdait le lien de sa réservation** | redirection vers sa fiche avec « Le paiement en ligne ne répond pas. Votre réservation est gardée. » + « Je paierai sur place » |
| paiement abandonné | la fiche affichait « Reprendre le paiement », qui menait à une erreur 410 | « Votre paiement n'est pas arrivé à temps » + **« Reprendre ma réservation »**, qui revérifie les places |
| `?suite=` | écrit dans l'URL, jamais relu : un favori vers le scanner ramenait à l'accueil | honoré de bout en bout, **le soir du souper l'organisateur retombe sur son scanner** |
| écran « Regardez vos e-mails » | aucune issue si l'adresse est inconnue | « Toujours rien après deux minutes ? Cette adresse n'est peut-être pas encore inscrite. » (la réponse du serveur reste identique dans les deux cas) |
| action `taches` de `/admin` | déclarée, sans aucun formulaire : injoignable | bouton « Relancer les rappels et le ménage » |
| suppression d'un organisateur, détachement de Mollie | partaient au premier clic, alors que supprimer un brouillon demandait de recopier « SUPPRIMER » | confirmation en deux temps ; la friction est là où le risque est |
| slug du club | modifiable même après publication : un clic tuait tous les QR imprimés | **verrouillé** dès qu'un événement est publié, avec la raison écrite |

---

## Le soir du souper, en un clic

`/gestion` met en avant un bouton **« Mode entrée »** sur chaque souper publié
dont la date tombe dans les deux jours. Avant : `/gestion` → « Tableau de
bord » → « Mode entrée », trois écrans avant de scanner le premier ticket.

---

## Ce qui reste ouvert

1. **L'adresse de la salle n'est pas mémorisée** sur le club : l'organisateur
   la retape à chaque souper. Il faudrait une colonne `clubs.adresse`,
   préremplie à la création et enregistrée au premier usage.
2. **L'IBAN n'est pas prérempli** depuis le dernier événement du club : un
   numéro de compte à retaper à la main, sur un téléphone.
3. **Aucune page d'aide.** Le slug `aide` est réservé et rien n'existe derrière.
4. **La page publique d'un club sans événement** (« Rien à réserver pour le
   moment ») est le premier écran de quelqu'un qui scanne un vieux QR : elle
   gagnerait un « Écrire au club » (`clubs.email_contact` existe et n'est
   jamais affiché).
