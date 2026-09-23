import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals }) => ({ utilisateur: locals.utilisateur });
