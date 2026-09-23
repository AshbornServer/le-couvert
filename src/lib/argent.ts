/** Formate des centimes en euros, à la belge : « 16,00 € ». */
export function euros(centimes: number): string {
	return (centimes / 100).toLocaleString('fr-BE', {
		style: 'currency',
		currency: 'EUR'
	});
}

/** Lit un prix tapé à la main (« 16 », « 16,50 », « 16.50 ») et rend des centimes. */
export function centimes(saisie: string | number | null | undefined): number {
	if (saisie === null || saisie === undefined || saisie === '') return 0;
	const texte = String(saisie).replace(/\s/g, '').replace(',', '.').replace('€', '');
	const valeur = Number.parseFloat(texte);
	if (!Number.isFinite(valeur) || valeur < 0) return 0;
	return Math.round(valeur * 100);
}
