import { json } from '@sveltejs/kit';
import { and, eq, isNull } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { db, sqlite } from '$lib/server/db';
import { reservations, services, tickets } from '$lib/server/db/schema';
import { clubDeLaSession, lireEvenement } from '$lib/server/evenement';
import { heureBelge, maintenant } from '$lib/dates';

export type Verdict = {
	etat: 'valide' | 'deja' | 'inconnu' | 'annule' | 'autre_evenement';
	message: string;
	nom?: string;
	couverts?: number;
	service?: string | null;
	commande?: string | null;
	remarques?: string | null;
	a_payer_centimes?: number;
};

/** Résumé de la commande et des remarques, pour l'accueil. */
function resume(reservation_id: number) {
	return sqlite
		.prepare(
			`select
				(select group_concat(rl.quantite || ' × ' || rl.nom, ', ')
				   from reservation_lignes rl where rl.reservation_id = ?) as commande,
				(select group_concat(ro.libelle || ' : ' || ro.valeur, ' | ')
				   from reservation_options ro where ro.reservation_id = ?) as remarques`
		)
		.get(reservation_id, reservation_id) as { commande: string | null; remarques: string | null };
}

export const POST: RequestHandler = async ({ request, params, locals }) => {
	const club = clubDeLaSession(locals);
	const evenement = lireEvenement(club.id, Number(params.id));
	const corps = (await request.json()) as { code?: string; reservation_id?: number };

	const ticket = corps.reservation_id
		? db.select().from(tickets).where(eq(tickets.reservation_id, corps.reservation_id)).get()
		: db
				.select()
				.from(tickets)
				.where(eq(tickets.code_qr, String(corps.code ?? '')))
				.get();

	if (!ticket) return json({ etat: 'inconnu', message: 'Ticket inconnu' } satisfies Verdict);

	const reservation = db
		.select()
		.from(reservations)
		.where(eq(reservations.id, ticket.reservation_id))
		.get();

	if (!reservation) return json({ etat: 'inconnu', message: 'Ticket inconnu' } satisfies Verdict);

	if (reservation.evenement_id !== evenement.id) {
		return json({
			etat: 'autre_evenement',
			message: 'Ce ticket est celui d’un autre événement'
		} satisfies Verdict);
	}

	const service = reservation.service_id
		? (db.select().from(services).where(eq(services.id, reservation.service_id)).get() ?? null)
		: null;

	const detail = resume(reservation.id);

	const base: Verdict = {
		etat: 'valide',
		message: '',
		nom: `${reservation.prenom} ${reservation.nom}`,
		couverts: reservation.couverts,
		service: service
			? `${service.libelle}${service.heure ? ` — ${heureBelge(service.heure)}` : ''}`
			: null,
		commande: detail.commande,
		remarques: detail.remarques,
		a_payer_centimes: reservation.statut_paiement === 'paye' ? 0 : reservation.total_centimes
	};

	if (reservation.statut_paiement === 'annule' || reservation.statut_paiement === 'rembourse') {
		return json({ ...base, etat: 'annule', message: 'Réservation annulée' });
	}
	/* Paiement en ligne abandonné : la place a été relâchée, puis revendue. */
	if (reservation.statut_paiement === 'expire') {
		return json({ ...base, etat: 'annule', message: 'Paiement jamais terminé' });
	}

	if (ticket.scanne_le) {
		const heure = new Date(ticket.scanne_le * 1000).toLocaleTimeString('fr-BE', {
			hour: '2-digit',
			minute: '2-digit'
		});
		return json({ ...base, etat: 'deja', message: `Déjà scanné à ${heure}` });
	}

	// Le `is null` dans la condition évite qu'un double scan simultané passe deux fois.
	const marque = db
		.update(tickets)
		.set({ scanne_le: maintenant(), scanne_par: locals.utilisateur?.email ?? null })
		.where(and(eq(tickets.id, ticket.id), isNull(tickets.scanne_le)))
		.run();

	if (marque.changes === 0) {
		return json({ ...base, etat: 'deja', message: 'Déjà scanné à l’instant' });
	}

	return json({ ...base, etat: 'valide', message: 'Bienvenue !' });
};
