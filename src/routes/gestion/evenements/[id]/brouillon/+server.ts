import { json } from '@sveltejs/kit';
import { and, eq, notInArray, sql } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import {
	evenements,
	services,
	lignes_menu,
	options,
	reservation_lignes
} from '$lib/server/db/schema';
import {
	clubDeLaSession,
	lireEvenement,
	manquePourPublier,
	optionsRepondues,
	servicesUtilises,
	slugUnique
} from '$lib/server/evenement';
import { maintenant } from '$lib/dates';
import { versSlug } from '$lib/slug';
import { veilleAVingtHeures } from '$lib/dates';

/** Une ligne envoyée par le navigateur : `cle` toujours, `id` si elle existe déjà. */
type Rangee = { cle: string; id: number | null };

type Corps = {
	titre?: string;
	date?: string | null;
	heure_debut?: string | null;
	lieu_nom?: string | null;
	lieu_adresse?: string | null;
	image?: string | null;
	capacite?: number | null;
	date_limite?: string | null;
	paiement_en_ligne?: boolean;
	paiement_sur_place?: boolean;
	paiement_virement?: boolean;
	iban?: string | null;
	couleur?: string | null;
	logo?: string | null;
	texte_accueil?: string | null;
	texte_confirmation?: string | null;
	services?: (Rangee & { libelle: string; heure: string | null; capacite: number | null })[];
	menu?: (Rangee & {
		nom: string;
		prix_centimes: number;
		categorie: 'plat' | 'dessert' | 'boisson' | 'autre';
		stock_max: number | null;
		compte_comme_couvert: boolean;
	})[];
	options?: (Rangee & { libelle: string; type: 'texte' | 'case'; obligatoire: boolean })[];
};

const texte = (v: unknown): string | null => {
	const t = typeof v === 'string' ? v.trim() : '';
	return t === '' ? null : t;
};
const entier = (v: unknown): number | null => {
	const n = Number(v);
	return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
};

