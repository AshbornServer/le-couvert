import { and, eq, sql } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import { db } from './db';
import {
	clubs,
	evenements,
	services,
	lignes_menu,
	options,
	reservations,
	reservation_lignes,
	reservation_options
} from './db/schema';
import { versSlug } from '$lib/slug';
import { conditionOccupe } from './places';
import type { Modele } from '$lib/modeles';

/** Un slug libre pour ce club : « souper-spaghetti », puis « -2 », « -3 »… */
export function slugUnique(club_id: number, base: string): string {
	const racine = versSlug(base) || 'evenement';
	for (let n = 1; n < 200; n++) {
		const essai = n === 1 ? racine : `${racine}-${n}`;
		const pris = db
			.select({ id: evenements.id })
			.from(evenements)
			.where(and(eq(evenements.club_id, club_id), eq(evenements.slug, essai)))
			.get();
		if (!pris) return essai;
	}
	return `${racine}-${Date.now()}`;
}

/** Charge un événement en vérifiant qu'il appartient bien à ce club. */
export function lireEvenement(club_id: number, id: number) {
	const evenement = db
		.select()
		.from(evenements)
		.where(and(eq(evenements.id, id), eq(evenements.club_id, club_id)))
		.get();
	if (!evenement) error(404, 'Cet événement n’existe pas.');
	return evenement;
}

export function lireServices(evenement_id: number) {
	return db
		.select()
		.from(services)
		.where(eq(services.evenement_id, evenement_id))
		.orderBy(services.ordre, services.id)
		.all();
}

export function lireMenu(evenement_id: number) {
	return db
		.select()
		.from(lignes_menu)
		.where(eq(lignes_menu.evenement_id, evenement_id))
		.orderBy(lignes_menu.ordre, lignes_menu.id)
		.all();
}

export function lireOptions(evenement_id: number) {
	return db
		.select()
		.from(options)
		.where(eq(options.evenement_id, evenement_id))
		.orderBy(options.ordre, options.id)
		.all();
}

/* ------------------------------------------------------------- création */

export function creerBrouillonVide(club_id: number): number {
	const slug = slugUnique(club_id, 'evenement');
	return db
		.insert(evenements)
		.values({ club_id, slug, titre: '', statut: 'brouillon' })
		.returning({ id: evenements.id })
		.get().id;
}

export function creerDepuisModele(club_id: number, modele: Modele): number {
	const slug = slugUnique(club_id, modele.titre);
	const id = db
		.insert(evenements)
		.values({
			club_id,
			slug,
			titre: modele.titre,
			heure_debut: modele.heure_debut,
			texte_accueil: modele.texte_accueil,
			texte_confirmation:
				'Merci et à bientôt ! Présentez votre ticket à l’entrée, sur papier ou sur votre téléphone.',
			paiement_sur_place: true,
			statut: 'brouillon'
		})
		.returning({ id: evenements.id })
		.get().id;

	modele.services.forEach((s, i) => {
		db.insert(services)
			.values({ evenement_id: id, libelle: s.libelle, heure: s.heure, ordre: i })
			.run();
	});
	modele.menu.forEach((l, i) => {
		db.insert(lignes_menu)
			.values({
				evenement_id: id,
				nom: l.nom,
				prix_centimes: l.prix_centimes,
				categorie: l.categorie,
				compte_comme_couvert: l.compte_comme_couvert,
				ordre: i
			})
			.run();
	});
	modele.options.forEach((o, i) => {
		db.insert(options)
			.values({ evenement_id: id, libelle: o.libelle, type: o.type, ordre: i })
			.run();
	});

	return id;
}

/** Recopie un événement : tout sauf la date, les réservations et la publication. */
export function dupliquer(club_id: number, source_id: number): number {
	const source = lireEvenement(club_id, source_id);
	const slug = slugUnique(club_id, source.titre || 'evenement');

	const id = db
		.insert(evenements)
		.values({
			club_id,
			slug,
			titre: source.titre,
			heure_debut: source.heure_debut,
			lieu_nom: source.lieu_nom,
			lieu_adresse: source.lieu_adresse,
			image: source.image,
			capacite: source.capacite,
			paiement_en_ligne: source.paiement_en_ligne,
			paiement_sur_place: source.paiement_sur_place,
			paiement_virement: source.paiement_virement,
			iban: source.iban,
			couleur: source.couleur,
			logo: source.logo,
			texte_accueil: source.texte_accueil,
			texte_confirmation: source.texte_confirmation,
			statut: 'brouillon'
		})
		.returning({ id: evenements.id })
		.get().id;

	for (const s of lireServices(source.id)) {
		db.insert(services)
			.values({ evenement_id: id, libelle: s.libelle, heure: s.heure, capacite: s.capacite, ordre: s.ordre })
			.run();
	}
	for (const l of lireMenu(source.id)) {
		db.insert(lignes_menu)
			.values({
				evenement_id: id,
				nom: l.nom,
				prix_centimes: l.prix_centimes,
				categorie: l.categorie,
				stock_max: l.stock_max,
				compte_comme_couvert: l.compte_comme_couvert,
				ordre: l.ordre
			})
			.run();
	}
	for (const o of lireOptions(source.id)) {
		db.insert(options)
			.values({ evenement_id: id, libelle: o.libelle, type: o.type, obligatoire: o.obligatoire, ordre: o.ordre })
			.run();
	}

	return id;
}

