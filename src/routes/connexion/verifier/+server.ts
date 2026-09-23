import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { consommerJeton } from '$lib/server/auth';

export const GET: RequestHandler = ({ url, cookies }) => {
	const jeton = url.searchParams.get('jeton');
	if (!jeton) redirect(303, '/connexion?probleme=1');

	const utilisateur = consommerJeton(jeton, cookies);
	if (!utilisateur) redirect(303, '/connexion?probleme=1');

	const defaut = utilisateur.role === 'superadmin' ? '/admin' : '/gestion';

	/* On revient là où la personne allait — dans ce site seulement. */
	const suite = url.searchParams.get('suite') ?? '';
	const permise =
		suite.startsWith('/gestion') || (suite.startsWith('/admin') && utilisateur.role === 'superadmin');

	redirect(303, permise ? suite : defaut);
};
