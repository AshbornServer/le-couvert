import type { PageServerLoad } from './$types';
import { lireEvenement } from '$lib/server/evenement';
import { chiffres, listeReservations } from '$lib/server/bord';

export const load: PageServerLoad = async ({ params, parent }) => {
	const { club } = await parent();
	const id = Number(params.id);

	return {
		evenement: lireEvenement(club.id, id),
		chiffres: chiffres(id),
		// La liste part avec la page : la recherche à la main marche sans réseau.
		personnes: listeReservations(id, { statut: 'tous' }).map((r) => ({
			id: r.id,
			nom: r.nom,
			prenom: r.prenom,
			couverts: r.couverts,
			service: r.service_libelle,
			statut: r.statut_paiement,
			scanne_le: r.scanne_le
		}))
	};
};
