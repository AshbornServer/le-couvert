/** Segments d'URL réservés à la plateforme : interdits comme slug de club. */
export const SLUGS_RESERVES = new Set([
	'admin', 'api', 'connexion', 'deconnexion', 'confidentialite', 'aide', 'gestion',
	'static', 'assets', 'favicon.ico', 'robots.txt', 'r', 'televersements', 'mollie'
]);

export function versSlug(texte: string): string {
	return texte
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 48);
}

export function slugValide(slug: string): boolean {
	return /^[a-z0-9][a-z0-9-]{1,47}$/.test(slug) && !SLUGS_RESERVES.has(slug);
}
