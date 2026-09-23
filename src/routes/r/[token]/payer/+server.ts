import { error, redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { lireParToken } from '$lib/server/reservation';
import { creerPaiement } from '$lib/server/mollie';
import { origine } from '$lib/server/config';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { reservations } from '$lib/server/db/schema';
import { maintenant } from '$lib/dates';

/**
 * Emmène le participant sur la page de paiement Mollie.
 * En cas de pépin, on le renvoie toujours sur sa fiche de réservation : elle
 * existe, et c'est la seule page où il peut faire quelque chose.
 */
export const GET: RequestHandler = async ({ params, url }) => {
	const dossier = lireParToken(params.token);
	if (!dossier) error(404, 'Cette réservation n’existe pas (ou plus).');

	const { reservation, evenement } = dossier;
	const statut = reservation.statut_paiement;

	if (statut === 'paye') redirect(303, `/r/${params.token}`);
	if (statut !== 'en_attente') redirect(303, `/r/${params.token}?paiement=expire`);

	// On ne paie en ligne que ce qui a été réservé en ligne, et que si le club l'accepte.
	if (reservation.mode_paiement !== 'en_ligne' || !evenement.paiement_en_ligne) {
		redirect(303, `/r/${params.token}`);
	}

	// Rien à payer : inutile de passer par Mollie, qui refuse les montants nuls.
	if (reservation.total_centimes <= 0) {
		db.update(reservations)
			.set({ statut_paiement: 'paye', paye_le: maintenant(), bloque_jusqu_a: null })
			.where(eq(reservations.id, reservation.id))
			.run();
		redirect(303, `/r/${params.token}?nouveau=1`);
	}

	const resultat = await creerPaiement(dossier, origine(url));
	if (!resultat.ok) redirect(303, `/r/${params.token}?paiement=impossible`);

	redirect(303, resultat.url);
};
