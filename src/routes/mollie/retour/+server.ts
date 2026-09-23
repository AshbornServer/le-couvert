import { redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { clubs } from '$lib/server/db/schema';
import { relierClub, verifierEtat } from '$lib/server/mollie';
import { config } from '$lib/server/config';

/**
 * Retour de Mollie après l'accord du club.
 *
 * Volontairement hors de `/admin` : c'est le club qui accepte, depuis son
 * propre compte Mollie, et il n'est pas super-admin. L'autorisation vient
 * uniquement de l'état signé (HMAC), pas d'une session.
 */
export const GET: RequestHandler = async ({ url }) => {
	const etat = url.searchParams.get('state') ?? '';
	const code = url.searchParams.get('code');
	const club_id = verifierEtat(etat);

	if (!club_id) redirect(303, '/connexion?mollie=lien_perime');

	if (!code) {
		db.update(clubs).set({ mollie_statut: 'erreur' }).where(eq(clubs.id, club_id)).run();
		redirect(303, `/mollie/fait?etat=refuse`);
	}

	try {
		await relierClub(club_id, code, config.mollie.redirection);
	} catch (erreur) {
		console.error('[mollie] liaison impossible :', erreur);
		db.update(clubs).set({ mollie_statut: 'erreur' }).where(eq(clubs.id, club_id)).run();
		redirect(303, `/mollie/fait?etat=erreur`);
	}

	redirect(303, `/mollie/fait?etat=ok`);
};
