import { fail, redirect } from '@sveltejs/kit';
import { eq, sql } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { clubs, demandes_club, evenements } from '$lib/server/db/schema';
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
	demande: async ({ request }) => {
		const d = await request.formData();
		const champ = (nom: string) => String(d.get(nom) ?? '').trim();

		const club = champ('club');
		const contact = champ('contact');
		const email = champ('email');

		if (!club || !contact || !email.includes('@')) {
			return fail(400, {
				erreur: 'Il manque le nom du club, votre nom ou votre adresse e-mail.',
				valeurs: {
					club,
					ville: champ('ville'),
					contact,
					email,
					telephone: champ('telephone'),
					evenement: champ('evenement')
				}
			});
		}

		db.insert(demandes_club)
			.values({
				club,
				ville: champ('ville') || null,
				contact,
				email: email.toLowerCase(),
				telephone: champ('telephone') || null,
				evenement: champ('evenement') || null
			})
			.run();

		return { envoye: true, club };
	}
};
