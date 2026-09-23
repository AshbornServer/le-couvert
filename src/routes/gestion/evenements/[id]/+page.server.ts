import { fail, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { evenements, journal } from '$lib/server/db/schema';
import {
	clubDeLaSession,
	couvertsReserves,
	lireEvenement,
	lireMenu,
	lignesCommandees,
	lireOptions,
	optionsRepondues,
	lireServices,
	manquePourPublier,
	servicesUtilises
} from '$lib/server/evenement';
import { supprimerImage } from '$lib/server/televersement';
import { origine } from '$lib/server/config';
import { maintenant } from '$lib/dates';

export const load: PageServerLoad = async ({ params, parent, url }) => {
	const { club } = await parent();
	const id = Number(params.id);
	const evenement = lireEvenement(club.id, id);

	return {
		evenement,
		services: lireServices(id),
		menu: lireMenu(id),
		options: lireOptions(id),
		manque: manquePourPublier(id, club.id),
		couvertsReserves: couvertsReserves(id),
		lignesCommandees: lignesCommandees(id),
		servicesUtilises: servicesUtilises(id),
		optionsRepondues: optionsRepondues(id),
		lienPublic: `${origine(url)}/${club.slug}/${evenement.slug}`
	};
};

export const actions: Actions = {
	publier: ({ params, locals }) => {
		const club = clubDeLaSession(locals);
		const evenement = lireEvenement(club.id, Number(params.id));

		const manque = manquePourPublier(evenement.id, club.id);
		if (manque.length > 0) {
			return fail(400, { erreur: 'Il manque encore : ' + manque.join(', ') + '.' });
		}

		db.update(evenements)
			.set({ statut: 'publie', publie_le: evenement.publie_le ?? maintenant() })
			.where(eq(evenements.id, evenement.id))
			.run();

		db.insert(journal)
			.values({
				club_id: club.id,
				utilisateur_id: locals.utilisateur?.id ?? null,
				action: 'evenement_publie',
				detail: `${evenement.titre} (/${club.slug}/${evenement.slug})`
			})
			.run();

		return { publie: true };
	},

	depublier: ({ params, locals }) => {
		const club = clubDeLaSession(locals);
		const evenement = lireEvenement(club.id, Number(params.id));

		if (couvertsReserves(evenement.id) > 0) {
			return fail(400, {
				erreur:
					'Des réservations sont déjà arrivées : on ne peut plus dépublier. Fermez plutôt les réservations en changeant la date limite.'
			});
		}

		db.update(evenements)
			.set({ statut: 'brouillon' })
			.where(eq(evenements.id, evenement.id))
			.run();
		return { ok: 'Événement repassé en brouillon.' };
	},

	supprimer: async ({ params, request, locals }) => {
		const club = clubDeLaSession(locals);
		const evenement = lireEvenement(club.id, Number(params.id));
		const confirmation = String((await request.formData()).get('confirmation') ?? '').trim();

		const reserves = couvertsReserves(evenement.id);
		if (reserves > 0) {
			return fail(400, {
				erreur: `Impossible : ${reserves} couverts sont déjà réservés. Annulez d’abord les réservations.`
			});
		}
		if (confirmation !== 'SUPPRIMER') {
			return fail(400, { erreur: 'Recopiez SUPPRIMER en majuscules pour confirmer.' });
		}

		supprimerImage(evenement.image);
		db.delete(evenements).where(eq(evenements.id, evenement.id)).run();

		db.insert(journal)
			.values({
				club_id: club.id,
				utilisateur_id: locals.utilisateur?.id ?? null,
				action: 'evenement_supprime',
				detail: evenement.titre || `événement ${evenement.id}`
			})
			.run();

		redirect(303, '/gestion');
	}
};
