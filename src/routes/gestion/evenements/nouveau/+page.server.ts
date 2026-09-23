import { fail, redirect } from '@sveltejs/kit';
import { eq, sql } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { evenements } from '$lib/server/db/schema';
import {
	clubDeLaSession,
	creerBrouillonVide,
	creerDepuisModele,
	dupliquer
} from '$lib/server/evenement';
import { modeleParCle, MODELES } from '$lib/modeles';

export const load: PageServerLoad = async ({ parent }) => {
	const { club } = await parent();

	const precedents = db
		.select({
			id: evenements.id,
			titre: evenements.titre,
			date: evenements.date,
			couverts: sql<number>`coalesce((
				select sum(r.couverts) from reservations r
				 where r.evenement_id = evenements.id and r.statut_paiement = 'paye'
			), 0)`
		})
		.from(evenements)
		.where(eq(evenements.club_id, club.id))
		.orderBy(sql`evenements.date desc`)
		.limit(8)
		.all();

	return { precedents, modeles: MODELES.map((m) => ({ cle: m.cle, nom: m.nom, menu: m.menu.length })) };
};

export const actions: Actions = {
	vide: ({ locals }) => {
		const club = clubDeLaSession(locals);
		redirect(303, `/gestion/evenements/${creerBrouillonVide(club.id)}`);
	},

	modele: async ({ request, locals }) => {
		const club = clubDeLaSession(locals);
		const cle = String((await request.formData()).get('cle') ?? '');
		const modele = modeleParCle(cle);
		if (!modele) return fail(400, { erreur: 'Modèle inconnu.' });
		redirect(303, `/gestion/evenements/${creerDepuisModele(club.id, modele)}`);
	},

	dupliquer: async ({ request, locals }) => {
		const club = clubDeLaSession(locals);
		const source = Number((await request.formData()).get('evenement_id'));
		if (!source) return fail(400, { erreur: 'Événement à dupliquer inconnu.' });
		redirect(303, `/gestion/evenements/${dupliquer(club.id, source)}`);
	}
};