export const POST: RequestHandler = async ({ request, params, locals }) => {
	const club = clubDeLaSession(locals);
	const evenement = lireEvenement(club.id, Number(params.id));
	const corps: Corps = await request.json();

	/* ------------------------------------------------------ l'événement */

	const titre = typeof corps.titre === 'string' ? corps.titre.trim() : evenement.titre;
	const date = texte(corps.date);

	/**
	 * Personne ne sait remplir seul une date limite, et c'était le seul champ
	 * obligatoire sans valeur par défaut : la veille de l'événement à 20 h.
	 */
	let date_limite = texte(corps.date_limite);
	if (!date_limite && date) date_limite = veilleAVingtHeures(date);

	// Le slug suit le titre tant que l'événement n'est pas publié.
	let slug = evenement.slug;
	if (evenement.statut === 'brouillon' && titre && versSlug(titre) !== versSlug(evenement.titre)) {
		slug = slugUnique(club.id, titre);
	}

	db.update(evenements)
		.set({
			titre,
			slug,
			date,
			heure_debut: texte(corps.heure_debut),
			lieu_nom: texte(corps.lieu_nom),
			lieu_adresse: texte(corps.lieu_adresse),
			image: texte(corps.image),
			capacite: entier(corps.capacite),
			date_limite,
			paiement_en_ligne: Boolean(corps.paiement_en_ligne),
			paiement_sur_place: Boolean(corps.paiement_sur_place),
			paiement_virement: Boolean(corps.paiement_virement),
			iban: texte(corps.iban),
			couleur: texte(corps.couleur),
			logo: texte(corps.logo),
			texte_accueil: texte(corps.texte_accueil),
			texte_confirmation: texte(corps.texte_confirmation),
			modifie_le: maintenant()
		})
		.where(eq(evenements.id, evenement.id))
		.run();

	/* ---------------------------------------------------------- services */

	const clesServices: Record<string, number> = {};
	const idsServices: number[] = [];
	(corps.services ?? []).forEach((s, ordre) => {
		const valeurs = {
			libelle: s.libelle?.trim() || `Service ${ordre + 1}`,
			heure: texte(s.heure),
			capacite: entier(s.capacite),
			ordre
		};
		if (s.id) {
			db.update(services)
				.set(valeurs)
				.where(and(eq(services.id, s.id), eq(services.evenement_id, evenement.id)))
				.run();
			idsServices.push(s.id);
			clesServices[s.cle] = s.id;
		} else {
			const cree = db
				.insert(services)
				.values({ ...valeurs, evenement_id: evenement.id })
				.returning({ id: services.id })
				.get();
			idsServices.push(cree.id);
			clesServices[s.cle] = cree.id;
		}
	});
	// Un service sur lequel des gens sont inscrits n'est jamais supprimé.
	const servicesObsoletes = db
		.select({ id: services.id })
		.from(services)
		.where(
			idsServices.length
				? and(eq(services.evenement_id, evenement.id), notInArray(services.id, idsServices))
				: eq(services.evenement_id, evenement.id)
		)
		.all()
		.map((s) => s.id);

	const servicesGardes: number[] = [];
	const utilises = servicesUtilises(evenement.id);
	for (const id of servicesObsoletes) {
		if (utilises.includes(id)) servicesGardes.push(id);
		else db.delete(services).where(eq(services.id, id)).run();
	}

	/* -------------------------------------------------------------- menu */

	const clesMenu: Record<string, number> = {};
	const idsMenu: number[] = [];
	(corps.menu ?? []).forEach((l, ordre) => {
		const valeurs = {
			nom: l.nom?.trim() || `Ligne ${ordre + 1}`,
			prix_centimes: Number.isFinite(l.prix_centimes) ? Math.max(0, Math.floor(l.prix_centimes)) : 0,
			categorie: l.categorie ?? 'plat',
			stock_max: entier(l.stock_max),
			compte_comme_couvert: Boolean(l.compte_comme_couvert),
			ordre
		};
		if (l.id) {
			db.update(lignes_menu)
				.set(valeurs)
				.where(and(eq(lignes_menu.id, l.id), eq(lignes_menu.evenement_id, evenement.id)))
				.run();
			idsMenu.push(l.id);
			clesMenu[l.cle] = l.id;
		} else {
			const cree = db
				.insert(lignes_menu)
				.values({ ...valeurs, evenement_id: evenement.id })
				.returning({ id: lignes_menu.id })
				.get();
			idsMenu.push(cree.id);
			clesMenu[l.cle] = cree.id;
		}
	});

	// Une ligne déjà commandée n'est jamais supprimée : on la garde pour les exports.
	const aSupprimer = db
		.select({ id: lignes_menu.id })
		.from(lignes_menu)
		.where(
			idsMenu.length
				? and(eq(lignes_menu.evenement_id, evenement.id), notInArray(lignes_menu.id, idsMenu))
				: eq(lignes_menu.evenement_id, evenement.id)
		)
		.all()
		.map((l) => l.id);

	const gardees: number[] = [];
	for (const id of aSupprimer) {
		const utilisee = db
			.select({ n: sql<number>`count(*)` })
			.from(reservation_lignes)
			.where(eq(reservation_lignes.ligne_menu_id, id))
			.get();
		if ((utilisee?.n ?? 0) > 0) gardees.push(id);
		else db.delete(lignes_menu).where(eq(lignes_menu.id, id)).run();
	}

	/* ----------------------------------------------------------- options */

	const clesOptions: Record<string, number> = {};
	const idsOptions: number[] = [];
	(corps.options ?? []).forEach((o, ordre) => {
		const valeurs = {
			libelle: o.libelle?.trim() || `Question ${ordre + 1}`,
			type: o.type ?? 'texte',
			obligatoire: Boolean(o.obligatoire),
			ordre
		};
		if (o.id) {
			db.update(options)
				.set(valeurs)
				.where(and(eq(options.id, o.id), eq(options.evenement_id, evenement.id)))
				.run();
			idsOptions.push(o.id);
			clesOptions[o.cle] = o.id;
		} else {
			const cree = db
				.insert(options)
				.values({ ...valeurs, evenement_id: evenement.id })
				.returning({ id: options.id })
				.get();
			idsOptions.push(cree.id);
			clesOptions[o.cle] = cree.id;
		}
	});
	/**
	 * Une question à laquelle des participants ont répondu n'est jamais
	 * supprimée : leurs réponses partiraient avec elle (cascade), et elles sont
	 * dans les exports, le PDF d'entrée et le scanner.
	 */
	const optionsObsoletes = db
		.select({ id: options.id })
		.from(options)
		.where(
			idsOptions.length
				? and(eq(options.evenement_id, evenement.id), notInArray(options.id, idsOptions))
				: eq(options.evenement_id, evenement.id)
		)
		.all()
		.map((o) => o.id);

	const optionsGardees: number[] = [];
	const repondues = optionsRepondues(evenement.id);
	for (const id of optionsObsoletes) {
		if (repondues.includes(id)) optionsGardees.push(id);
		else db.delete(options).where(eq(options.id, id)).run();
	}

	return json({
		ok: true,
		enregistre_le: maintenant(),
		slug,
		date_limite,
		manque: manquePourPublier(evenement.id, club.id),
		cles: { services: clesServices, menu: clesMenu, options: clesOptions },
		lignes_gardees: gardees,
		services_gardes: servicesGardes,
		options_gardees: optionsGardees
	});
};
