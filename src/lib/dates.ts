const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MOIS = [
	'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
	'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'
];

/** « 2026-10-17 » → « samedi 17 octobre 2026 ». */
export function dateLongue(iso: string | null | undefined): string {
	if (!iso) return '';
	const [a, m, j] = iso.split('-').map(Number);
	if (!a || !m || !j) return '';
	const d = new Date(Date.UTC(a, m - 1, j));
	return `${JOURS[d.getUTCDay()]} ${j} ${MOIS[m - 1]} ${a}`;
}

/** « 18:30 » → « 18 h 30 » ; « 20:00 » → « 20 h ». */
export function heureBelge(h: string | null | undefined): string {
	if (!h) return '';
	const [heures, minutes] = h.split(':');
	return minutes && minutes !== '00' ? `${Number(heures)} h ${minutes}` : `${Number(heures)} h`;
}

/** « 2026-10-15T23:59 » → « mercredi 15 octobre 2026 à 23 h 59 ». */
export function limiteLongue(iso: string | null | undefined): string {
	if (!iso) return '';
	const [date, heure] = iso.split('T');
	const h = heureBelge(heure?.slice(0, 5));
	return h ? `${dateLongue(date)} à ${h}` : dateLongue(date);
}

export const maintenant = () => Math.floor(Date.now() / 1000);

/** « 2026-10-17 » → « 2026-10-16T20:00 » : la veille au soir. */
export function veilleAVingtHeures(date: string): string {
	const [a, m, j] = date.split('-').map(Number);
	if (!a || !m || !j) return '';
	const d = new Date(Date.UTC(a, m - 1, j));
	d.setUTCDate(d.getUTCDate() - 1);
	return `${d.toISOString().slice(0, 10)}T20:00`;
}

/** Le jour civil local (pas UTC) décalé de `n` jours : « 2026-09-25 ». */
export function jourLocal(decalage = 0): string {
	const d = new Date();
	d.setDate(d.getDate() + decalage);
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
