/**
 * RGPD : douze mois après l'événement, les personnes disparaissent.
 *
 * On anonymise plutôt que de supprimer : les totaux de l'événement (couverts,
 * encaissé, commissions) sont tous calculés depuis `reservations`, et les
 * effacer ferait tomber l'historique du club à zéro. Après la purge il reste
 * des lignes sans nom, sans e-mail et sans téléphone.
 */
import { and, eq, isNull, lt, or, sql } from 'drizzle-orm';
import { db } from './db';
import { evenements, journal, reservations, reservation_options, tickets } from './db/schema';
import { maintenant } from '$lib/dates';

const DOUZE_MOIS = 365 * 24 * 60 * 60;

export function lancerMenageRgpd(): void {
	const limite = maintenant() - DOUZE_MOIS;

	/**
	 * Les événements datés de plus de douze mois, plus les brouillons sans date
	 * créés il y a plus de douze mois : ceux-là aussi peuvent porter des
	 * réservations saisies à la main.
	 */
	const aPurger = db
		.select({ id: evenements.id, date: evenements.date })
		.from(evenements)
		.where(
			and(
				isNull(evenements.purge_le),
				or(
					sql`${evenements.date} is not null and unixepoch(${evenements.date}) < ${limite}`,
					sql`${evenements.date} is null and ${evenements.cree_le} < ${limite}`
				)
			)
		)
		.all();

	for (const ev of aPurger) {
		const touchees = db
			.update(reservations)
			.set({
				nom: 'Anonyme',
				prenom: '',
				email: null,
				telephone: null,
				note_interne: null
			})
			.where(eq(reservations.evenement_id, ev.id))
			.run();

		// Les réponses libres (allergies, remarques) sont des données personnelles.
		db.delete(reservation_options)
			.where(
				sql`${reservation_options.reservation_id} in (
					select id from reservations where evenement_id = ${ev.id}
				)`
			)
			.run();

		// Un code de ticket ne sert plus à rien un an après.
		db.update(tickets)
			.set({ scanne_par: null })
			.where(
				sql`${tickets.reservation_id} in (select id from reservations where evenement_id = ${ev.id})`
			)
			.run();

		db.update(evenements)
			.set({ purge_le: maintenant(), statut: 'termine' })
			.where(eq(evenements.id, ev.id))
			.run();

		if (touchees.changes > 0) {
			console.log(
				`[RGPD] ${touchees.changes} réservation(s) anonymisée(s) — événement ${ev.id} (${ev.date ?? 'sans date'})`
			);
		}
	}

	/* Le journal cite des noms de participants : on l'élague au même rythme. */
	const journalPurge = db.delete(journal).where(lt(journal.cree_le, limite)).run();
	if (journalPurge.changes > 0) {
		console.log(`[RGPD] ${journalPurge.changes} ligne(s) de journal effacée(s)`);
	}
}
