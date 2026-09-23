import type { RequestHandler } from './$types';
import { clubDeLaSession, lireEvenement } from '$lib/server/evenement';
import { listeReservations } from '$lib/server/bord';
import { versSlug } from '$lib/slug';

/** Une cellule CSV, protégée contre les points-virgules et les injections. */
function cellule(valeur: unknown): string {
	let texte = valeur === null || valeur === undefined ? '' : String(valeur);
	// Excel interprète =, +, - et @ en début de cellule comme une formule.
	if (/^[=+\-@\t\r]/.test(texte)) texte = `'${texte}`;
	return `"${texte.replace(/"/g, '""')}"`;
}

export const GET: RequestHandler = ({ params, locals }) => {
	const club = clubDeLaSession(locals);
	const evenement = lireEvenement(club.id, Number(params.id));
	const lignes = listeReservations(evenement.id, { statut: 'tous' });

	const entetes = [
		'Nom',
		'Prénom',
		'E-mail',
		'Téléphone',
		'Service',
		'Couverts',
		'Commande',
		'Remarques',
		'Montant (€)',
		'Paiement',
		'Moyen',
		'Communication',
		'Origine',
		'Entré',
		'Réservé le'
	];

	const corps = lignes.map((r) =>
		[
			r.nom,
			r.prenom,
			r.email,
			r.telephone,
			r.service_libelle,
			r.couverts,
			r.commande,
			r.remarques,
			(r.total_centimes / 100).toFixed(2).replace('.', ','),
			r.statut_paiement,
			r.mode_paiement,
			r.communication_structuree,
			r.source === 'manuelle' ? 'guichet' : 'en ligne',
			r.scanne_le ? 'oui' : 'non',
			new Date(r.cree_le * 1000).toLocaleString('fr-BE')
		]
			.map(cellule)
			.join(';')
	);

	// Le BOM fait ouvrir le fichier en UTF-8 par Excel sous Windows.
	const csv = '﻿' + [entetes.map(cellule).join(';'), ...corps].join('\r\n') + '\r\n';
	const nom = `reservations-${versSlug(evenement.titre) || evenement.slug}.csv`;

	return new Response(csv, {
		headers: {
			'content-type': 'text/csv; charset=utf-8',
			'content-disposition': `attachment; filename="${nom}"`,
			'cache-control': 'no-store'
		}
	});
};
