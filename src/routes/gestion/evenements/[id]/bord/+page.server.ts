import { fail } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { journal, reservations } from '$lib/server/db/schema';
import {
	clubDeLaSession,
	lireEvenement,
	lireMenu,
	lireOptions,
	lireServices
} from '$lib/server/evenement';
import { chiffres, listeReservations, recapCuisine, virementsAttendus } from '$lib/server/bord';
import { libererBlocagesExpires, placesEvenement } from '$lib/server/places';
import {
	annuler,
	creerReservation,
	envoyerAnnulation,
	envoyerConfirmation,
	lireParToken
} from '$lib/server/reservation';
import { rembourser } from '$lib/server/mollie';
import { communicationNue } from '$lib/communication';
import { origine } from '$lib/server/config';
import { maintenant } from '$lib/dates';

export const load: PageServerLoad = async ({ params, parent, url }) => {
	const { club } = await parent();
	const id = Number(params.id);
	const evenement = lireEvenement(club.id, id);
	libererBlocagesExpires();

	const recherche = url.searchParams.get('q') ?? '';
	const statutBrut = url.searchParams.get('statut') ?? 'tous';
	const statut = (['tous', 'paye', 'a_payer', 'annule'] as const).includes(statutBrut as never)
		? (statutBrut as 'tous' | 'paye' | 'a_payer' | 'annule')
		: 'tous';
	const service_id = url.searchParams.get('service') ? Number(url.searchParams.get('service')) : null;

	return {
		evenement,
		services: lireServices(id),
		menu: lireMenu(id),
		options: lireOptions(id),
		chiffres: chiffres(id),
		cuisine: recapCuisine(id),
		places: placesEvenement(id, evenement.capacite),
		reservations: listeReservations(id, { recherche, statut, service_id }),
		virements: virementsAttendus(id),
		filtres: { recherche, statut, service_id },
		lienPublic: `${origine(url)}/${club.slug}/${evenement.slug}`
	};
};

/** Vérifie que la réservation appartient bien à l'événement de ce club. */
function reservationDuClub(club_id: number, evenement_id: number, reservation_id: number) {
	lireEvenement(club_id, evenement_id);
	return db
		.select()
		.from(reservations)
		.where(and(eq(reservations.id, reservation_id), eq(reservations.evenement_id, evenement_id)))
		.get();
}

