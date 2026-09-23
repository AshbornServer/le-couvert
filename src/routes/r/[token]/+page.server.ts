import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { reservations } from '$lib/server/db/schema';
import {
	annulableParLeParticipant,
	annuler,
	envoyerAnnulation,
	envoyerConfirmation,
	lireParToken
} from '$lib/server/reservation';
import { DUREE_BLOCAGE, placesEvenement } from '$lib/server/places';
import { maintenant } from '$lib/dates';
import { rembourser } from '$lib/server/mollie';
import { origine } from '$lib/server/config';

function dossierOu404(token: string) {
	const dossier = lireParToken(token);
	if (!dossier) error(404, 'Cette réservation n’existe pas (ou plus).');
	return dossier;
}

export const load: PageServerLoad = ({ params, url, setHeaders }) => {
	const dossier = dossierOu404(params.token);
	setHeaders({ 'cache-control': 'no-store' });

	return {
		...dossier,
		nouveau: url.searchParams.has('nouveau'),
		paiement: url.searchParams.get('paiement'),
		annulable: annulableParLeParticipant(dossier)
	};
};

export const actions: Actions = {
	annuler: async ({ params, url }) => {
		const dossier = dossierOu404(params.token);
		if (!annulableParLeParticipant(dossier)) {
			return fail(400, {
				erreur:
					'Il est trop tard pour annuler en ligne. Contactez directement le club, il fera le nécessaire.'
			});
		}

		const resultat = annuler(dossier.reservation.id, 'participant');
		if (!resultat.ok) return fail(400, { erreur: resultat.erreur });

		let rembourseReellement = false;
		if (resultat.rembourse) {
			const remboursement = await rembourser(dossier);
			rembourseReellement = remboursement.ok;
		}

		const apres = lireParToken(params.token);
		if (apres) {
			try {
				await envoyerAnnulation(apres, rembourseReellement);
			} catch {
				// L'e-mail n'est pas bloquant.
			}
		}
		return { annule: true, rembourse: rembourseReellement };
	},

	/** Le paiement en ligne n'est pas arrivé à temps : on reprend la place. */
	reprendre: ({ params }) => {
		const dossier = dossierOu404(params.token);
		const { reservation, evenement } = dossier;

		if (reservation.statut_paiement === 'paye') return { ok: 'C’est déjà payé.' };
		if (reservation.statut_paiement !== 'expire') {
			return fail(400, { erreur: 'Cette réservation n’a pas besoin d’être reprise.' });
		}

		const places = placesEvenement(evenement.id, evenement.capacite);
		if (places.restant !== null && reservation.couverts > places.restant) {
			return fail(400, {
				erreur:
					places.restant <= 0
						? 'C’est complet entre-temps : il n’y a plus de place. Contactez le club.'
						: `Il ne reste que ${places.restant} places, et votre réservation en demande ${reservation.couverts}. Contactez le club.`
			});
		}

		db.update(reservations)
			.set({ statut_paiement: 'en_attente', bloque_jusqu_a: maintenant() + DUREE_BLOCAGE })
			.where(eq(reservations.id, reservation.id))
			.run();

		redirect(303, `/r/${params.token}/payer`);
	},

	/** Bascule vers le paiement sur place quand le paiement en ligne coince. */
	payer_sur_place: ({ params }) => {
		const dossier = dossierOu404(params.token);
		if (!dossier.evenement.paiement_sur_place) {
			return fail(400, {
				erreur: 'Cet événement n’accepte pas le paiement sur place. Contactez le club.'
			});
		}

		db.update(reservations)
			.set({
				mode_paiement: 'sur_place',
				statut_paiement: 'en_attente',
				bloque_jusqu_a: null,
				frais_centimes: 0,
				total_centimes: dossier.reservation.total_centimes - dossier.reservation.frais_centimes
			})
			.where(eq(reservations.id, dossier.reservation.id))
			.run();

		return { ok: 'C’est noté : vous paierez sur place, le soir même.' };
	},

	renvoyer: async ({ params, url }) => {
		const dossier = dossierOu404(params.token);
		if (!dossier.reservation.email) return fail(400, { erreur: 'Aucune adresse e-mail enregistrée.' });
		try {
			await envoyerConfirmation(dossier, origine(url));
		} catch {
			return fail(500, { erreur: 'L’envoi a échoué. Réessayez dans un instant.' });
		}
		return { renvoye: true };
	}
};
