import { fail, redirect } from '@sveltejs/kit';
import { eq, sql } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { clubs, evenements } from '$lib/server/db/schema';
import { ouvrirClub, tropDOuvertures } from '$lib/server/club';
import { origine } from '$lib/server/config';
import { DEMO } from '$lib/marque';

export const load: PageServerLoad = ({ locals, url, setHeaders }) => {
	// Une personne connectée arrive directement dans son espace.
	// `?accueil` permet de revoir la page de présentation malgré la session.
	if (!url.searchParams.has('accueil')) {
		if (locals.utilisateur?.role === 'superadmin') redirect(303, '/admin');
		if (locals.utilisateur?.role === 'organisateur') redirect(303, '/gestion');
	}

	setHeaders({ 'cache-control': 'public, max-age=120' });

	/* La démonstration n'est montrée que si elle existe vraiment. */
	const club = db.select({ id: clubs.id }).from(clubs).where(eq(clubs.slug, DEMO.club)).get();
	const demo = club
		? db
				.select({ slug: evenements.slug })
				.from(evenements)
				.where(
					sql`${evenements.club_id} = ${club.id}
						and ${evenements.slug} = ${DEMO.evenement}
						and ${evenements.statut} = 'publie'`
				)
				.get()
		: null;

	return { demo: demo ? `/${DEMO.club}/${demo.slug}` : null };
};

export const actions: Actions = {
	/**
	 * Ouvre l'espace du club immédiatement. Personne n'attend une validation :
	 * le club reçoit son accès dans la minute, et le super-admin le voit passer.
	 */
	demande: async ({ request, url, getClientAddress }) => {
		const d = await request.formData();
		const champ = (nom: string) => String(d.get(nom) ?? '').trim();

		const valeurs = {
			club: champ('club'),
			ville: champ('ville'),
			contact: champ('contact'),
			email: champ('email'),
			telephone: champ('telephone'),
			evenement: champ('evenement')
		};

		if (!valeurs.club || !valeurs.contact || !valeurs.email.includes('@')) {
			return fail(400, {
				erreur: 'Il manque le nom du club, votre nom ou votre adresse e-mail.',
				dejaInscrit: false,
				valeurs
			});
		}

		if (tropDOuvertures(getClientAddress())) {
			return fail(429, {
				erreur:
					'Trois espaces ont déjà été ouverts depuis cette connexion dans l’heure. Patientez, ou écrivez-nous.',
				dejaInscrit: false,
				valeurs
			});
		}

		const resultat = await ouvrirClub(valeurs, origine(url), 'site');
		if (!resultat.ok) {
			return fail(resultat.deja_inscrit ? 409 : 400, {
				erreur: resultat.erreur,
				dejaInscrit: resultat.deja_inscrit === true,
				valeurs
			});
		}

		return { ouvert: true, club: valeurs.club, email: valeurs.email, slug: resultat.slug };
	}
};
