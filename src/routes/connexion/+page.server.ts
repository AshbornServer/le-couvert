import { fail, redirect } from '@sveltejs/kit';
import { origine } from '$lib/server/config';
import type { Actions, PageServerLoad } from './$types';
import { envoyerLienMagique, tropDeDemandes, tropDeDemandesIp } from '$lib/server/auth';

export const load: PageServerLoad = ({ locals, url }) => {
	if (locals.utilisateur) redirect(303, '/');
	return {
		lienPerime: url.searchParams.has('probleme'),
		suite: url.searchParams.get('suite') ?? ''
	};
};

export const actions: Actions = {
	default: async ({ request, url, getClientAddress }) => {
		const donnees = await request.formData();
		const email = String(donnees.get('email') ?? '').trim();

		if (!email || !email.includes('@')) {
			return fail(400, { email, erreur: 'Merci d’écrire votre adresse e-mail.' });
		}
		// Les deux compteurs sont incrémentés : pas de court-circuit.
		const tropEmail = tropDeDemandes(email.toLowerCase());
		const tropIp = tropDeDemandesIp(getClientAddress());
		if (tropEmail || tropIp) {
			return fail(429, {
				email,
				erreur: 'Trop de demandes. Patientez un quart d’heure, puis réessayez.'
			});
		}

		const origineMail = origine(url);
		await envoyerLienMagique(email, origineMail, String(donnees.get('suite') ?? ''));

		// Réponse identique que l'adresse existe ou non.
		return { envoye: true, email };
	}
};