/* ----------------------------------------------------------- publication */

/** Ce qui manque pour pouvoir publier. Liste vide = c'est bon. */
export function manquePourPublier(evenement_id: number, club_id: number): string[] {
	const e = lireEvenement(club_id, evenement_id);
	const manque: string[] = [];

	if (!e.titre.trim()) manque.push('le titre de l’événement');
	if (!e.date) manque.push('la date');
	if (!e.lieu_adresse?.trim()) manque.push('l’adresse du lieu');

	const menu = lireMenu(evenement_id);
	if (menu.length === 0) manque.push('au moins une ligne de menu');
	else if (menu.every((l) => l.prix_centimes === 0)) manque.push('un prix sur au moins une ligne');

	if (!e.paiement_en_ligne && !e.paiement_sur_place && !e.paiement_virement) {
		manque.push('au moins un moyen de paiement');
	}
	if (e.paiement_virement && !e.iban?.trim()) manque.push('le numéro de compte (IBAN) pour les virements');

	return manque;
}

/** Nombre de couverts déjà réservés (payés ou en attente de paiement). */
export function couvertsReserves(evenement_id: number): number {
	const ligne = db
		.select({ n: sql<number>`coalesce(sum(${reservations.couverts}), 0)` })
		.from(reservations)
		.where(
			and(eq(reservations.evenement_id, evenement_id), sql.raw(conditionOccupe('reservations')))
		)
		.get();
	return Number(ligne?.n ?? 0);
}

/* ------------------------------------------------------------- gardes */

/** À appeler en première ligne de chaque action de `/admin`. */
export function exigerSuperadmin(locals: App.Locals) {
	if (locals.utilisateur?.role !== 'superadmin') error(403, 'Réservé au super-admin.');
	return locals.utilisateur;
}

/* --------------------------------------------------------- garde de club */

/**
 * Le club de l'organisateur connecté. À utiliser dans les actions, où
 * `parent()` n'existe pas.
 */
export function clubDeLaSession(locals: App.Locals) {
	const utilisateur = locals.utilisateur;
	if (!utilisateur || utilisateur.role !== 'organisateur' || !utilisateur.club_id) {
		error(403, 'Réservé aux organisateurs du club.');
	}
	const club = db
		.select()
		.from(clubs)
		.where(and(eq(clubs.id, utilisateur.club_id), eq(clubs.actif, true)))
		.get();
	if (!club) error(403, 'L’espace de ce club est indisponible.');
	return club;
}

/* ----------------------------------------------- ce qu'on ne peut plus retirer */

/** Les lignes de menu déjà commandées : à garder pour les exports et la cuisine. */
export function lignesCommandees(evenement_id: number): number[] {
	return db
		.selectDistinct({ id: reservation_lignes.ligne_menu_id })
		.from(reservation_lignes)
		.innerJoin(lignes_menu, eq(lignes_menu.id, reservation_lignes.ligne_menu_id))
		.where(eq(lignes_menu.evenement_id, evenement_id))
		.all()
		.map((l) => l.id);
}

/** Les questions auxquelles des participants ont déjà répondu. */
export function optionsRepondues(evenement_id: number): number[] {
	return db
		.selectDistinct({ id: reservation_options.option_id })
		.from(reservation_options)
		.innerJoin(options, eq(options.id, reservation_options.option_id))
		.where(eq(options.evenement_id, evenement_id))
		.all()
		.map((o) => o.id);
}

/** Les services sur lesquels des gens se sont déjà inscrits. */
export function servicesUtilises(evenement_id: number): number[] {
	return db
		.selectDistinct({ id: reservations.service_id })
		.from(reservations)
		.where(eq(reservations.evenement_id, evenement_id))
		.all()
		.map((r) => r.id)
		.filter((id): id is number => id !== null);
}

/** Le club derrière un slug public. 404 s'il n'existe pas ou s'il est désactivé. */
export function lireClubPublic(slug: string) {
	const club = db
		.select()
		.from(clubs)
		.where(and(eq(clubs.slug, slug), eq(clubs.actif, true)))
		.get();
	if (!club) error(404, 'Ce club n’existe pas (ou plus) à cette adresse.');
	return club;
}
