/**
 * Données de démonstration : le club « FC Exemple » et son souper spaghetti.
 * Lancement :  npm run db:seed
 * Le script est idempotent : il efface puis recrée le club de démonstration.
 */
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { eq } from 'drizzle-orm';
import { randomBytes } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import * as s from '../src/lib/server/db/schema.ts';
import { communicationStructuree } from '../src/lib/communication.ts';

const chemin = process.env.CHEMIN_BASE ?? './data/soupers.db';
mkdirSync(dirname(chemin), { recursive: true });
const sqlite = new Database(chemin);
sqlite.pragma('foreign_keys = ON');
const db = drizzle(sqlite, { schema: s });
migrate(db, { migrationsFolder: './drizzle' });

const SLUG = 'fc-exemple';
const maintenant = () => Math.floor(Date.now() / 1000);

/* ---------------------------------------------------------------- remise à zéro */

const ancien = db.select().from(s.clubs).where(eq(s.clubs.slug, SLUG)).get();
if (ancien) {
	db.delete(s.clubs).where(eq(s.clubs.id, ancien.id)).run();
	console.log('Ancien club de démonstration effacé.');
}

/* ------------------------------------------------------------------------- club */

const club = db
	.insert(s.clubs)
	.values({
		slug: SLUG,
		nom: 'FC Exemple',
		couleur: '#0b6b3a',
		email_contact: 'organisateur@fc-exemple.be',
		commission_centimes: 20,
		frais_payes_par: 'participant',
		mollie_statut: 'relie',
		mollie_org_id: 'org_demo_exemple'
	})
	.returning({ id: s.clubs.id })
	.get();

for (const email of ['organisateur@fc-exemple.be', 'tresorier@fc-exemple.be']) {
	db.insert(s.utilisateurs)
		.values({ email, role: 'organisateur', club_id: club.id })
		.onConflictDoNothing()
		.run();
}

/* -------------------------------------------------------------------- événement */

/** Le samedi qui tombe dans trois à quatre semaines. */
function prochainSamedi(): string {
	const d = new Date();
	d.setUTCDate(d.getUTCDate() + ((6 - d.getUTCDay() + 7) % 7 || 7) + 21);
	return d.toISOString().slice(0, 10);
}
const dateSouper = prochainSamedi();
const dateLimite = (() => {
	const d = new Date(`${dateSouper}T00:00:00Z`);
	d.setUTCDate(d.getUTCDate() - 2);
	return `${d.toISOString().slice(0, 10)}T20:00`;
})();

const evenement = db
	.insert(s.evenements)
	.values({
		club_id: club.id,
		slug: 'souper-spaghetti',
		titre: 'Souper spaghetti',
		date: dateSouper,
		heure_debut: '18:30',
		lieu_nom: 'Salle du FC Exemple',
		lieu_adresse: 'Rue du Stade 12, 7500 Tournai',
		capacite: 240,
		date_limite: dateLimite,
		paiement_en_ligne: true,
		paiement_sur_place: true,
		paiement_virement: true,
		iban: 'BE68 5390 0754 7034',
		couleur: '#0b6b3a',
		texte_accueil:
			'Notre souper spaghetti annuel ! Toute l’équipe vous attend à la salle du club. Réservez votre table, les bénévoles s’occupent du reste.',
		texte_confirmation:
			'Merci et à bientôt ! Présentez votre ticket à l’entrée, sur papier ou sur votre téléphone.',
		statut: 'publie',
		publie_le: maintenant()
	})
	.returning({ id: s.evenements.id })
	.get();

const services = [
	{ libelle: 'Premier service', heure: '18:30', capacite: 120, ordre: 0 },
	{ libelle: 'Deuxième service', heure: '20:30', capacite: 120, ordre: 1 }
].map((v) =>
	db
		.insert(s.services)
		.values({ ...v, evenement_id: evenement.id })
		.returning({ id: s.services.id, libelle: s.services.libelle })
		.get()
);

