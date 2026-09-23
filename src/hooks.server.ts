import { error, type Handle } from '@sveltejs/kit';
import { lireSession, menageAuth } from '$lib/server/auth';
import { lancerMenageRgpd } from '$lib/server/rgpd';
import { lancerRappels } from '$lib/server/rappels';
import { libererBlocagesExpires } from '$lib/server/places';

/** Les tâches de fond : ménage, rappels, blocages de paiement périmés. */
async function taches() {
	menageAuth();
	lancerMenageRgpd();
	libererBlocagesExpires();
	try {
		await lancerRappels();
	} catch (erreur) {
		console.error('[taches] rappels impossibles :', erreur);
	}
}

void taches();

// Une fois par heure : assez fin pour les rappels, assez lâche pour un petit serveur.
setInterval(() => void taches(), 60 * 60 * 1000).unref?.();

export const handle: Handle = async ({ event, resolve }) => {
	event.locals.utilisateur = lireSession(event.cookies);

	/**
	 * Garde-fou de `/admin`, ici et pas seulement dans `+layout.server.ts` :
	 * SvelteKit exécute les actions de formulaire AVANT les `load`, donc un
	 * garde placé dans un layout ne protège pas les actions.
	 */
	const chemin = event.url.pathname;
	if (chemin === '/admin' || chemin.startsWith('/admin/')) {
		if (event.locals.utilisateur?.role !== 'superadmin' && event.request.method !== 'GET') {
			error(403, 'Réservé au super-admin.');
		}
	}

	return resolve(event);
};
