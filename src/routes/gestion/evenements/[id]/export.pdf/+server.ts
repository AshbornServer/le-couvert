import PDFDocument from 'pdfkit';
import type { RequestHandler } from './$types';
import { clubDeLaSession, lireEvenement } from '$lib/server/evenement';
import { chiffres, listeReservations } from '$lib/server/bord';
import { dateLongue, heureBelge } from '$lib/dates';
import { euros } from '$lib/argent';
import { versSlug } from '$lib/slug';

/** La liste d'entrée, triée par nom : une feuille à cocher pour l'accueil. */
export const GET: RequestHandler = async ({ params, locals }) => {
	const club = clubDeLaSession(locals);
	const evenement = lireEvenement(club.id, Number(params.id));
	const lignes = listeReservations(evenement.id, { statut: 'tous' });
	const totaux = chiffres(evenement.id);

	const doc = new PDFDocument({ size: 'A4', margin: 36, bufferPages: true });
	const morceaux: Buffer[] = [];
	doc.on('data', (b: Buffer) => morceaux.push(b));
	const fini = new Promise<Buffer>((resoudre) =>
		doc.on('end', () => resoudre(Buffer.concat(morceaux)))
	);

	const largeur = doc.page.width - 72;
	const colonnes = [
		{ titre: '', x: 36, l: 18 },
		{ titre: 'Nom', x: 56, l: 150 },
		{ titre: 'Service', x: 208, l: 84 },
		{ titre: 'Couv.', x: 294, l: 34 },
		{ titre: 'Commande', x: 330, l: 150 },
		{ titre: 'Montant', x: 482, l: 46 },
		{ titre: 'Paiement', x: 530, l: 54 }
	];

	function entete() {
		doc.fontSize(16).font('Helvetica-Bold').text(evenement.titre, 36, 36);
		doc
			.fontSize(10)
			.font('Helvetica')
			.text(
				`${club.nom} — ${dateLongue(evenement.date)}${evenement.heure_debut ? ` dès ${heureBelge(evenement.heure_debut)}` : ''}`,
				36,
				56
			);
		doc.text(
			`${totaux.reservations} réservations · ${totaux.couverts} couverts · ${euros(totaux.encaisse_centimes)} encaissé · ${totaux.a_payer} à payer`,
			36,
			70
		);

		doc.moveTo(36, 88).lineTo(36 + largeur, 88).lineWidth(1).stroke();
		doc.fontSize(9).font('Helvetica-Bold');
		for (const c of colonnes) doc.text(c.titre, c.x, 92, { width: c.l });
		doc.moveTo(36, 104).lineTo(36 + largeur, 104).stroke();
		return 110;
	}

	let y = entete();

	for (const r of lignes) {
		const annule = ['annule', 'rembourse', 'expire'].includes(r.statut_paiement);

		if (y > doc.page.height - 60) {
			doc.addPage();
			y = entete();
		}

		// La case à cocher de l'entrée.
		doc.lineWidth(0.8).rect(38, y, 11, 11).stroke();

		doc.fontSize(9).font(annule ? 'Helvetica-Oblique' : 'Helvetica-Bold');
		doc.text(`${r.nom} ${r.prenom}`, colonnes[1].x, y + 1, { width: colonnes[1].l, ellipsis: true });

		doc.font('Helvetica').fontSize(8);
		doc.text(r.service_libelle ?? '—', colonnes[2].x, y + 2, { width: colonnes[2].l, ellipsis: true });
		doc.text(String(r.couverts), colonnes[3].x, y + 2, { width: colonnes[3].l, align: 'right' });
		doc.text(r.commande ?? '', colonnes[4].x, y + 2, { width: colonnes[4].l, ellipsis: true });
		doc.text(euros(r.total_centimes), colonnes[5].x, y + 2, {
			width: colonnes[5].l,
			align: 'right'
		});
		doc.text(
			annule ? 'ANNULÉ' : r.statut_paiement === 'paye' ? 'payé' : 'À PAYER',
			colonnes[6].x,
			y + 2,
			{ width: colonnes[6].l }
		);

		let bas = y + 13;
		if (r.remarques) {
			doc
				.fontSize(7)
				.fillColor('#555')
				.text(r.remarques, colonnes[1].x, bas, { width: 420, ellipsis: true });
			doc.fillColor('#000');
			bas += 9;
		}

		doc
			.moveTo(36, bas + 1)
			.lineTo(36 + largeur, bas + 1)
			.lineWidth(0.3)
			.strokeColor('#cccccc')
			.stroke()
			.strokeColor('#000000');

		y = bas + 5;
	}

	// Numérotation, une fois toutes les pages connues.
	const pages = doc.bufferedPageRange();
	for (let i = 0; i < pages.count; i++) {
		doc.switchToPage(pages.start + i);
		doc
			.fontSize(8)
			.fillColor('#555')
			.text(
				`Page ${i + 1} / ${pages.count} — imprimé le ${new Date().toLocaleString('fr-BE')}`,
				36,
				doc.page.height - 34,
				{ width: largeur, align: 'center' }
			);
	}

	doc.end();
	const pdf = await fini;
	const nom = `liste-entree-${versSlug(evenement.titre) || evenement.slug}.pdf`;

	return new Response(new Uint8Array(pdf), {
		headers: {
			'content-type': 'application/pdf',
			'content-disposition': `attachment; filename="${nom}"`,
			'cache-control': 'no-store'
		}
	});
};