const menu = [
	{ nom: 'Spaghetti bolo adulte', prix_centimes: 1600, categorie: 'plat', couvert: true },
	{ nom: 'Spaghetti végé adulte', prix_centimes: 1500, categorie: 'plat', couvert: true },
	{ nom: 'Spaghetti enfant', prix_centimes: 800, categorie: 'plat', couvert: true },
	{ nom: 'Tiramisu', prix_centimes: 400, categorie: 'dessert', couvert: false }
].map((v, i) =>
	db
		.insert(s.lignes_menu)
		.values({
			evenement_id: evenement.id,
			nom: v.nom,
			prix_centimes: v.prix_centimes,
			categorie: v.categorie as 'plat' | 'dessert',
			compte_comme_couvert: v.couvert,
			ordre: i
		})
		.returning({
			id: s.lignes_menu.id,
			nom: s.lignes_menu.nom,
			prix_centimes: s.lignes_menu.prix_centimes,
			compte_comme_couvert: s.lignes_menu.compte_comme_couvert
		})
		.get()
);

const optionsEv = [
	{ libelle: 'Allergies ou remarque', type: 'texte' as const, obligatoire: false, ordre: 0 },
	{ libelle: 'Je souhaite être à table avec…', type: 'texte' as const, obligatoire: false, ordre: 1 }
].map((v) =>
	db
		.insert(s.options)
		.values({ ...v, evenement_id: evenement.id })
		.returning({ id: s.options.id, libelle: s.options.libelle })
		.get()
);

/* ----------------------------------------------------- 40 réservations fictives */

const PRENOMS = [
	'Jean', 'Marie', 'Luc', 'Anne', 'Pierre', 'Sophie', 'Marc', 'Christine', 'Michel', 'Nathalie',
	'Philippe', 'Isabelle', 'Éric', 'Véronique', 'Olivier', 'Catherine', 'Bernard', 'Martine',
	'Thierry', 'Sylvie'
];
const NOMS = [
	'Dubois', 'Lambert', 'Martin', 'Dupont', 'Simon', 'Leroy', 'Peeters', 'Janssens', 'Maes',
	'Willems', 'Claes', 'Goossens', 'Wouters', 'De Smet', 'Mertens', 'Jacobs', 'Vermeulen',
	'Hermans', 'Coppens', 'Delvaux'
];
const REMARQUES = [
	'', '', '', '', 'Sans gluten pour une personne', 'Allergie aux fruits de mer', '',
	'Un enfant en chaise haute', '', 'Intolérance au lactose'
];

let graine = 20261017;
/** Petit générateur déterministe : la démonstration est toujours la même. */
function hasard(): number {
	graine = (graine * 1103515245 + 12345) % 2147483648;
	return graine / 2147483648;
}
const dans = <T>(liste: T[]): T => liste[Math.floor(hasard() * liste.length)];
const entre = (min: number, max: number) => min + Math.floor(hasard() * (max - min + 1));

const COMMISSION = 20; // centimes par couvert, comme le club de démonstration

let compteurPaye = 0;
let compteurCouverts = 0;