export const actions: Actions = {
	/* ------------------------------------------------- suivi des paiements */
	marquer_paye: async ({ request, params, locals }) => {
		const club = clubDeLaSession(locals);
		const d = await request.formData();
		const reservation = reservationDuClub(club.id, Number(params.id), Number(d.get('reservation_id')));
		if (!reservation) return fail(404, { erreur: 'Réservation introuvable.' });
		if (reservation.statut_paiement === 'annule' || reservation.statut_paiement === 'rembourse') {
			return fail(400, {
				erreur: 'Cette réservation est annulée : elle ne peut pas être marquée payée.'
			});
		}

		const mode = String(d.get('mode') ?? '');
		db.update(reservations)
			.set({
				statut_paiement: 'paye',
				paye_le: maintenant(),
				bloque_jusqu_a: null,
				...(mode === 'liquide' || mode === 'virement' ? { mode_paiement: mode } : {})
			})
			.where(eq(reservations.id, reservation.id))
			.run();

		db.insert(journal)
			.values({
				club_id: club.id,
				utilisateur_id: locals.utilisateur?.id ?? null,
				action: 'paiement_marque',
				detail: `réservation ${reservation.id} — ${reservation.prenom} ${reservation.nom}`
			})
			.run();

		return { ok: `Paiement enregistré pour ${reservation.prenom} ${reservation.nom}.` };
	},

	marquer_impaye: async ({ request, params, locals }) => {
		const club = clubDeLaSession(locals);
		const d = await request.formData();
		const reservation = reservationDuClub(club.id, Number(params.id), Number(d.get('reservation_id')));
		if (!reservation) return fail(404, { erreur: 'Réservation introuvable.' });
		if (reservation.statut_paiement !== 'paye') {
			return fail(400, { erreur: 'Cette réservation n’est pas marquée payée.' });
		}

		/**
		 * Un paiement en ligne repassé « à payer » garderait sa place pour
		 * toujours (`bloque_jusqu_a` à NULL n'expire jamais) : on le bascule
		 * sur « sur place », qui est ce que l'organisateur veut dire.
		 */
		db.update(reservations)
			.set({
				statut_paiement: 'en_attente',
				paye_le: null,
				bloque_jusqu_a: null,
				...(reservation.mode_paiement === 'en_ligne' ? { mode_paiement: 'sur_place' as const } : {})
			})
			.where(eq(reservations.id, reservation.id))
			.run();
		return { ok: 'Réservation repassée en « à payer ».' };
	},

	/** Rapprochement bancaire par communication structurée. */
	rapprocher: async ({ request, params, locals }) => {
		const club = clubDeLaSession(locals);
		const evenement = lireEvenement(club.id, Number(params.id));
		const saisie = String((await request.formData()).get('communication') ?? '');
		const chiffresSaisis = communicationNue(saisie);

		if (chiffresSaisis.length < 10) {
			return fail(400, { erreur: 'Recopiez la communication complète (12 chiffres).' });
		}

		const candidats = db
			.select()
			.from(reservations)
			.where(eq(reservations.evenement_id, evenement.id))
			.all()
			.filter((r) => communicationNue(r.communication_structuree ?? '') === chiffresSaisis);

		if (candidats.length === 0) {
			return fail(404, { erreur: `Aucune réservation avec la communication ${saisie}.` });
		}

		const reservation = candidats[0];
		if (reservation.statut_paiement === 'paye') {
			return { ok: `${reservation.prenom} ${reservation.nom} était déjà marqué payé.` };
		}
		if (reservation.statut_paiement === 'annule' || reservation.statut_paiement === 'rembourse') {
			return fail(400, {
				erreur: `La réservation de ${reservation.prenom} ${reservation.nom} est annulée. Le virement doit être remboursé à la main.`
			});
		}

		db.update(reservations)
			.set({ statut_paiement: 'paye', paye_le: maintenant() })
			.where(eq(reservations.id, reservation.id))
			.run();

		db.insert(journal)
			.values({
				club_id: club.id,
				utilisateur_id: locals.utilisateur?.id ?? null,
				action: 'virement_rapproche',
				detail: `réservation ${reservation.id} — ${saisie}`
			})
			.run();

		return {
			ok: `Virement rapproché : ${reservation.prenom} ${reservation.nom} est payé.`
		};
	},

	/* ------------------------------------------------------------ annulation */
	annuler: async ({ request, params, locals }) => {
		const club = clubDeLaSession(locals);
		const d = await request.formData();
		const reservation = reservationDuClub(club.id, Number(params.id), Number(d.get('reservation_id')));
		if (!reservation) return fail(404, { erreur: 'Réservation introuvable.' });

		const resultat = annuler(reservation.id, 'organisateur');
		if (!resultat.ok) return fail(400, { erreur: resultat.erreur });

		let rembourseReellement = false;
		let avertissement = '';
		const dossier = lireParToken(reservation.token_gestion);

		if (resultat.rembourse && dossier) {
			const remboursement = await rembourser(dossier);
			rembourseReellement = remboursement.ok;
			if (!remboursement.ok) avertissement = ' ' + (remboursement.erreur ?? '');
		}

		if (dossier && String(d.get('prevenir')) === 'oui') {
			try {
				await envoyerAnnulation(dossier, rembourseReellement);
			} catch {
				avertissement += ' L’e-mail n’est pas parti.';
			}
		}

		db.insert(journal)
			.values({
				club_id: club.id,
				utilisateur_id: locals.utilisateur?.id ?? null,
				action: 'reservation_annulee',
				detail: `réservation ${reservation.id} — ${reservation.prenom} ${reservation.nom}`
			})
			.run();

		return {
			ok: `Réservation de ${reservation.prenom} ${reservation.nom} annulée.${rembourseReellement ? ' Remboursement demandé.' : ''}${avertissement}`
		};
	},

	/* -------------------------------------------------- réservation manuelle */
	ajouter: async ({ request, params, locals, url }) => {
		const club = clubDeLaSession(locals);
		const evenement = lireEvenement(club.id, Number(params.id));
		const d = await request.formData();

		const quantites: Record<number, number> = {};
		const reponses: Record<number, string> = {};
		for (const [nom, valeur] of d.entries()) {
			if (nom.startsWith('q_')) quantites[Number(nom.slice(2))] = Number(valeur);
			if (nom.startsWith('option_')) reponses[Number(nom.slice(7))] = String(valeur);
		}

		const encaissement = String(d.get('encaissement') ?? 'a_payer');
		const mode =
			encaissement === 'liquide' ? 'liquide' : encaissement === 'virement_recu' ? 'virement' : 'sur_place';

		const resultat = creerReservation({
			evenement_id: evenement.id,
			service_id: d.get('service_id') ? Number(d.get('service_id')) : null,
			prenom: String(d.get('prenom') ?? ''),
			nom: String(d.get('nom') ?? ''),
			email: String(d.get('email') ?? '') || null,
			telephone: String(d.get('telephone') ?? '') || null,
			quantites,
			reponses,
			mode_paiement: mode,
			source: 'manuelle',
			deja_payee: encaissement === 'liquide' || encaissement === 'virement_recu',
			note_interne: String(d.get('note_interne') ?? '') || null
		});

		if (!resultat.ok) return fail(400, { erreur: resultat.erreur, ouvrirAjout: true });

		const dossier = lireParToken(resultat.token);
		let note = '';
		if (dossier?.reservation.email && String(d.get('envoyer_mail')) === 'oui') {
			try {
				await envoyerConfirmation(dossier, origine(url));
				note = ' Ticket envoyé par e-mail.';
			} catch {
				note = ' L’e-mail n’est pas parti.';
			}
		}

		return { ok: `Réservation ajoutée.${note}`, lienTicket: `/r/${resultat.token}/ticket` };
	}
};
