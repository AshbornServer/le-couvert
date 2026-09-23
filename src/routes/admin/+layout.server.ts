import { error, redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals, url }) => {
	if (!locals.utilisateur) redirect(303, `/connexion?suite=${encodeURIComponent(url.pathname)}`);
	if (locals.utilisateur.role !== 'superadmin') error(403, 'Réservé au super-admin.');
	return { utilisateur: locals.utilisateur };
};