for (let i = 0; i < 40; i++) {
	const service = dans(services);
	const prenom = dans(PRENOMS);
	const nom = dans(NOMS);

	/* Composition du panier : au moins un plat. */
	const panier: { ligne: (typeof menu)[number]; quantite: number }[] = [];
	const bolo = entre(0, 4);
	if (bolo) panier.push({ ligne: menu[0], quantite: bolo });
	if (hasard() < 0.35) panier.push({ ligne: menu[1], quantite: entre(1, 2) });
	if (hasard() < 0.45) panier.push({ ligne: menu[2], quantite: entre(1, 3) });
	if (panier.length === 0) panier.push({ ligne: menu[0], quantite: 2 });
	if (hasard() < 0.6) panier.push({ ligne: menu[3], quantite: entre(1, 4) });

	const couverts = panier
		.filter((p) => p.ligne.compte_comme_couvert)
		.reduce((t, p) => t + p.quantite, 0);
	const sousTotal = panier.reduce((t, p) => t + p.quantite * p.ligne.prix_centimes, 0);

	/* Mode de paiement et état. */
	const tirage = hasard();
	const manuelle = tirage > 0.82;
	const mode = manuelle
		? hasard() < 0.5
			? ('liquide' as const)
			: ('virement' as const)
		: hasard() < 0.7
			? ('en_ligne' as const)
			: ('virement' as const);

	let statut: 'paye' | 'en_attente' | 'annule' = 'paye';
	const etat = hasard();
	if (mode === 'virement' && etat < 0.45) statut = 'en_attente';
	else if (etat > 0.96) statut = 'annule';

	const frais = mode === 'en_ligne' && statut === 'paye' ? couverts * COMMISSION : 0;
	const total = sousTotal + (frais > 0 ? frais : 0);

	const reservation = db
		.insert(s.reservations)
		.values({
			evenement_id: evenement.id,
			service_id: service.id,
			nom,
			prenom,
			email: `${prenom}.${nom}`
				.toLowerCase()
				.normalize('NFD')
				.replace(/[̀-ͯ]/g, '')
				.replace(/[^a-z.]/g, '') + '@exemple.be',
			telephone: hasard() < 0.6 ? `04${entre(70, 99)} ${entre(10, 99)} ${entre(10, 99)} ${entre(10, 99)}` : null,
			couverts,
			total_centimes: total,
			frais_centimes: frais,
			statut_paiement: statut,
			mode_paiement: mode,
			paye_le: statut === 'paye' ? maintenant() - entre(1, 20) * 86400 : null,
			token_gestion: randomBytes(24).toString('base64url'),
			source: manuelle ? 'manuelle' : 'en_ligne',
			cree_le: maintenant() - entre(1, 25) * 86400
		})
		.returning({ id: s.reservations.id })
		.get();

	if (mode === 'virement') {
		db.update(s.reservations)
			.set({ communication_structuree: communicationStructuree(evenement.id, reservation.id) })
			.where(eq(s.reservations.id, reservation.id))
			.run();
	}

	for (const p of panier) {
		db.insert(s.reservation_lignes)
			.values({
				reservation_id: reservation.id,
				ligne_menu_id: p.ligne.id,
				quantite: p.quantite,
				prix_centimes: p.ligne.prix_centimes,
				nom: p.ligne.nom
			})
			.run();
	}

	const remarque = dans(REMARQUES);
	if (remarque) {
		db.insert(s.reservation_options)
			.values({
				reservation_id: reservation.id,
				option_id: optionsEv[0].id,
				libelle: optionsEv[0].libelle,
				valeur: remarque
			})
			.run();
	}

	if (statut !== 'annule') {
		db.insert(s.tickets)
			.values({
				reservation_id: reservation.id,
				code_qr: randomBytes(16).toString('base64url'),
				scanne_le: null
			})
			.run();
	}

	if (statut === 'paye') {
		compteurPaye++;
		compteurCouverts += couverts;
	}
}

/* ------------------------------------------------------------------ récapitulatif */

console.log('');
console.log('Club        : FC Exemple   → /fc-exemple');
console.log('Événement   : Souper spaghetti  →', dateSouper, '(services 18 h 30 et 20 h 30)');
console.log('Limite      :', dateLimite);
console.log('Réservations: 40 (dont', compteurPaye, 'payées,', compteurCouverts, 'couverts payés)');
console.log('Organisateurs : organisateur@fc-exemple.be, tresorier@fc-exemple.be');
console.log('');
console.log('Pour vous connecter : allez sur /connexion, entrez une de ces adresses,');
console.log('le lien s’affiche dans le terminal du serveur (FOURNISSEUR_MAIL="console").');
console.log('');
