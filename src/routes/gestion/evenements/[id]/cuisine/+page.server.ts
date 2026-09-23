import type { PageServerLoad } from './$types';
import { lireEvenement } from '$lib/server/evenement';
import { recapCuisine } from '$lib/server/bord';

export const load: PageServerLoad = async ({ params, parent }) => {
	const { club } = await parent();
	const id = Number(params.id);
	return { evenement: lireEvenement(club.id, id), cuisine: recapCuisine(id) };
};
