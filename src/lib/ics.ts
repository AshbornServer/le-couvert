/** Fichier .ics « Ajouter à mon agenda », sans dépendance. */

type Rendezvous = {
	uid: string;
	titre: string;
	description?: string;
	lieu?: string;
	/** 'AAAA-MM-JJ' */
	date: string;
	/** 'HH:MM' — 19:00 par défaut */
	heure?: string | null;
	/** durée en minutes */
	duree?: number;
};

const echapper = (t: string) =>
	t.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

/** Plie les lignes à 75 octets, comme l'exige le format. */
function plier(ligne: string): string {
	if (ligne.length <= 75) return ligne;
	const morceaux = [ligne.slice(0, 75)];
	let reste = ligne.slice(75);
	while (reste.length > 74) {
		morceaux.push(' ' + reste.slice(0, 74));
		reste = reste.slice(74);
	}
	if (reste) morceaux.push(' ' + reste);
	return morceaux.join('\r\n');
}

export function fichierIcs(rdv: Rendezvous): string {
	const [a, m, j] = rdv.date.split('-').map(Number);
	const [h, mn] = (rdv.heure ?? '19:00').split(':').map(Number);

	// Heure locale belge, sans fuseau : les agendas l'affichent tel quel.
	const debut = `${a}${String(m).padStart(2, '0')}${String(j).padStart(2, '0')}T${String(h).padStart(2, '0')}${String(mn).padStart(2, '0')}00`;

	const fin = new Date(Date.UTC(a, m - 1, j, h, mn));
	fin.setUTCMinutes(fin.getUTCMinutes() + (rdv.duree ?? 180));
	const finTexte = fin.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, '');

	const horodatage = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');

	const lignes = [
		'BEGIN:VCALENDAR',
		'VERSION:2.0',
		'PRODID:-//Reservations//FR',
		'CALSCALE:GREGORIAN',
		'METHOD:PUBLISH',
		'BEGIN:VEVENT',
		`UID:${rdv.uid}`,
		`DTSTAMP:${horodatage}`,
		`DTSTART:${debut}`,
		`DTEND:${finTexte}`,
		`SUMMARY:${echapper(rdv.titre)}`,
		rdv.description ? `DESCRIPTION:${echapper(rdv.description)}` : '',
		rdv.lieu ? `LOCATION:${echapper(rdv.lieu)}` : '',
		'END:VEVENT',
		'END:VCALENDAR'
	].filter(Boolean);

	return lignes.map(plier).join('\r\n') + '\r\n';
}
