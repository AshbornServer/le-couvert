import { eq, sql } from 'drizzle-orm';
import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { evenements } from '$lib/server/db/schema';
import { conditionOccupe, libererBlocagesExpires } from '$lib/server/places';

export const load: PageServerLoad = ({ parent }) => {
	// Sinon cet écran annonce plus de couverts que le tableau de bord.
	libererBlocagesExpires();

	return parent().then(({ club }) => {
		const listeEvenements = db
			.select({
				id: evenements.id,
				slug: evenements.slug,
				titre: evenements.titre,
				date: evenements.date,
				heure_debut: evenements.heure_debut,
				statut: evenements.statut,
				capacite: evenements.capacite,
				reservations: sql<number>`(
					select count(*) from reservations r
					 where r.evenement_id = evenements.id and ${sql.raw(conditionOccupe('r'))}
				)`,
				couverts: sql<number>`coalesce((
					select sum(r.couverts) from reservations r
					 where r.evenement_id = evenements.id and ${sql.raw(conditionOccupe('r'))}
				), 0)`,
				encaisse: sql<number>`coalesce((
					select sum(r.total_centimes - r.frais_centimes) from reservations r
					 where r.evenement_id = evenements.id and r.statut_paiement = 'paye'
				), 0)`
			})
			.from(evenements)
			.where(eq(evenements.club_id, club.id))
			.orderBy(sql`${evenements.date} is null desc, ${evenements.date} desc`)
			.all();

		return { evenements: listeEvenements };
	});
};
