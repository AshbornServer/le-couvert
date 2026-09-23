import { and, eq, sql } from 'drizzle-orm';
import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { evenements } from '$lib/server/db/schema';

export const load: PageServerLoad = ({ parent, setHeaders }) => {
	setHeaders({ 'cache-control': 'public, max-age=30' });

	return parent().then(({ club }) => {
		const liste = db
			.select({
				slug: evenements.slug,
				titre: evenements.titre,
				date: evenements.date,
				heure_debut: evenements.heure_debut,
				lieu_nom: evenements.lieu_nom,
				image: evenements.image,
				texte_accueil: evenements.texte_accueil
			})
			.from(evenements)
			.where(and(eq(evenements.club_id, club.id), eq(evenements.statut, 'publie')))
			.orderBy(sql`${evenements.date} asc`)
			.all();

		return { evenements: liste };
	});
};
