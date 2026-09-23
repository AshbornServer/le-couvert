/** Lien Google Maps généré à partir de l'adresse écrite par l'organisateur. */
export function lienMaps(nom: string | null, adresse: string | null): string {
	const requete = [nom, adresse].filter(Boolean).join(', ').trim();
	if (!requete) return '';
	return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(requete)}`;
}
