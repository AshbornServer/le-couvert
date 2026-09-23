/**
 * Communication structurée belge : +++123/4567/89012+++
 * 10 chiffres libres, puis 2 chiffres de contrôle = reste de la division
 * par 97 (97 quand le reste vaut 0).
 */

export function communicationStructuree(evenement_id: number, reservation_id: number): string {
	const base = `${String(evenement_id % 10000).padStart(4, '0')}${String(reservation_id % 1000000).padStart(6, '0')}`;
	const controle = Number(base) % 97 || 97;
	const douze = `${base}${String(controle).padStart(2, '0')}`;
	return `+++${douze.slice(0, 3)}/${douze.slice(3, 7)}/${douze.slice(7, 12)}+++`;
}

/** Enlève tout le décor pour comparer deux communications. */
export function communicationNue(texte: string): string {
	return texte.replace(/\D/g, '');
}

export function communicationValide(texte: string): boolean {
	const chiffres = communicationNue(texte);
	if (chiffres.length !== 12) return false;
	const controle = Number(chiffres.slice(10));
	return controle === (Number(chiffres.slice(0, 10)) % 97 || 97);
}
