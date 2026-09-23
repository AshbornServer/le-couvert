import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ url }) => ({ etat: url.searchParams.get('etat') ?? 'ok' });
