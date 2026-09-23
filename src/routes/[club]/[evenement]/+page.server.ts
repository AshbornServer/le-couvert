import { error, fail, redirect } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { evenements } from '$lib/server/db/schema';
import { lireClubPublic, lireMenu, lireOptions, lireServices } from '$lib/server/evenement';
import { libererBlocagesExpires, placesEvenement, placesServices, stockLignes } from '$lib/server/places';
import { creerReservation, envoyerConfirmation, lireParToken } from '$lib/server/reservation';
import { origine } from '$lib/server/config';

function lireEvenementPublic(club_id: number, slug: string) {
	const evenement = db
		.select()
		.from(evenements)
		.where(and(eq(evenements.club_id, club_id), eq(evenements.slug, slug)))
		.get();

	if (!evenement || evenement.statut === 'brouillon') {
		error(404, 'Cet événement n’existe pas (ou plus) à cette adresse.');
	}
	return evenement;
}

export const load: PageServerLoad = async ({ params, parent, setHeaders }) => {
	const { club } = await parent();
	libererBlocagesExpires();

	const evenement = lireEvenementPublic(club.id, params.evenement);
	const places = placesEvenement(evenement.id, evenement.capacite);
	const restantsServices = placesServices(evenement.id);
	const restantsLignes = stockLignes(evenement.id);

	// Rien n'est mis en cache : les places restantes doivent être justes.
	setHeaders({ 'cache-control': 'no-store' });

	const limiteDepassee = Boolean(
		evenement.date_limite && new Date(evenement.date_limite) < new Date()
	);
	const complet = places.restant !== null && places.restant <= 0;

	return {
		evenement,
		services: lireServices(evenement.id).map((s) => ({
			...s,
			restant: restantsServices.get(s.id) ?? null
		})),
		menu: lireMenu(evenement.id).map((l) => ({
			...l,
			restant: restantsLignes.get(l.id) ?? null
		})),
		options: lireOptions(evenement.id),
		placesRestantes: places.restant,
		fraisParCouvert: club.frais_payes_par === 'participant' ? club.commission_centimes : 0,
		limiteDepassee,
		complet,
		termine: evenement.statut === 'termine'
	};
};

export const actions: Actions = {
	reserver: async ({ request, params, url }) => {
		const club = lireClubPublic(params.club);
		const evenement = lireEvenementPublic(club.id, params.evenement);
		const d = await request.formData();

		/* Les quantités arrivent en « q_<identifiant de ligne> ». */
		const quantites: Record<number, number> = {};
		const reponses: Record<number, string> = {};
		for (const [nom, valeur] of d.entries()) {
			if (nom.startsWith('q_')) {
				const id = Number(nom.slice(2));
				if (Number.isFinite(id)) quantites[id] = Number(valeur);
			}
			if (nom.startsWith('option_')) {
				const id = Number(nom.slice(7));
				if (Number.isFinite(id)) reponses[id] = String(valeur);
			}
		}

		const mode = String(d.get('mode_paiement') ?? '');
		if (mode !== 'en_ligne' && mode !== 'sur_place' && mode !== 'virement') {
			return fail(400, { erreur: 'Merci de choisir comment vous payez.' });
		}

		const resultat = creerReservation({
			evenement_id: evenement.id,
			service_id: d.get('service_id') ? Number(d.get('service_id')) : null,
			prenom: String(d.get('prenom') ?? ''),
			nom: String(d.get('nom') ?? ''),
			email: String(d.get('email') ?? ''),
			telephone: String(d.get('telephone') ?? ''),
			quantites,
			reponses,
			mode_paiement: mode,
			source: 'en_ligne'
		});

		if (!resultat.ok) return fail(400, { erreur: resultat.erreur });

		// Le paiement en ligne (étape 4) se branche ici : redirection vers Mollie.
		if (mode === 'en_ligne') {
			redirect(303, `/r/${resultat.token}/payer`);
		}

		const dossier = lireParToken(resultat.token);
		if (dossier) {
			try {
				await envoyerConfirmation(dossier, origine(url));
			} catch {
				// L'e-mail peut échouer : la réservation reste valable, le lien s'affiche.
			}
		}

		redirect(303, `/r/${resultat.token}?nouveau=1`);
	}
};
