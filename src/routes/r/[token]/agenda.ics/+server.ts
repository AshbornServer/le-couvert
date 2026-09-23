import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { lireParToken } from '$lib/server/reservation';
import { fichierIcs } from '$lib/ics';
import { versSlug } from '$lib/slug';

/** « Ajouter à mon agenda ». */
export const GET: RequestHandler = ({ params }) => {
	const dossier = lireParToken(params.token);
	if (!dossier) error(404);
	const { evenement, reservation, service } = dossier;
	if (!evenement.date) error(404, 'Cet événement n’a pas encore de date.');

	const ics = fichierIcs({
		uid: `reservation-${reservation.id}@soupers`,
		titre: evenement.titre,
		description: `Réservation ${reservation.prenom} ${reservation.nom} — ${reservation.couverts} couvert(s)`,
		lieu: [evenement.lieu_nom, evenement.lieu_adresse].filter(Boolean).join(', '),
		date: evenement.date,
		heure: service?.heure ?? evenement.heure_debut
	});

	return new Response(ics, {
		headers: {
			'content-type': 'text/calendar; charset=utf-8',
			'content-disposition': `attachment; filename="${versSlug(evenement.titre) || 'evenement'}.ics"`
		}
	});
};
