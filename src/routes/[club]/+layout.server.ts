import { error } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import type { LayoutServerLoad } from './$types';
import { db } from '$lib/server/db';
import { clubs } from '$lib/server/db/schema';

export const load: LayoutServerLoad = ({ params }) => {
	const club = db
		.select({
			id: clubs.id,
			slug: clubs.slug,
			nom: clubs.nom,
			logo: clubs.logo,
			couleur: clubs.couleur,
			commission_centimes: clubs.commission_centimes,
			frais_payes_par: clubs.frais_payes_par
		})
		.from(clubs)
		.where(and(eq(clubs.slug, params.club), eq(clubs.actif, true)))
		.get();

	if (!club) error(404, 'Ce club n’existe pas (ou plus) à cette adresse.');
	return { club };
};
