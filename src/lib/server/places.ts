/**
 * Comptage des places, avec blocage temporaire pendant le paiement.
 *
 * Une place est occupée quand la réservation est payée, ou quand elle attend
 * un paiement qui tient encore : sur place et virement tiennent jusqu'à
 * l'annulation, un paiement en ligne ne tient que 15 minutes.
 */
import { and, eq, sql } from 'drizzle-orm';
import { db } from './db';
import { reservations, services, lignes_menu, reservation_lignes } from './db/schema';
import { maintenant } from '$lib/dates';

export const DUREE_BLOCAGE = 15 * 60; // secondes

/**
 * « Cette réservation occupe une place », en SQL brut, avec un préfixe de table.
 *
 * Une seule définition pour tout le projet : le comptage des places, les
 * agrégats du tableau de bord et les exports doivent dire la même chose. Les
 * divergences passées venaient d'avoir écrit cette condition trois fois.
 */
export function conditionOccupe(prefixe = 'r'): string {
	return `(
		${prefixe}.statut_paiement = 'paye'
		or (
			${prefixe}.statut_paiement = 'en_attente'
			and (${prefixe}.mode_paiement <> 'en_ligne'
				or ${prefixe}.bloque_jusqu_a is null
				or ${prefixe}.bloque_jusqu_a > unixepoch())
		)
	)`;
}

function occupe() {
	return sql.raw(conditionOccupe('reservations'));
}

/** Passe en « expiré » les paiements en ligne que personne n'a terminés. */
export function libererBlocagesExpires(): number {
	const resultat = db
		.update(reservations)
		.set({ statut_paiement: 'expire' })
		.where(
			sql`${reservations.statut_paiement} = 'en_attente'
				and ${reservations.mode_paiement} = 'en_ligne'
				and ${reservations.bloque_jusqu_a} is not null
				and ${reservations.bloque_jusqu_a} <= ${maintenant()}`
		)
		.run();
	return resultat.changes;
}

export type EtatPlaces = {
	capacite: number | null;
	occupes: number;
	restant: number | null;
};

/** Places de l'événement dans son ensemble. */
export function placesEvenement(evenement_id: number, capacite: number | null): EtatPlaces {
	const ligne = db
		.select({ n: sql<number>`coalesce(sum(${reservations.couverts}), 0)` })
		.from(reservations)
		.where(and(eq(reservations.evenement_id, evenement_id), occupe()))
		.get();

	const occupes = Number(ligne?.n ?? 0);
	return { capacite, occupes, restant: capacite === null ? null : capacite - occupes };
}

/** Places restantes par service. `null` = pas de limite. */
export function placesServices(evenement_id: number): Map<number, number | null> {
	const lignes = db
		.select({
			id: services.id,
			capacite: services.capacite,
			occupes: sql<number>`coalesce((
				select sum(r.couverts) from reservations r
				 where r.service_id = services.id and ${sql.raw(conditionOccupe('r'))}
			), 0)`
		})
		.from(services)
		.where(eq(services.evenement_id, evenement_id))
		.all();

	return new Map(
		lignes.map((s) => [s.id, s.capacite === null ? null : s.capacite - Number(s.occupes)])
	);
}

/** Stock restant par ligne de menu. `null` = pas de stock déclaré. */
export function stockLignes(evenement_id: number): Map<number, number | null> {
	const lignes = db
		.select({
			id: lignes_menu.id,
			stock_max: lignes_menu.stock_max,
			vendus: sql<number>`coalesce((
				select sum(rl.quantite)
				  from reservation_lignes rl
				  join reservations r on r.id = rl.reservation_id
				 where rl.ligne_menu_id = lignes_menu.id and ${sql.raw(conditionOccupe('r'))}
			), 0)`
		})
		.from(lignes_menu)
		.where(eq(lignes_menu.evenement_id, evenement_id))
		.all();

	return new Map(
		lignes.map((l) => [l.id, l.stock_max === null ? null : l.stock_max - Number(l.vendus)])
	);
}

/** Quantité déjà vendue pour une ligne, hors réservation en cours. */
export function dejaVendu(ligne_menu_id: number): number {
	const ligne = db
		.select({ n: sql<number>`coalesce(sum(${reservation_lignes.quantite}), 0)` })
		.from(reservation_lignes)
		.innerJoin(reservations, eq(reservations.id, reservation_lignes.reservation_id))
		.where(and(eq(reservation_lignes.ligne_menu_id, ligne_menu_id), occupe()))
		.get();
	return Number(ligne?.n ?? 0);
}
