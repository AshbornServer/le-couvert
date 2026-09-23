import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { lireParToken } from '$lib/server/reservation';

export const load: PageServerLoad = ({ params, setHeaders }) => {
	const dossier = lireParToken(params.token);
	if (!dossier) error(404, 'Cette réservation n’existe pas (ou plus).');
	setHeaders({ 'cache-control': 'no-store' });
	return dossier;
};
