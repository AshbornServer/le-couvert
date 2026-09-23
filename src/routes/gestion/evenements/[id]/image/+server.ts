import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { clubDeLaSession, lireEvenement } from '$lib/server/evenement';
import { enregistrerImage } from '$lib/server/televersement';

/** Reçoit une image (affiche ou logo) et rend son chemin public. */
export const POST: RequestHandler = async ({ request, params, locals }) => {
	const club = clubDeLaSession(locals);
	lireEvenement(club.id, Number(params.id));

	const donnees = await request.formData();
	const resultat = await enregistrerImage(donnees.get('fichier'));
	if (!resultat.ok) error(400, resultat.erreur);
	if (!resultat.chemin) error(400, 'Aucun fichier reçu.');

	return json({ chemin: resultat.chemin });
};
